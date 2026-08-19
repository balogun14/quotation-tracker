import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { createTestDb } from '../test/db.js'
import { signup } from '../auth/service.js'
import { createQuote } from '../quote/service.js'
import { createSendService } from '../quote/send.js'
import { createPublicService } from './service.js'
import { LocalFileStorage } from '../files/storage.js'
import { ConsoleEmailProvider } from '../email/provider.js'
import { quotes, publicLinks } from '../db/schema.js'

describe('public link service', () => {
  const tempDirs: string[] = []
  afterEach(() => {
    for (const d of tempDirs) rmSync(d, { recursive: true, force: true })
    tempDirs.length = 0
  })

  const setup = async () => {
    const { db, close } = createTestDb()
    const dir = mkdtempSync(join(tmpdir(), 'quotely-'))
    tempDirs.push(dir)
    const { sendQuote } = createSendService({
      storage: new LocalFileStorage(dir),
      email: new ConsoleEmailProvider(),
    })
    const publicService = createPublicService(new LocalFileStorage(dir))
    const { user, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme Rentals',
    })
    return { db, close, sendQuote, publicService, user, workspace }
  }

  const draft = {
    clientName: 'Amina Bello',
    clientEmail: 'amina@brightpath.co',
    serviceDescription: 'Event furniture hire',
    currency: 'NGN',
    items: [{ description: 'Chairs', quantity: 10, unitPriceMinor: 5000 }],
  }

  it('resolves a public link to an immutable snapshot', async () => {
    const { db, close, sendQuote, publicService, user, workspace } = await setup()
    const quote = await createQuote(db, workspace.id, user.id, draft)
    const { publicToken } = await sendQuote(db, workspace.id, user.id, quote.id)

    const view = await publicService.getPublicQuote(db, publicToken)
    expect(view.snapshot.workspace.businessName).toBe('Acme Rentals')
    expect(view.snapshot.items).toHaveLength(1)
    expect(view.status).toBe('sent')

    const pdf = await publicService.getPublicPdf(db, publicToken)
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
    close()
  })

  it('rejects an invalid token', async () => {
    const { db, close, publicService } = await setup()
    await expect(publicService.getPublicQuote(db, 'bogus-token')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    close()
  })

  it('records a customer decision and marks the quote accepted', async () => {
    const { db, close, sendQuote, publicService, user, workspace } = await setup()
    const quote = await createQuote(db, workspace.id, user.id, draft)
    const { publicToken } = await sendQuote(db, workspace.id, user.id, quote.id)

    await publicService.decide(db, publicToken, {
      decision: 'accepted',
      recipientName: 'Amina Bello',
      recipientEmail: 'amina@brightpath.co',
    })

    const [updated] = await db.select().from(quotes).where(eq(quotes.id, quote.id))
    expect(updated?.status).toBe('accepted')
    expect(updated?.decidedAt).toBeTruthy()

    // the used link is now revoked
    const links = await db.select().from(publicLinks)
    expect(links[0]?.revokedAt).toBeTruthy()

    await expect(
      publicService.decide(db, publicToken, { decision: 'declined' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    close()
  })

  it('revokes all links for a quote on member request', async () => {
    const { db, close, sendQuote, publicService, user, workspace } = await setup()
    const quote = await createQuote(db, workspace.id, user.id, draft)
    const { publicToken } = await sendQuote(db, workspace.id, user.id, quote.id)

    const count = await publicService.revokeQuoteLinks(db, workspace.id, user.id, quote.id)
    expect(count).toBe(1)

    await expect(publicService.getPublicQuote(db, publicToken)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    close()
  })
})
