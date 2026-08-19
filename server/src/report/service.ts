import { and, eq, gte, lte, sql } from 'drizzle-orm'
import type { TxDb } from '../db/index.js'
import { quotes, followUps, type Quote } from '../db/schema.js'
import { convertMinor } from '../domain/money.js'
import type { FxRateProvider } from '../fx/provider.js'

export interface ReportFilter {
  from?: Date
  to?: Date
  ownerId?: string
  status?: Quote['status']
  currency?: string
  reportingCurrency?: string
}

export interface CurrencyTotal {
  currency: string
  minor: number
}

export interface ReportResult {
  totalQuotes: number
  totalQuoted: CurrencyTotal[]
  won: CurrencyTotal[]
  winRate: number
  overdueFollowUps: number
  converted?: { currency: string; totalQuotedMinor: number; wonMinor: number }
}

const ACTIVE_STATUSES: Quote['status'][] = ['sent', 'followed_up', 'accepted', 'declined', 'expired']

function groupByCurrency(rows: { currency: string; totalMinor: number }[]): CurrencyTotal[] {
  const map = new Map<string, number>()
  for (const r of rows) map.set(r.currency, (map.get(r.currency) ?? 0) + r.totalMinor)
  return [...map.entries()]
    .map(([currency, minor]) => ({ currency, minor }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

async function loadQuotes(
  db: TxDb,
  workspaceId: string,
  filter: ReportFilter,
): Promise<Quote[]> {
  const conditions = [eq(quotes.workspaceId, workspaceId)]
  if (filter.status) conditions.push(eq(quotes.status, filter.status))
  if (filter.currency) conditions.push(eq(quotes.currency, filter.currency))
  if (filter.ownerId) conditions.push(eq(quotes.ownerId, filter.ownerId))
  if (filter.from) conditions.push(gte(quotes.sentAt, filter.from))
  if (filter.to) conditions.push(lte(quotes.sentAt, filter.to))
  return db
    .select()
    .from(quotes)
    .where(and(...conditions))
    .orderBy(sql`${quotes.createdAt} desc`)
}

export async function report(db: TxDb, workspaceId: string, filter: ReportFilter, fx: FxRateProvider): Promise<ReportResult> {
  const all = await loadQuotes(db, workspaceId, filter)

  const sent = all.filter((q) => ACTIVE_STATUSES.includes(q.status))
  const won = all.filter((q) => q.status === 'accepted')
  const closed = all.filter((q) => ['accepted', 'declined', 'expired'].includes(q.status))

  const overdue = await db
    .select({ id: followUps.id })
    .from(followUps)
    .innerJoin(quotes, eq(quotes.id, followUps.quoteId))
    .where(
      and(
        eq(quotes.workspaceId, workspaceId),
        eq(followUps.status, 'pending'),
        eq(followUps.kind, 'reminder'),
        sql`${followUps.dueAt} < ${Date.now()}`,
      ),
    )

  const result: ReportResult = {
    totalQuotes: all.length,
    totalQuoted: groupByCurrency(sent.map((q) => ({ currency: q.currency, totalMinor: q.totalMinor }))),
    won: groupByCurrency(won.map((q) => ({ currency: q.currency, totalMinor: q.totalMinor }))),
    winRate: closed.length === 0 ? 0 : Math.round((won.length / closed.length) * 1000) / 10,
    overdueFollowUps: overdue.length,
  }

  if (filter.reportingCurrency) {
    let totalQuotedMinor = 0
    let wonMinor = 0
    for (const q of sent) {
      const date = q.sentAt ?? q.createdAt
      const rate = await fx.getRate(q.currency, filter.reportingCurrency, date)
      totalQuotedMinor += convertMinor(q.totalMinor, q.currency, filter.reportingCurrency, rate.rate)
      if (q.status === 'accepted') {
        wonMinor += convertMinor(q.totalMinor, q.currency, filter.reportingCurrency, rate.rate)
      }
    }
    result.converted = { currency: filter.reportingCurrency, totalQuotedMinor, wonMinor }
  }

  return result
}

export function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function exportQuotesCsv(db: TxDb, workspaceId: string, filter: ReportFilter): Promise<string> {
  const rows = await loadQuotes(db, workspaceId, filter)
  const header = [
    'id',
    'client_name',
    'client_company',
    'client_email',
    'service',
    'status',
    'currency',
    'subtotal_minor',
    'discount_minor',
    'tax_minor',
    'total_minor',
    'sent_at',
    'expiry_date',
    'decided_at',
  ]
  const lines = [header.join(',')]
  for (const q of rows) {
    lines.push(
      [
        q.id,
        q.clientName,
        q.clientCompany ?? '',
        q.clientEmail ?? '',
        q.serviceDescription,
        q.status,
        q.currency,
        q.subtotalMinor,
        q.discountMinor,
        q.taxMinor,
        q.totalMinor,
        q.sentAt?.toISOString() ?? '',
        q.expiryDate?.toISOString() ?? '',
        q.decidedAt?.toISOString() ?? '',
      ]
        .map(csvCell)
        .join(','),
    )
  }
  return lines.join('\r\n')
}
