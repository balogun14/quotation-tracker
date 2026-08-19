import { desc, eq } from 'drizzle-orm'
import type { Db } from '../db/index.js'
import { followUps, quotes, quoteVersions, workspaces, type Job } from '../db/schema.js'
import type { EmailProvider } from '../email/provider.js'
import { cancelPendingFollowUps } from '../followup/service.js'
import { issuePublicLink } from '../public/service.js'
import { createFxRateProvider } from '../fx/provider.js'
import { purgeDeletedWorkspaces } from '../workspace/delete.js'
import { config } from '../config.js'

export type JobHandler = (db: Db, job: Job, payload: Record<string, unknown>) => Promise<void>

export function createHandlers(email: EmailProvider): Record<string, JobHandler> {
  return {
    async 'followup.send'(db, _job, payload) {
      const followUpId = String(payload.followUpId)
      const [followUp] = await db.select().from(followUps).where(eq(followUps.id, followUpId)).limit(1)
      if (!followUp || followUp.status !== 'pending') return

      const [quote] = await db.select().from(quotes).where(eq(quotes.id, followUp.quoteId)).limit(1)
      if (!quote) return
      if (['accepted', 'declined', 'expired', 'cancelled'].includes(quote.status)) {
        await cancelPendingFollowUps(db, quote.id)
        return
      }
      if (followUp.kind !== 'email' || !quote.clientEmail) return

      const [version] = await db
        .select()
        .from(quoteVersions)
        .where(eq(quoteVersions.quoteId, quote.id))
        .orderBy(desc(quoteVersions.versionNumber))
        .limit(1)
      const [workspace] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, quote.workspaceId))
        .limit(1)

      const token = version
        ? await issuePublicLink(db, version.id, quote.expiryDate ?? new Date(Date.now() + 86_400_000))
        : null
      const link = token ? `${config.PUBLIC_BASE_URL}/p/${token}` : null

      await email.send({
        to: quote.clientEmail,
        replyTo: workspace?.replyToEmail,
        subject: `Following up on your quotation`,
        text:
          `Hi ${quote.clientName},\n\n` +
          `Just following up on the quotation we sent. We'd love to know if you have any questions or would like to proceed.\n\n` +
          (link ? `Review your quotation: ${link}\n\n` : '') +
          `Thanks,\n${workspace?.businessName ?? ''}`,
      })

      await db
        .update(followUps)
        .set({ status: 'sent', sentAt: new Date() })
        .where(eq(followUps.id, followUp.id))
    },

    async 'quote.expire'(db, _job, payload) {
      const quoteId = String(payload.quoteId)
      const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1)
      if (!quote) return
      if (quote.status !== 'sent' && quote.status !== 'followed_up') return
      if (!quote.expiryDate || quote.expiryDate.getTime() > Date.now()) return

      await db
        .update(quotes)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(quotes.id, quoteId))
      await cancelPendingFollowUps(db, quoteId)
    },

    async 'email.send'(db, _job, payload) {
      await email.send({
        to: String(payload.to),
        subject: String(payload.subject ?? ''),
        text: String(payload.text ?? ''),
        replyTo: payload.replyTo ? String(payload.replyTo) : undefined,
      })
    },

    async 'fx.refresh'(db, _job, payload) {
      const base = String(payload.base)
      const quote = String(payload.quote)
      const date = payload.date ? new Date(String(payload.date)) : new Date()
      const fx = createFxRateProvider(db)
      await fx.getRate(base, quote, date)
    },

    async 'maintenance.purge'(db, _job) {
      await purgeDeletedWorkspaces(db)
    },
  }
}
