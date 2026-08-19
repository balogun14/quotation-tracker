import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { Db, TxDb } from '../db/index.js'
import {
  publicLinks,
  quoteVersions,
  quoteDecisions,
  quotes,
  files,
  type Quote,
} from '../db/schema.js'
import { errors } from '../errors.js'
import { hashToken, randomToken } from '../security/tokens.js'
import type { QuoteSnapshot } from '../quote/snapshot.js'
import type { FileStorageProvider } from '../files/storage.js'
import { requireMember } from '../workspace/service.js'
import { cancelPendingFollowUps } from '../followup/service.js'
import { recordAudit } from '../audit/service.js'

export interface PublicQuoteView {
  snapshot: QuoteSnapshot
  status: Quote['status']
  decidedAt: Date | null
  decision: 'accepted' | 'declined' | null
}

export interface DecideInput {
  decision: 'accepted' | 'declined'
  recipientName?: string
  recipientEmail?: string
}

export async function issuePublicLink(
  db: TxDb,
  quoteVersionId: string,
  expiresAt: Date,
): Promise<string> {
  const token = randomToken(32)
  await db.insert(publicLinks).values({
    quoteVersionId,
    tokenHash: hashToken(token),
    expiresAt,
  })
  return token
}

export function createPublicService(storage: FileStorageProvider) {
  async function findVersionByToken(db: Db, token: string) {
    const rows = await db
      .select({
        linkId: publicLinks.id,
        expiresAt: publicLinks.expiresAt,
        quoteId: quoteVersions.quoteId,
        workspaceId: quotes.workspaceId,
        versionId: quoteVersions.id,
        snapshotJson: quoteVersions.snapshotJson,
        pdfFileId: quoteVersions.pdfFileId,
        status: quotes.status,
        decidedAt: quotes.decidedAt,
      })
      .from(publicLinks)
      .innerJoin(quoteVersions, eq(quoteVersions.id, publicLinks.quoteVersionId))
      .innerJoin(quotes, eq(quotes.id, quoteVersions.quoteId))
      .where(and(eq(publicLinks.tokenHash, hashToken(token)), isNull(publicLinks.revokedAt)))
      .limit(1)
    const row = rows[0]
    if (!row) throw errors.notFound('Link not found or revoked')
    if (row.expiresAt.getTime() < Date.now()) throw errors.forbidden('This link has expired')
    return row
  }

  async function getPublicQuote(db: Db, token: string): Promise<PublicQuoteView> {
    const row = await findVersionByToken(db, token)
    const snapshot = JSON.parse(row.snapshotJson) as QuoteSnapshot
    const decisions = await db
      .select({ decision: quoteDecisions.decision })
      .from(quoteDecisions)
      .where(eq(quoteDecisions.quoteId, row.quoteId))
      .orderBy(quoteDecisions.decidedAt)
      .limit(1)
    return {
      snapshot,
      status: row.status,
      decidedAt: row.decidedAt,
      decision: decisions[0]?.decision ?? null,
    }
  }

  async function getPublicPdf(db: Db, token: string): Promise<Buffer> {
    const row = await findVersionByToken(db, token)
    if (!row.pdfFileId) throw errors.notFound('No document for this version')
    const [file] = await db.select().from(files).where(eq(files.id, row.pdfFileId)).limit(1)
    if (!file) throw errors.notFound('Document not found')
    return storage.get(file.key)
  }

  async function decide(db: Db, token: string, input: DecideInput) {
    const row = await findVersionByToken(db, token)
    if (row.status !== 'sent' && row.status !== 'followed_up') {
      throw errors.conflict(`Quote is already ${row.status}`)
    }

    await db.transaction(async (tx) => {
      await tx.insert(quoteDecisions).values({
        quoteId: row.quoteId,
        versionId: row.versionId,
        decision: input.decision,
        recipientName: input.recipientName,
        recipientEmail: input.recipientEmail,
      })
      await tx
        .update(quotes)
        .set({ status: input.decision, decidedAt: new Date(), updatedAt: new Date() })
        .where(eq(quotes.id, row.quoteId))
      await tx.update(publicLinks).set({ revokedAt: new Date() }).where(eq(publicLinks.id, row.linkId))
    })

    await cancelPendingFollowUps(db, row.quoteId)
    await recordAudit(db, {
      workspaceId: row.workspaceId,
      actorId: null,
      action: 'quote.decided',
      entityType: 'quote',
      entityId: row.quoteId,
      after: { decision: input.decision, recipientName: input.recipientName ?? null, recipientEmail: input.recipientEmail ?? null },
    })
    return { decision: input.decision }
  }

  async function revokeQuoteLinks(
    db: TxDb,
    workspaceId: string,
    actorId: string,
    quoteId: string,
  ) {
    await requireMember(db, workspaceId, actorId)
    const versions = await db
      .select({ id: quoteVersions.id })
      .from(quoteVersions)
      .where(eq(quoteVersions.quoteId, quoteId))
    if (versions.length === 0) return 0
    const versionIds = versions.map((v) => v.id)

    const active = await db
      .select({ id: publicLinks.id })
      .from(publicLinks)
      .where(and(inArray(publicLinks.quoteVersionId, versionIds), isNull(publicLinks.revokedAt)))

    if (active.length > 0) {
      await db
        .update(publicLinks)
        .set({ revokedAt: new Date() })
        .where(
          inArray(
            publicLinks.id,
            active.map((l) => l.id),
          ),
        )
    }
    return active.length
  }

  return { getPublicQuote, getPublicPdf, decide, revokeQuoteLinks }
}
