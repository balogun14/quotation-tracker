import { describe, it, expect } from 'vitest'
import { createTestDb } from '../test/db.js'
import { signup } from '../auth/service.js'
import { createQuote, getQuote, listQuotes, updateQuote, cancelQuote } from './service.js'
import type { QuoteInput } from './schema.js'

const baseInput: QuoteInput = {
  clientName: 'Amina Bello',
  clientCompany: 'BrightPath Events',
  clientEmail: 'amina@brightpath.co',
  serviceDescription: 'Event furniture hire',
  currency: 'NGN',
  items: [
    { description: 'Chairs', quantity: 10, unitPriceMinor: 5000 },
    { description: 'Tables', quantity: 2, unitPriceMinor: 15000 },
  ],
}

describe('quote service', () => {
  const setup = async () => {
    const { db, close } = createTestDb()
    const { user, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })
    return { db, close, user, workspace }
  }

  it('creates a draft quote with server-computed totals', async () => {
    const { db, close, user, workspace } = await setup()
    const quote = await createQuote(db, workspace.id, user.id, {
      ...baseInput,
      taxRateBps: 750,
    })
    // subtotal = 10*5000 + 2*15000 = 80000; tax 7.5% = 6000
    expect(quote.status).toBe('draft')
    expect(quote.subtotalMinor).toBe(80000)
    expect(quote.taxMinor).toBe(6000)
    expect(quote.totalMinor).toBe(86000)
    expect(quote.items).toHaveLength(2)
    close()
  })

  it('applies percent discount before tax', async () => {
    const { db, close, user, workspace } = await setup()
    const quote = await createQuote(db, workspace.id, user.id, {
      ...baseInput,
      discountType: 'percent',
      discountValue: 1000,
      taxRateBps: 750,
    })
    // subtotal 80000, discount 10% = 8000, taxable 72000, tax 7.5% = 5400, total 77400
    expect(quote.discountMinor).toBe(8000)
    expect(quote.taxMinor).toBe(5400)
    expect(quote.totalMinor).toBe(77400)
    close()
  })

  it('updates a draft and recomputes totals, reordering items', async () => {
    const { db, close, user, workspace } = await setup()
    const quote = await createQuote(db, workspace.id, user.id, baseInput)

    const updated = await updateQuote(db, workspace.id, user.id, quote.id, {
      ...baseInput,
      items: [
        { description: 'Tables', quantity: 2, unitPriceMinor: 15000 },
        { description: 'Chairs', quantity: 5, unitPriceMinor: 5000 },
      ],
    })
    expect(updated.subtotalMinor).toBe(55000)
    expect(updated.items[0]?.position).toBe(0)
    expect(updated.items[0]?.description).toBe('Tables')
    close()
  })

  it('rejects editing a non-draft quote', async () => {
    const { db, close, user, workspace } = await setup()
    const quote = await createQuote(db, workspace.id, user.id, baseInput)
    await cancelQuote(db, workspace.id, user.id, quote.id)

    await expect(updateQuote(db, workspace.id, user.id, quote.id, baseInput)).rejects.toMatchObject({
      code: 'CONFLICT',
    })
    close()
  })

  it('paginates quotes by cursor', async () => {
    const { db, close, user, workspace } = await setup()
    for (let i = 0; i < 5; i++) {
      await createQuote(db, workspace.id, user.id, {
        ...baseInput,
        clientName: `Client ${i}`,
      })
    }

    const page1 = await listQuotes(db, workspace.id, { limit: 2 })
    expect(page1.items).toHaveLength(2)
    expect(page1.nextCursor).toBeTruthy()

    const page2 = await listQuotes(db, workspace.id, { limit: 2, cursor: page1.nextCursor! })
    expect(page2.items).toHaveLength(2)
    expect(page2.items.map((q) => q.id)).not.toContain(page1.items[0]!.id)

    const page3 = await listQuotes(db, workspace.id, { limit: 2, cursor: page2.nextCursor! })
    expect(page3.items).toHaveLength(1)
    expect(page3.nextCursor).toBeNull()
    close()
  })

  it('filters by status', async () => {
    const { db, close, user, workspace } = await setup()
    const q = await createQuote(db, workspace.id, user.id, baseInput)
    await cancelQuote(db, workspace.id, user.id, q.id)

    const drafts = await listQuotes(db, workspace.id, { status: 'draft', limit: 25 })
    const cancelled = await listQuotes(db, workspace.id, { status: 'cancelled', limit: 25 })
    expect(drafts.items).toHaveLength(0)
    expect(cancelled.items).toHaveLength(1)
    close()
  })
})
