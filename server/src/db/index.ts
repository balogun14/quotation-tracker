import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { drizzle, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'
import type { RemoteCallback } from 'drizzle-orm/sqlite-proxy'
import { config } from '../config.js'
import * as schema from './schema.js'

export type Db = SqliteRemoteDatabase<typeof schema>
type TxCallback = Parameters<Db['transaction']>[0]
export type TxDb = Db | Parameters<TxCallback>[0]

export function openDb(url: string = config.DATABASE_URL): DatabaseSync {
  if (url !== ':memory:') {
    mkdirSync(dirname(url), { recursive: true })
  }
  const db = new DatabaseSync(url)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec('PRAGMA synchronous = NORMAL')
  return db
}

function proxyCallback(sqlite: DatabaseSync): RemoteCallback {
  return async (sql, params, method) => {
    const stmt = sqlite.prepare(sql)
    stmt.setReturnArrays(true)
    if (method === 'run') {
      stmt.run(...params)
      return { rows: [] }
    }
    if (method === 'get') {
      const row = stmt.get(...params)
      if (row === undefined) return { rows: undefined as unknown as unknown[] }
      return { rows: row as unknown as unknown[] }
    }
    const rows = stmt.all(...params)
    return { rows: rows as unknown as unknown[][] }
  }
}

export function createOrm(sqlite: DatabaseSync): Db {
  return drizzle(proxyCallback(sqlite), { schema })
}
