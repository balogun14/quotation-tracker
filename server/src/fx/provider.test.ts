import { describe, it, expect, vi, afterEach } from 'vitest'
import { createTestDb } from '../test/db.js'
import { createFxRateProvider, dayKey, decimalPlaces, dateString } from './provider.js'
import { convertMinor } from '../domain/money.js'

describe('fx provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalizes dates and counts decimals', () => {
    expect(dayKey(new Date('2026-08-19T15:30:00Z')).toISOString()).toBe('2026-08-19T00:00:00.000Z')
    expect(dateString(new Date('2026-08-19T00:00:00Z'))).toBe('2026-08-19')
    expect(decimalPlaces('1.086')).toBe(3)
    expect(decimalPlaces('1')).toBe(0)
  })

  it('returns identity rate for same currency without fetching', async () => {
    const { db, close } = createTestDb()
    const fx = createFxRateProvider(db)
    const rate = await fx.getRate('NGN', 'NGN', new Date('2026-08-19'))
    expect(rate.rate).toBe(1)
    close()
  })

  it('fetches and caches a rate, hitting the network once', async () => {
    const { db, close } = createTestDb()
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ rates: { USD: 1.086 } }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const fx = createFxRateProvider(db)
    const a = await fx.getRate('EUR', 'USD', new Date('2026-08-19'))
    expect(a.rate).toBe(1.086)
    expect(a.precision).toBe(3)

    const b = await fx.getRate('EUR', 'USD', new Date('2026-08-19'))
    expect(b.rate).toBe(1.086)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    close()
  })

  it('stores a manual override that wins over the cached rate', async () => {
    const { db, close } = createTestDb()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ rates: { USD: 1.086 } }) })))
    const fx = createFxRateProvider(db)
    await fx.getRate('EUR', 'USD', new Date('2026-08-19'))

    await fx.overrideRate('actor', 'EUR', 'USD', new Date('2026-08-19'), 1.5, 'commercial rate')
    const rate = await fx.getRate('EUR', 'USD', new Date('2026-08-19'))
    expect(rate.rate).toBe(1.5)
    expect(rate.source).toBe('manual')
    expect(rate.reason).toBe('commercial rate')
    close()
  })
})

describe('convertMinor', () => {
  it('converts across currencies using minor exponents', () => {
    // 5000 USD (minor) = $50.00 * 1.5 = $75.00 = 7500 minor
    expect(convertMinor(5000, 'USD', 'EUR', 1.5)).toBe(7500)
    // same currency is identity
    expect(convertMinor(5000, 'USD', 'USD', 2)).toBe(5000)
  })
})
