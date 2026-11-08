import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb } from './index.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

export function runMigrations(sqlite: ReturnType<typeof openDb>) {
  sqlite.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at integer NOT NULL)',
  )

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const applied = new Set(
    (sqlite.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]).map(
      (r) => r.name,
    ),
  )

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)

    sqlite.exec('BEGIN')
    try {
      for (const stmt of statements) {
        sqlite.exec(stmt)
      }
      sqlite.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(
        file,
        Date.now(),
      )
      sqlite.exec('COMMIT')
    } catch (err) {
      sqlite.exec('ROLLBACK')
      throw err
    }
  }
  return files.length
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = openDb()
  const count = runMigrations(db)
  console.log(`Applied migrations (${count} total in repo).`)
  db.close()
};
