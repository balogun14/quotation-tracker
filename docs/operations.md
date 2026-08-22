# Operations

## Deployment topology

Quotely runs as two containers on a single VPS (see PRD line 77):

- **api** — the Express server, listens on port 3000.
- **worker** — the background job worker (follow-ups, quote expiry, FX refresh, maintenance purge, email sends).

Both share one bind mount: `./data` on the host → `/app/data` in the container.
Inside `./data`:

- `quotely.db` — SQLite database (WAL mode).
- `files/` — uploaded PDFs and other file objects.

There is no external database; SQLite + local disk are the persistence layer for
this deployment phase. Do not run multiple replicas of either container — the
worker would double-claim jobs and SQLite WAL is not designed for split-brain
multi-process access.

## First deployment

1. Copy `.env.example` to `.env` at the repo root and set values:

   - `JWT_SECRET` — **required**. Must be a strong random string (at least 32
     bytes). Generate with `openssl rand -hex 32`.
   - `PUBLIC_BASE_URL` — the public origin of the frontend, e.g. `https://app.example.com`.
   - `CORS_ORIGIN` — the frontend origin the API allows, e.g. `https://app.example.com`.
   - `EMAIL_PROVIDER=resend` and `RESEND_API_KEY` for real email; keep `console`
     for local testing.
   - `COOKIE_SECURE=true` when serving over HTTPS.
   - `FILE_STORAGE_DIR` and `DATABASE_URL` are overridden by docker-compose to
     paths under `/app/data`; leave the defaults.

2. Build and start:

   ```sh
   docker compose up -d --build
   ```

3. Verify:

   ```sh
   curl http://localhost:3000/health   # {"status":"ok"}
   curl http://localhost:3000/ready    # {"status":"ok"} (checks DB)
   docker compose ps
   ```

4. Put a reverse proxy (Caddy/nginx) in front of port 3000 with TLS and forward
   `/api/v1`, `/p`, `/health`, `/ready`, and `/api/v1/openapi.json` to the API.

## Backups

The backup script snapshots `./data` (SQLite + files), encrypts it with
[age](https://github.com/FiloSottile/age), keeps 30 daily / 12 monthly / 7
yearly copies locally, and uploads the encrypted archives to an rclone remote
(B2, S3, etc.). See PRD line 78.

```sh
# one-time setup on the VPS
apt install age rclone   # or your distro equivalent
rclone config            # configure the remote, e.g. "b2"
# generate a keypair; store the IDENTITY securely and put the RECIPIENT in cron
age-keygen -o ~/.config/quotely-backup-identity.txt

# test a backup
BACKUP_AGE_RECIPIENT=$(age-keygen -y ~/.config/quotely-backup-identity.txt) \
BACKUP_RCLONE_REMOTE=b2:my-bucket \
./scripts/backup.sh
```

Schedule it daily (02:00 local) with cron:

```cron
0 2 * * * cd /opt/quotely && BACKUP_AGE_RECIPIENT=$(age-keygen -y ~/.config/quotely-backup-identity.txt) BACKUP_RCLONE_REMOTE=b2:my-bucket ./scripts/backup.sh >> /var/log/quotely-backup.log 2>&1
```

Wire the script's exit code into your alerting so a failed backup pages someone.
Backup success alerts can also be derived from the log tail (`Backup complete:`).

### Restore

1. Stop the stack: `docker compose down`.
2. Restore the encrypted archive from the remote (or `./backups/daily`):

   ```sh
   rclone copy b2:my-bucket/quotely/quotely-<STAMP>.tar.gz.age ./restore/
   age -d -i ~/.config/quotely-backup-identity.txt ./restore/quotely-<STAMP>.tar.gz.age > ./restore/quotely.tar.gz
   tar -xzf ./restore/quotely.tar.gz -C ./restore
   ```

3. Point the volume at the restored snapshot:

   ```sh
   rm -rf data
   mv restore/snapshot data
   ```

4. Start again: `docker compose up -d`.

5. Verify `/health`, `/ready`, and that a known quote/file renders.

**Test this restore procedure quarterly** (PRD line 78) — restore into a scratch
directory and run the API against it on a different port before touching prod.

## Monitoring

- **Health/ready** — `GET /health` (process up) and `GET /ready` (DB reachable).
  Docker healthcheck on the api container hits `/ready`; `docker compose ps`
  shows the state.
- **Logs** — structured JSON via pino. The API logs request-level data
  (request id, method, path, status, latency). The worker logs job failures.
  Centralize with `docker compose logs -f`, or ship to your log aggregator.
- **Job failures** — the worker writes failure metadata (attempts, last error)
  to the `jobs` table. Alert on rows that are still `failed` after their
  `max_attempts`, or on `worker` container restarts.
- **Backup alerts** — see the backups section.

Never log passwords, JWTs, reset tokens, raw public-link tokens, or complete
sensitive request bodies. The error handler logs the error object (not the
request body) and returns a generic envelope to clients.

## Workspace deletion

`DELETE /api/v1/workspaces/:id` schedules deletion: access is disabled
immediately, and the `maintenance.purge` worker job physically removes the
workspace data, files, sessions, and queued jobs after the 30-day recovery
period. The 30-day recovery window is the `RECOVERY_MS` constant in
`server/src/workspace/delete.ts`. Workspaces in the recovery window can be
restored via `POST /api/v1/workspaces/:id/restore`.
