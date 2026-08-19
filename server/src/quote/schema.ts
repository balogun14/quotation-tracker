import { z } from 'zod'
import { errors } from '../errors.js'

const optionalTrimmed = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().max(200).optional(),
)

export const lineItemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.number().int().positive().max(1_000_000),
  unitPriceMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
})

export const quoteInputSchema = z.object({
  clientName: z.string().trim().min(1).max(200),
  clientCompany: optionalTrimmed,
  clientEmail: z.string().trim().email().optional(),
  clientPhone: optionalTrimmed,
  serviceDescription: z.string().trim().min(1).max(2000),
  notes: z.string().trim().max(5000).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  expiryDate: z.coerce.date().optional(),
  discountType: z.enum(['percent', 'amount']).nullable().optional(),
  discountValue: z.number().int().min(0).default(0),
  taxRateBps: z.number().int().min(0).max(10_000).default(0),
  followUpMode: z.enum(['reminder', 'email', 'none']).default('reminder'),
  followUpDays: z.number().int().positive().optional(),
  items: z.array(lineItemSchema).min(1).max(200),
})

export const quoteUpdateSchema = quoteInputSchema

export const quoteFilterSchema = z.object({
  status: z.enum(['draft', 'sent', 'followed_up', 'accepted', 'declined', 'expired', 'cancelled']).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  ownerId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
})

export type QuoteInput = z.infer<typeof quoteInputSchema>
export type QuoteFilter = z.infer<typeof quoteFilterSchema>

export function parseQuoteInput(data: unknown): QuoteInput {
  const result = quoteInputSchema.safeParse(data)
  if (!result.success) throw errors.validation('Invalid quote input', result.error.flatten().fieldErrors)
  return result.data
}

export function parseQuoteFilter(data: unknown): QuoteFilter {
  const result = quoteFilterSchema.safeParse(data)
  if (!result.success) throw errors.validation('Invalid query parameters', result.error.flatten().fieldErrors)
  return result.data
}
