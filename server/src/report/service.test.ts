import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from '../test/db.js'
import { signup } from '../auth/service.js'
import { createQuote } from '../quote/service.js'
import { quotes } from '../db/schema.js'
import { report, exportQuotesCsv, csvCell, type ReportFilter } from './service.js'
import type { FxRateProvider } from '../fx/provider.js'
import type { QuoteInput } from '../quote/schema.js'

const fx: FxRateProvider = {
  getRate: async (base, quote) => ({ base, quote, rate: 2, precision: 2, rateDate: new Date(), source: 'frankfurter' }),
  overrideRate: async () => ({ base: '', quote: '', rate: 1, precision: 0, rateDate: new Date(), source: 'manual' }),
}

describe('report service', () => {
  const setup = async () => {
    const { db, close } = createTestDb()
    const { user, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })
    const make = (input: Partial<QuoteInput> & { currency: string; totalMinor: number }, status: string, sentAt?: Date) =>
      createQuote(db, workspace.id, user.id, {
        clientName: 'Client',
        serviceDescription: 'Hire',
        currency: input.currency,
        items: [{ description: 'X', quantity: 1, unitPriceMinor: input.totalMinor }],
        ...input,
      }).then(async (q) => {
        await db.update(quotes).set({ status: status as never, sentAt: sentAt ?? new Date() }).where(eq(quotes.id, q.id))
        return q.id
      })
    return { db, close, workspace, user, make }
  }

  it('groups dashboard totals by native currency', async () => {
    const { db, close, workspace, make } = await setup()
    await make({ currency: 'NGN', totalMinor: 1000 }, 'sent')
    await make({ currency: 'NGN', totalMinor: 2000 }, 'accepted')
    await make({ currency: 'USD', totalMinor: 3000 }, 'sent')

    const result = await report(db, workspace.id, {}, fx)
    expect(result.totalQuotes).toBe(3)
    expect(result.totalQuoted).toEqual([
      { currency: 'NGN', minor: 3000 },
      { currency: 'USD', minor: 3000 },
    ])
    expect(result.won).toEqual([{ currency: 'NGN', minor: 2000 }])
    expect(result.winRate).toBe(100)
    close()
  })

  it('computes win rate over closed quotes', async () => {
    const { db, close, workspace, make } = await setup()
    await make({ currency: 'NGN', totalMinor: 100 }, 'accepted')
    await make({ currency: 'NGN', totalMinor: 100 }, 'declined')
    await make({ currency: 'NGN', totalMinor: 100 }, 'expired')
    await make({ currency: 'NGN', totalMinor: 100 }, 'sent')

    const result = await report(db, workspace.id, {}, fx)
    expect(result.winRate).toBe(33.3)
    close()
  })

  it('converts to a reporting currency using pinned rates', async () => {
    const { db, close, workspace, make } = await setup()
    await make({ currency: 'USD', totalMinor: 1000 }, 'sent')

    const result = await report(db, workspace.id, { reportingCurrency: 'EUR' }, fx)
    expect(result.converted).toEqual({ currency: 'EUR', totalQuotedMinor: 2000, wonMinor: 0 })
    close()
  })

  it('filters by status and date range', async () => {
    const { db, close, workspace, make } = await setup()
    const recent = new Date('2026-08-01')
    await make({ currency: 'NGN', totalMinor: 100 }, 'sent', recent)
    await make({ currency: 'NGN', totalMinor: 100 }, 'accepted', new Date('2026-07-01'))

    const filtered: ReportFilter = { status: 'sent', from: new Date('2026-07-15') }
    const result = await report(db, workspace.id, filtered, fx)
    expect(result.totalQuotes).toBe(1)
    close()
  })

  it('exports CSV with proper escaping', async () => {
    const { db, close, workspace, make } = await setup()
    await make({ currency: 'NGN', totalMinor: 1000, clientName: 'Amina, Bello' }, 'sent')

    const csv = await exportQuotesCsv(db, workspace.id, {})
    expect(csv.split('\r\n')).toHaveLength(2)
    expect(csv).toContain('"Amina, Bello"')
    expect(csv).toContain('total_minor')
    close()
  })

  it('escapes quotes and newlines in cells', () => {
    expect(csvCell('a"b')).toBe('"a""b"')
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell(null)).toBe('')
  })
})
