import { openDb, createOrm, type Db } from '../db/index.js'
import { runMigrations } from '../db/migrate.js'

export function createTestDb(): { db: Db; close: () => void } {
  const sqlite = openDb(':memory:')
  runMigrations(sqlite)
  const db = createOrm(sqlite)
  return { db, close: () => sqlite.close() }
}
