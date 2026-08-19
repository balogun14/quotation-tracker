import { and, eq } from 'drizzle-orm'
import type { TxDb } from '../db/index.js'
import { fxRates } from '../db/schema.js'
import { config } from '../config.js'

export interface FxRate {
  base: string
  quote: string
  rate: number
  precision: number
  rateDate: Date
  source: 'frankfurter' | 'manual'
  reason?: string | null
}

export function dayKey(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function dateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function decimalPlaces(value: string): number {
  const [ , frac ] = value.split('.')
  return frac?.length ?? 0
}

export async function fetchFrankfurter(
  base: string,
  quote: string,
  date: Date,
  baseUrl: string = config.FX_BASE_URL,
): Promise<{ rate: number; precision: number }> {
  const url = `${baseUrl}/${dateString(date)}?from=${base}&to=${quote}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`FX fetch failed (${res.status}) for ${base}/${quote}`)
  const data = (await res.json()) as { rates?: Record<string, number> }
  const rate = data.rates?.[quote]
  if (typeof rate !== 'number') throw new Error(`No ${quote} rate for ${base} on ${dateString(date)}`)
  return { rate, precision: decimalPlaces(String(rate)) }
}

export function createFxRateProvider(db: TxDb) {
  async function getRate(base: string, quote: string, date: Date): Promise<FxRate> {
    const day = dayKey(date)
    if (base === quote) {
      return { base, quote, rate: 1, precision: 0, rateDate: day, source: 'frankfurter' }
    }

    const cached = await db
      .select()
      .from(fxRates)
      .where(
        and(
          eq(fxRates.baseCurrency, base),
          eq(fxRates.quoteCurrency, quote),
          eq(fxRates.rateDate, day),
        ),
      )
      .limit(1)
    if (cached[0]) {
      return {
        base,
        quote,
        rate: Number(cached[0].rate),
        precision: cached[0].precision,
        rateDate: cached[0].rateDate,
        source: cached[0].source,
        reason: cached[0].reason,
      }
    }

    const fetched = await fetchFrankfurter(base, quote, date)
    await db.insert(fxRates).values({
      baseCurrency: base,
      quoteCurrency: quote,
      rate: String(fetched.rate),
      precision: fetched.precision,
      rateDate: day,
      source: 'frankfurter',
    })
    return { base, quote, rate: fetched.rate, precision: fetched.precision, rateDate: day, source: 'frankfurter' }
  }

  async function overrideRate(
    actorId: string,
    base: string,
    quote: string,
    date: Date,
    rate: number,
    reason: string,
  ): Promise<FxRate> {
    const day = dayKey(date)
    const precision = decimalPlaces(String(rate))
    await db
      .insert(fxRates)
      .values({
        baseCurrency: base,
        quoteCurrency: quote,
        rate: String(rate),
        precision,
        rateDate: day,
        source: 'manual',
        reason,
        actorId,
      })
      .onConflictDoUpdate({
        target: [fxRates.baseCurrency, fxRates.quoteCurrency, fxRates.rateDate],
        set: { rate: String(rate), precision, source: 'manual', reason, actorId },
      })
    return { base, quote, rate, precision, rateDate: day, source: 'manual', reason }
  }

  return { getRate, overrideRate }
}

export type FxRateProvider = ReturnType<typeof createFxRateProvider>
