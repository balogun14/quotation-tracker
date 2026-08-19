import { describe, it, expect } from 'vitest'
import { openDb, createOrm } from './index.js'
import { runMigrations } from './migrate.js'
import { users } from './schema.js'

describe('db', () => {
  it('applies migrations and performs a basic write/read', async () => {
    const sqlite = openDb(':memory:')
    runMigrations(sqlite)
    const db = createOrm(sqlite)

    await db.insert(users).values({
      name: 'Ada',
      email: 'ada@example.com',
      passwordHash: 'x',
    })

    const rows = await db.select().from(users)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.email).toBe('ada@example.com')

    sqlite.close()
  })
})
