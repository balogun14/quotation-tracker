import { and, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import type { TxDb } from '../db/index.js'
import { jobs, type Job } from '../db/schema.js'

export interface EnqueueOptions {
  scheduledAt?: Date
  idempotencyKey?: string
  maxAttempts?: number
}

export async function enqueueJob(
  db: TxDb,
  type: string,
  payload: Record<string, unknown> = {},
  options: EnqueueOptions = {},
): Promise<Job> {
  if (options.idempotencyKey) {
    const existing = await db
      .select()
      .from(jobs)
      .where(eq(jobs.idempotencyKey, options.idempotencyKey))
      .limit(1)
    if (existing[0]) return existing[0]
  }

  const [job] = await db
    .insert(jobs)
    .values({
      type,
      payload: JSON.stringify(payload),
      idempotencyKey: options.idempotencyKey,
      scheduledAt: options.scheduledAt ?? new Date(),
      maxAttempts: options.maxAttempts ?? 5,
    })
    .returning()
  if (!job) throw new Error('Failed to enqueue job')
  return job
}

const LOCK_MS = 60_000

export async function claimDueJobs(db: TxDb, now: Date, limit = 10): Promise<Job[]> {
  const due = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.status, 'pending'),
        lte(jobs.scheduledAt, now),
        or(isNull(jobs.lockedUntil), lte(jobs.lockedUntil, now)),
      ),
    )
    .orderBy(jobs.scheduledAt)
    .limit(limit)

  if (due.length === 0) return []
  const lockUntil = new Date(now.getTime() + LOCK_MS)
  await db
    .update(jobs)
    .set({ status: 'running', lockedUntil: lockUntil, attempts: sql`${jobs.attempts} + 1` })
    .where(inArray(jobs.id, due.map((j) => j.id)))

  return due.map((j) => ({ ...j, status: 'running', attempts: j.attempts + 1, lockedUntil: lockUntil }))
}

export async function completeJob(db: TxDb, id: string) {
  await db.update(jobs).set({ status: 'done', runAt: new Date() }).where(eq(jobs.id, id))
}

export function backoffMs(attempts: number): number {
  return Math.min(2 ** Math.max(attempts - 1, 0) * 60_000, 3_600_000)
}

export async function failJob(db: TxDb, id: string, error: string, attempts: number, maxAttempts: number) {
  if (attempts < maxAttempts) {
    await db
      .update(jobs)
      .set({
        status: 'pending',
        scheduledAt: new Date(Date.now() + backoffMs(attempts)),
        lastError: error,
      })
      .where(eq(jobs.id, id))
  } else {
    await db.update(jobs).set({ status: 'failed', lastError: error }).where(eq(jobs.id, id))
  }
}
