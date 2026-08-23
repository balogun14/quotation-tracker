import type { Logger } from 'pino'
import type { Db } from '../db/index.js'
import { claimDueJobs, completeJob, failJob } from './service.js'
import type { JobHandler } from './handlers.js'

export interface Worker {
  runOnce(now?: Date): Promise<number>
  start(intervalMs?: number): () => void
}

export function createWorker(db: Db, handlers: Record<string, JobHandler>, logger?: Logger): Worker {
  async function runOnce(now: Date = new Date()): Promise<number> {
    const claimed = await claimDueJobs(db, now, 10)
    for (const job of claimed) {
      const handler = handlers[job.type]
      try {
        if (handler) {
          await handler(db, job, JSON.parse(job.payload) as Record<string, unknown>)
        }
        await completeJob(db, job.id)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await failJob(db, job.id, message, job.attempts, job.maxAttempts)
        logger?.warn?.({ jobId: job.id, type: job.type, error: message }, 'job failed')
      }
    }
    return claimed.length
  }

  function start(intervalMs = 5000): () => void {
    const timer = setInterval(() => {
      runOnce().catch((err) => {
        logger?.error?.({ err }, 'worker tick failed')
      })
    }, intervalMs)
    return () => clearInterval(timer)
  }

  return { runOnce, start }
}
