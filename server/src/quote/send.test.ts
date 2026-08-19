import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestDb } from '../test/db.js'
import { signup } from '../auth/service.js'
import { createQuote, getQuote } from './service.js'
import { createSendService } from './send.js'
import { LocalFileStorage } from '../files/storage.js'
import type { EmailProvider, EmailMessage } from '../email/provider.js'
import { quoteVersions, publicLinks, quotes } from '../db/schema.js'
import { eq } from 'drizzle-orm'

class FakeEmail implements EmailProvider {
  sent: EmailMessage[] = []
  async send(message: EmailMessage) {
    this.sent.push(message)
  }
}

describe('send service', () => {
  const tempDirs: string[] = []
  afterEach(() => {
    for (const d of tempDirs) rmSync(d, { recursive: true, force: true })
    tempDirs.length = 0
  })

  const setup = async () => {
    const { db, close } = createTestDb()
    const dir = mkdtempSync(join(tmpdir(), 'quotely-'))
    tempDirs.push(dir)
    const email = new FakeEmail()
    const { sendQuote, previewPdf } = createSendService({
      storage: new LocalFileStorage(dir),
      email,
    })
    const { user, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme Rentals',
    })
    return { db, close, dir, email, sendQuote, previewPdf, user, workspace }
  }

  const draft = {
    clientName: 'Amina Bello',
    clientEmail: 'amina@brightpath.co',
    serviceDescription: 'Event furniture hire',
    currency: 'NGN',
    items: [{ description: 'Chairs', quantity: 10, unitPriceMinor: 5000 }],
  }

  it('sends a quote: creates version, pdf, public link, and emails', async () => {
    const { db, close, dir, email, sendQuote, user, workspace } = await setup()
    const quote = await createQuote(db, workspace.id, user.id, draft)

    const result = await sendQuote(db, workspace.id, user.id, quote.id)

    expect(result.versionNumber).toBe(1)
    expect(result.publicToken).toBeTruthy()

    const updated = await getQuote(db, workspace.id, quote.id)
    expect(updated.status).toBe('sent')
    expect(updated.sentAt).toBeTruthy()

    const versions = await db.select().from(quoteVersions).where(eq(quoteVersions.quoteId, quote.id))
    expect(versions).toHaveLength(1)
    expect(JSON.parse(versions[0]!.snapshotJson).versionNumber).toBe(1)

    const links = await db.select().from(publicLinks)
    expect(links).toHaveLength(1)
    expect(links[0]!.tokenHash).not.toBe(result.publicToken)

    expect(email.sent).toHaveLength(1)
    expect(email.sent[0]!.to).toBe('amina@brightpath.co')
    expect(email.sent[0]!.text).toContain(result.publicUrl)
    close()
  })

  it('creates a new version on re-send without rewriting the first', async () => {
    const { db, close, sendQuote, user, workspace } = await setup()
    const quote = await createQuote(db, workspace.id, user.id, draft)

    const first = await sendQuote(db, workspace.id, user.id, quote.id)
    const second = await sendQuote(db, workspace.id, user.id, quote.id)

    expect(second.versionNumber).toBe(2)
    const versions = await db.select().from(quoteVersions).where(eq(quoteVersions.quoteId, quote.id))
    expect(versions).toHaveLength(2)
    expect(first.publicToken).not.toBe(second.publicToken)
    close()
  })

  it('refuses to send a terminal quote', async () => {
    const { db, close, sendQuote, user, workspace } = await setup()
    const quote = await createQuote(db, workspace.id, user.id, draft)
    await sendQuote(db, workspace.id, user.id, quote.id)
    // decline via direct status set to a terminal state
    await db.update(quotes).set({ status: 'declined' }).where(eq(quotes.id, quote.id))

    await expect(sendQuote(db, workspace.id, user.id, quote.id)).rejects.toMatchObject({
      code: 'CONFLICT',
    })
    close()
  })

  it('renders a preview pdf without creating a version', async () => {
    const { db, close, previewPdf, user, workspace } = await setup()
    const quote = await createQuote(db, workspace.id, user.id, draft)
    const pdf = await previewPdf(db, workspace.id, user.id, quote.id)
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
    const versions = await db.select().from(quoteVersions).where(eq(quoteVersions.quoteId, quote.id))
    expect(versions).toHaveLength(0)
    close()
  })
})
