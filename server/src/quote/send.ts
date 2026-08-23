import { eq, max } from 'drizzle-orm'
import type { Db, TxDb } from '../db/index.js'
import { quotes, quoteVersions, publicLinks, files, type Quote, type QuoteItem } from '../db/schema.js'
import { errors } from '../errors.js'
import { getQuote } from './service.js'
import { getWorkspace, requireMember } from '../workspace/service.js'
import { renderQuotePdf } from '../files/pdf.js'
import type { QuoteSnapshot } from './snapshot.js'
import { LocalFileStorage, type FileStorageProvider } from '../files/storage.js'
import { createEmailProvider, type EmailProvider } from '../email/provider.js'
import { randomToken, hashToken } from '../security/tokens.js'
import { config } from '../config.js'
import { scheduleFollowUp } from '../followup/service.js'
import { enqueueJob } from '../jobs/service.js'
import { recordAudit } from '../audit/service.js'

export interface SendDeps {
  storage: FileStorageProvider
  email: EmailProvider
}

export interface SendResult {
  quoteId: string
  versionNumber: number
  publicToken: string
  publicUrl: string
  emailDelivered: boolean
}

const DAY_MS = 86_400_000

export function createSendService(deps: SendDeps) {
  async function resolveExpiry(
    db: TxDb,
    quote: Quote,
    workspaceId: string,
  ): Promise<Date> {
    if (quote.expiryDate) return quote.expiryDate
    const workspace = await getWorkspace(db, workspaceId)
    return new Date(Date.now() + workspace.defaultQuoteExpiryDays * DAY_MS)
  }

  async function buildSnapshot(
    db: Db,
    quote: Quote,
    items: QuoteItem[],
    workspaceId: string,
    versionNumber: number,
  ): Promise<QuoteSnapshot> {
    const workspace = await getWorkspace(db, workspaceId)
    return {
      quote,
      items,
      workspace: {
        businessName: workspace.businessName,
        replyToEmail: workspace.replyToEmail,
        logoUrl: workspace.logoUrl,
        phone: workspace.phone,
        address: workspace.address,
        website: workspace.website,
        paymentInstructions: workspace.paymentInstructions,
        accentColor: workspace.accentColor,
      },
      versionNumber,
      issuedAt: new Date().toISOString(),
    }
  }

  async function sendQuote(
    db: Db,
    workspaceId: string,
    actorId: string,
    quoteId: string,
  ): Promise<SendResult> {
    await requireMember(db, workspaceId, actorId)
    const quote = await getQuote(db, workspaceId, quoteId)
    const resendable = quote.status === 'draft' || quote.status === 'sent' || quote.status === 'followed_up'
    if (!resendable) {
      throw errors.conflict(`Cannot send a ${quote.status} quote`)
    }

    const expiryDate = await resolveExpiry(db, quote, workspaceId)

    const versionRows = await db
      .select({ n: max(quoteVersions.versionNumber) })
      .from(quoteVersions)
      .where(eq(quoteVersions.quoteId, quoteId))
    const versionNumber = (versionRows[0]?.n ?? 0) + 1

    const snapshot = await buildSnapshot(db, quote, quote.items, workspaceId, versionNumber)
    const pdf = await renderQuotePdf(snapshot)
    const storageKey = `${quoteId}-v${versionNumber}.pdf`
    await deps.storage.put(storageKey, pdf, 'application/pdf')

    const token = randomToken(32)
    const tokenHash = hashToken(token)

    await db.transaction(async (tx) => {
      const [file] = await tx
        .insert(files)
        .values({
          workspaceId,
          key: storageKey,
          originalName: `${quoteId}-v${versionNumber}.pdf`,
          mimeType: 'application/pdf',
          size: pdf.length,
        })
        .returning({ id: files.id })
      if (!file) throw new Error('Failed to store file record')

      const [version] = await tx
        .insert(quoteVersions)
        .values({
          quoteId,
          versionNumber,
          snapshotJson: JSON.stringify(snapshot),
          pdfFileId: file.id,
        })
        .returning({ id: quoteVersions.id })
      if (!version) throw new Error('Failed to create version')

      await tx.insert(publicLinks).values({
        quoteVersionId: version.id,
        tokenHash,
        expiresAt: expiryDate,
      })

      await tx
        .update(quotes)
        .set({
          status: quote.status === 'draft' ? 'sent' : quote.status,
          sentAt: quote.sentAt ?? new Date(),
          expiryDate,
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, quoteId))
    })

    const publicUrl = `${config.PUBLIC_BASE_URL}/p/${token}`
    let emailDelivered = !quote.clientEmail
    if (quote.clientEmail) {
      // ponytail: inline email send; move to a retried job in the worker slice
      try {
        await deps.email.send({
          to: quote.clientEmail,
          replyTo: snapshot.workspace.replyToEmail,
          subject: `Your quotation from ${snapshot.workspace.businessName}`,
          text:
            `Hi ${quote.clientName},\n\n` +
            `Please find your quotation from ${snapshot.workspace.businessName} below.\n\n` +
            `Review and respond: ${publicUrl}\n\n` +
            `This quotation is valid until ${expiryDate.toISOString().slice(0, 10)}.\n`,
        })
        emailDelivered = true
      } catch {
        // The quote and public link remain valid. Delivery status is returned
        // to the UI without leaking provider/network internals into logs.
      }
    }

    const updated = await getQuote(db, workspaceId, quoteId)
    await recordAudit(db, {
      workspaceId,
      actorId,
      action: 'quote.sent',
      entityType: 'quote',
      entityId: quoteId,
      after: { versionNumber, status: updated.status, sentAt: updated.sentAt },
    })
    await scheduleFollowUp(db, updated, (type, payload, scheduledAt) =>
      enqueueJob(db, type, payload, { scheduledAt }),
    )

    return { quoteId, versionNumber, publicToken: token, publicUrl, emailDelivered }
  }

  async function previewPdf(db: Db, workspaceId: string, actorId: string, quoteId: string): Promise<Buffer> {
    await requireMember(db, workspaceId, actorId)
    const quote = await getQuote(db, workspaceId, quoteId)
    const snapshot = await buildSnapshot(db, quote, quote.items, workspaceId, 0)
    return renderQuotePdf(snapshot)
  }

  return { sendQuote, previewPdf }
}

export function createDefaultSendService() {
  return createSendService({
    storage: new LocalFileStorage(config.FILE_STORAGE_DIR),
    email: createEmailProvider(config),
  })
}

export type SendService = ReturnType<typeof createSendService>
