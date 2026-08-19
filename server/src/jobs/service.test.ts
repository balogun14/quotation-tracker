import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from '../test/db.js'
import { enqueueJob, claimDueJobs, completeJob, failJob, backoffMs } from './service.js'
import { jobs } from '../db/schema.js'

describe('jobs service', () => {
  it('enqueues, claims, and completes a job', async () => {
    const { db, close } = createTestDb()
    const job = await enqueueJob(db, 'test', { a: 1 })
    expect(job.status).toBe('pending')

    const claimed = await claimDueJobs(db, new Date(), 10)
    expect(claimed).toHaveLength(1)
    expect(claimed[0]?.status).toBe('running')
    expect(claimed[0]?.attempts).toBe(1)

    await completeJob(db, job.id)
    const [done] = await db.select().from(jobs).where(eq(jobs.id, job.id))
    expect(done?.status).toBe('done')
    close()
  })

  it('does not claim future jobs', async () => {
    const { db, close } = createTestDb()
    await enqueueJob(db, 'test', {}, { scheduledAt: new Date(Date.now() + 60_000) })
    const claimed = await claimDueJobs(db, new Date(), 10)
    expect(claimed).toHaveLength(0)
    close()
  })

  it('deduplicates by idempotency key', async () => {
    const { db, close } = createTestDb()
    const a = await enqueueJob(db, 'test', {}, { idempotencyKey: 'k1' })
    const b = await enqueueJob(db, 'test', {}, { idempotencyKey: 'k1' })
    expect(a.id).toBe(b.id)
    close()
  })

  it('reschedules on failure then gives up after max attempts', async () => {
    const { db, close } = createTestDb()
    const job = await enqueueJob(db, 'test', {}, { maxAttempts: 2 })

    await claimDueJobs(db, new Date(), 10)
    await failJob(db, job.id, 'boom', 1, 2)
    let [row] = await db.select().from(jobs).where(eq(jobs.id, job.id))
    expect(row?.status).toBe('pending')

    await claimDueJobs(db, new Date(Date.now() + backoffMs(1)), 10)
    await failJob(db, job.id, 'boom', 2, 2)
    ;[row] = await db.select().from(jobs).where(eq(jobs.id, job.id))
    expect(row?.status).toBe('failed')
    close()
  })

  it('backs off exponentially capped at an hour', () => {
    expect(backoffMs(1)).toBe(60_000)
    expect(backoffMs(3)).toBe(240_000)
    expect(backoffMs(10)).toBe(3_600_000)
  })
})
