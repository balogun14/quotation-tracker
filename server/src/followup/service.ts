import { and, eq } from 'drizzle-orm'
import type { TxDb } from '../db/index.js'
import { followUps, quotes, type Quote } from '../db/schema.js'

export const DEFAULT_FOLLOW_UP_DAYS = 3

export async function scheduleFollowUp(
  db: TxDb,
  quote: Quote,
  enqueue: (type: string, payload: Record<string, unknown>, scheduledAt: Date) => Promise<unknown>,
) {
  if (quote.followUpMode === 'none') return null
  const days = quote.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS
  const dueAt = new Date((quote.sentAt?.getTime() ?? Date.now()) + days * 86_400_000)

  const [followUp] = await db
    .insert(followUps)
    .values({
      quoteId: quote.id,
      kind: quote.followUpMode,
      dueAt,
      status: 'pending',
    })
    .returning({ id: followUps.id })
  if (!followUp) return null

  if (quote.followUpMode === 'email') {
    await enqueue('followup.send', { followUpId: followUp.id }, dueAt)
  }
  return followUp.id
}

export async function cancelPendingFollowUps(db: TxDb, quoteId: string): Promise<number> {
  const pending = await db
    .select({ id: followUps.id })
    .from(followUps)
    .where(and(eq(followUps.quoteId, quoteId), eq(followUps.status, 'pending')))
  if (pending.length === 0) return 0
  await db
    .update(followUps)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(followUps.quoteId, quoteId),
        eq(followUps.status, 'pending'),
      ),
    )
  return pending.length
}

export async function listDueReminders(db: TxDb, workspaceId: string) {
  return db
    .select({
      followUpId: followUps.id,
      quoteId: followUps.quoteId,
      dueAt: followUps.dueAt,
      kind: followUps.kind,
      status: followUps.status,
      clientName: quotes.clientName,
      clientCompany: quotes.clientCompany,
    })
    .from(followUps)
    .innerJoin(quotes, eq(quotes.id, followUps.quoteId))
    .where(
      and(
        eq(quotes.workspaceId, workspaceId),
        eq(followUps.status, 'pending'),
        eq(followUps.kind, 'reminder'),
      ),
    )
    .orderBy(followUps.dueAt)
}
