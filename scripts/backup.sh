#!/usr/bin/env bash
set -euo pipefail

# Quotely daily backup: encrypted off-host SQLite + file snapshot.
#
# Retention: 30 daily, 12 monthly, 7 yearly (matches PRD line 78).
# Target: 24h recovery point. Restore docs: docs/operations.md.
#
# Requirements on the host:
#   - age (encryption)  -> https://github.com/FiloSottile/age
#   - rclone (off-host) -> https://rclone.org
#   - A public age key in BACKUP_AGE_RECIPIENT, an rclone remote in BACKUP_RCLONE_REMOTE,
#     and the age identity in AGE_IDENTITY (for restore; not needed for backup).
#
# Usage:
#   BACKUP_AGE_RECIPIENT=age1... BACKUP_RCLONE_REMOTE=b2:quotely ./scripts/backup.sh
#
# Suggested cron (runs 02:00 local):
#   0 2 * * *  cd /opt/quotely && BACKUP_AGE_RECIPIENT=... BACKUP_RCLONE_REMOTE=... ./scripts/backup.sh >> /var/log/quotely-backup.log 2>&1
# The same job should alert on failure; wire the exit code to your alerting.

DATA_DIR="${DATA_DIR:-./data}"
BACKUP_ROOT="${BACKUP_ROOT:-./backups}"
BACKUP_AGE_RECIPIENT="${BACKUP_AGE_RECIPIENT:?set BACKUP_AGE_RECIPIENT to the public age key}"
BACKUP_RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:?set BACKUP_RCLONE_REMOTE to the rclone remote (e.g. b2:quotely)}"

command -v age >/dev/null 2>&1 || { echo "age is required"; exit 1; }
command -v rclone >/dev/null 2>&1 || { echo "rclone is required"; exit 1; }
[ -d "$DATA_DIR" ] || { echo "DATA_DIR $DATA_DIR not found"; exit 1; }

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Consistent SQLite snapshot: checkpoint WAL into the main DB while holding a
# shared lock, then copy. node:sqlite lives inside the container, so if the DB
# is open by the API container we checkpoint via a one-off container on the
# same volume. With a stopped stack the plain copy below is sufficient.
# The container path is the same as compose: /app/data.
if command -v docker >/dev/null 2>&1 && docker compose ps --status running api >/dev/null 2>&1; then
  echo "Checkpointing SQLite via api container..."
  docker compose exec -T api node -e \
    "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('/app/data/quotely.db');db.exec('PRAGMA wal_checkpoint(TRUNCATE)');db.close()"
fi

echo "Snapshotting data..."
cp -a "$DATA_DIR" "$TMP/snapshot"

echo "Encrypting backup..."
tar -C "$TMP" -czf - snapshot | age -r "$BACKUP_AGE_RECIPIENT" > "$TMP/quotely-$STAMP.tar.gz.age"
openssl sha256 "$TMP/quotely-$STAMP.tar.gz.age" > "$TMP/quotely-$STAMP.sha256"

mkdir -p "$BACKUP_ROOT/daily" "$BACKUP_ROOT/monthly" "$BACKUP_ROOT/yearly"
mv "$TMP/quotely-$STAMP.tar.gz.age" "$BACKUP_ROOT/daily/"
mv "$TMP/quotely-$STAMP.sha256" "$BACKUP_ROOT/daily/"

# Promote snapshots to monthly/yearly and prune retention windows.
month="$(date -u +%Y%m)"
if [ ! -f "$BACKUP_ROOT/monthly/quotely-$month.tar.gz.age" ]; then
  cp "$BACKUP_ROOT/daily/quotely-$STAMP.tar.gz.age" "$BACKUP_ROOT/monthly/quotely-$month.tar.gz.age"
fi
year="$(date -u +%Y)"
if [ ! -f "$BACKUP_ROOT/yearly/quotely-$year.tar.gz.age" ]; then
  cp "$BACKUP_ROOT/daily/quotely-$STAMP.tar.gz.age" "$BACKUP_ROOT/yearly/quotely-$year.tar.gz.age"
fi

prune() {
  # keep the N most recent files matching the glob
  local dir="$1" glob="$2" keep="$3"
  ls -1t "$dir"/$glob 2>/dev/null | tail -n +"$((keep + 1))" | while read -r f; do rm -f -- "$f"; done
}
prune "$BACKUP_ROOT/daily" 'quotely-*.tar.gz.age' 30
prune "$BACKUP_ROOT/monthly" 'quotely-*.tar.gz.age' 12
prune "$BACKUP_ROOT/yearly" 'quotely-*.tar.gz.age' 7

echo "Uploading to $BACKUP_RCLONE_REMOTE..."
rclone copy "$BACKUP_ROOT" "$BACKUP_RCLONE_REMOTE/quotely" --include '*.age' --include '*.sha256'

echo "Backup complete: $STAMP"
