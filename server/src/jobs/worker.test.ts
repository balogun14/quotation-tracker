import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from '../test/db.js'
import { signup } from '../auth/service.js'
import { createQuote } from '../quote/service.js'
import { createSendService } from '../quote/send.js'
import { createHandlers } from './handlers.js'
import { createWorker } from './worker.js'
import { enqueueJob } from './service.js'
import { LocalFileStorage } from '../files/storage.js'
import { ConsoleEmailProvider, type EmailProvider, type EmailMessage } from '../email/provider.js'
import { quotes, followUps, jobs } from '../db/schema.js'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

class CapturingEmail implements EmailProvider {
  sent: EmailMessage[] = []
  async send(m: EmailMessage) {
    this.sent.push(m)
  }
}

describe('worker', () => {
  const setup = async () => {
    const { db, close } = createTestDb()
    const email = new CapturingEmail()
    const { sendQuote } = createSendService({
      storage: new LocalFileStorage(mkdtempSync(join(tmpdir(), 'quotely-'))),
      email: new ConsoleEmailProvider(),
    })
    const worker = createWorker(db, createHandlers(email))
    const { user, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })
    return { db, close, email, sendQuote, worker, user, workspace }
  }

  const draft = {
    clientName: 'Amina',
    clientEmail: 'amina@x.co',
    serviceDescription: 'Hire',
    currency: 'NGN',
    items: [{ description: 'Chairs', quantity: 1, unitPriceMinor: 100 }],
  }

  it('sends a scheduled follow-up email when due', async () => {
    const { db, close, email, sendQuote, worker, user, workspace } = await setup()
    const quote = await createQuote(db, workspace.id, user.id, {
      ...draft,
      followUpMode: 'email',
      followUpDays: 1,
    })
    await sendQuote(db, workspace.id, user.id, quote.id)

    const followUps1 = await db.select().from(followUps)
    expect(followUps1).toHaveLength(1)
    expect(followUps1[0]?.kind).toBe('email')

    // fast-forward: the follow-up job is scheduled ~1 day out
    const [fu] = followUps1
    await db.update(jobs).set({ scheduledAt: new Date(Date.now() - 1000) })

    const handled = await worker.runOnce(new Date())
    expect(handled).toBeGreaterThanOrEqual(1)
    expect(email.sent.length).toBeGreaterThanOrEqual(1)

    const [updated] = await db.select().from(followUps).where(eq(followUps.id, fu!.id))
    expect(updated?.status).toBe('sent')
    close()
  })

  it('expires an overdue sent quote', async () => {
    const { db, close, sendQuote, worker, user, workspace } = await setup()
    const quote = await createQuote(db, workspace.id, user.id, draft)
    await sendQuote(db, workspace.id, user.id, quote.id)

    // set expiry in the past and enqueue an expire job
    await db.update(quotes).set({ expiryDate: new Date(Date.now() - 60_000) }).where(eq(quotes.id, quote.id))
    await enqueueJob(db, 'quote.expire', { quoteId: quote.id })

    await worker.runOnce(new Date())
    const [updated] = await db.select().from(quotes).where(eq(quotes.id, quote.id))
    expect(updated?.status).toBe('expired')
    close()
  })
})
