import { and, eq, gte, lte, or, sql } from 'drizzle-orm'
import type { TxDb } from '../db/index.js'
import { quotes, quoteItems, type Quote, type QuoteItem } from '../db/schema.js'
import { errors } from '../errors.js'
import { computeTotals } from '../domain/money.js'
import { canTransition } from '../domain/lifecycle.js'
import { requireMember } from '../workspace/service.js'
import { parseQuoteInput, parseQuoteFilter, type QuoteInput } from './schema.js'

export interface QuoteWithItems extends Quote {
  items: QuoteItem[]
}

const toTotals = (input: QuoteInput) =>
  computeTotals(input.items, input.discountType ?? null, input.discountValue, input.taxRateBps)

function itemValues(quoteId: string, input: QuoteInput) {
  return input.items.map((item, position) => ({
    quoteId,
    position,
    description: item.description,
    quantity: item.quantity,
    unitPriceMinor: item.unitPriceMinor,
  }))
}

async function withItems(db: TxDb, quote: Quote): Promise<QuoteWithItems> {
  const items = await db
    .select()
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, quote.id))
    .orderBy(quoteItems.position)
  return { ...quote, items }
}

export async function createQuote(
  db: TxDb,
  workspaceId: string,
  actorId: string,
  rawInput: unknown,
): Promise<QuoteWithItems> {
  const input = parseQuoteInput(rawInput)
  await requireMember(db, workspaceId, actorId)
  const totals = toTotals(input)

  return db.transaction(async (tx) => {
    const [quote] = await tx
      .insert(quotes)
      .values({
        workspaceId,
        ownerId: actorId,
        clientName: input.clientName,
        clientCompany: input.clientCompany,
        clientEmail: input.clientEmail,
        clientPhone: input.clientPhone,
        serviceDescription: input.serviceDescription,
        notes: input.notes,
        currency: input.currency,
        expiryDate: input.expiryDate,
        discountType: input.discountType,
        discountValue: input.discountValue,
        taxRateBps: input.taxRateBps,
        subtotalMinor: totals.subtotalMinor,
        discountMinor: totals.discountMinor,
        taxMinor: totals.taxMinor,
        totalMinor: totals.totalMinor,
        followUpMode: input.followUpMode,
        followUpDays: input.followUpDays,
      })
      .returning()
    if (!quote) throw new Error('Failed to create quote')

    await tx.insert(quoteItems).values(itemValues(quote.id, input))
    return withItems(tx, quote)
  })
}

export async function getQuote(
  db: TxDb,
  workspaceId: string,
  quoteId: string,
): Promise<QuoteWithItems> {
  const quote = (await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.workspaceId, workspaceId)))
    .limit(1))[0]
  if (!quote) throw errors.notFound('Quote not found')
  return withItems(db, quote)
}

export async function updateQuote(
  db: TxDb,
  workspaceId: string,
  actorId: string,
  quoteId: string,
  rawInput: unknown,
): Promise<QuoteWithItems> {
  const input = parseQuoteInput(rawInput)
  await requireMember(db, workspaceId, actorId)
  const quote = await getQuote(db, workspaceId, quoteId)
  if (quote.status !== 'draft') throw errors.conflict('Only draft quotes can be edited')

  const totals = toTotals(input)

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(quotes)
      .set({
        clientName: input.clientName,
        clientCompany: input.clientCompany,
        clientEmail: input.clientEmail,
        clientPhone: input.clientPhone,
        serviceDescription: input.serviceDescription,
        notes: input.notes,
        currency: input.currency,
        expiryDate: input.expiryDate,
        discountType: input.discountType,
        discountValue: input.discountValue,
        taxRateBps: input.taxRateBps,
        subtotalMinor: totals.subtotalMinor,
        discountMinor: totals.discountMinor,
        taxMinor: totals.taxMinor,
        totalMinor: totals.totalMinor,
        followUpMode: input.followUpMode,
        followUpDays: input.followUpDays,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, quoteId))
      .returning()
    if (!updated) throw errors.notFound('Quote not found')

    await tx.delete(quoteItems).where(eq(quoteItems.quoteId, quoteId))
    await tx.insert(quoteItems).values(itemValues(quoteId, input))
    return withItems(tx, updated)
  })
}

export async function cancelQuote(
  db: TxDb,
  workspaceId: string,
  actorId: string,
  quoteId: string,
): Promise<QuoteWithItems> {
  await requireMember(db, workspaceId, actorId)
  const quote = await getQuote(db, workspaceId, quoteId)
  if (!canTransition(quote.status, 'cancelled')) {
    throw errors.conflict(`Cannot cancel a ${quote.status} quote`)
  }
  const [updated] = await db
    .update(quotes)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(quotes.id, quoteId))
    .returning()
  if (!updated) throw errors.notFound('Quote not found')
  return withItems(db, updated)
}

const encodeCursor = (createdAt: Date, id: string) =>
  Buffer.from(`${createdAt.getTime()}:${id}`).toString('base64url')

const decodeCursor = (cursor: string) => {
  const [ms, id] = Buffer.from(cursor, 'base64url').toString().split(':')
  if (!ms || !id) throw errors.validation('Invalid cursor')
  return { createdAt: new Date(Number(ms)), id }
}

export interface QuotePage {
  items: QuoteWithItems[]
  nextCursor: string | null
}

export async function listQuotes(
  db: TxDb,
  workspaceId: string,
  rawFilter: unknown,
): Promise<QuotePage> {
  const filter = parseQuoteFilter(rawFilter ?? {})
  const limit = filter.limit
  const conditions = [eq(quotes.workspaceId, workspaceId)]
  if (filter.status) conditions.push(eq(quotes.status, filter.status))
  if (filter.currency) conditions.push(eq(quotes.currency, filter.currency))
  if (filter.ownerId) conditions.push(eq(quotes.ownerId, filter.ownerId))
  if (filter.from) conditions.push(gte(quotes.createdAt, filter.from))
  if (filter.to) conditions.push(lte(quotes.createdAt, filter.to))
  if (filter.cursor) {
    const { createdAt, id } = decodeCursor(filter.cursor)
    conditions.push(
      or(
        sql`${quotes.createdAt} < ${createdAt.getTime()}`,
        and(eq(quotes.createdAt, createdAt), sql`${quotes.id} < ${id}`),
      )!,
    )
  }

  const rows = await db
    .select()
    .from(quotes)
    .where(and(...conditions))
    .orderBy(sql`${quotes.createdAt} desc`, sql`${quotes.id} desc`)
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const last = page[page.length - 1]

  const withItemsRows = await Promise.all(page.map((q) => withItems(db, q)))

  return {
    items: withItemsRows,
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
  }
}
