import { currencyMinorExponent } from './currency.js'

export type MoneyMinor = number

export type DiscountType = 'percent' | 'amount'

export interface LineItem {
  quantity: number
  unitPriceMinor: MoneyMinor
}

const round = (n: number) => Math.round(n)

export function lineItemTotal(quantity: number, unitPriceMinor: MoneyMinor): MoneyMinor {
  return quantity * unitPriceMinor
}

export function subtotalMinor(items: LineItem[]): MoneyMinor {
  return items.reduce((sum, item) => sum + lineItemTotal(item.quantity, item.unitPriceMinor), 0)
}

export function discountMinor(
  subtotal: MoneyMinor,
  type: DiscountType | null,
  value: MoneyMinor,
): MoneyMinor {
  if (type === null || value <= 0) return 0
  if (type === 'amount') return Math.min(value, subtotal)
  return round((subtotal * value) / 10000)
}

export interface Totals {
  subtotalMinor: MoneyMinor
  discountMinor: MoneyMinor
  taxMinor: MoneyMinor
  totalMinor: MoneyMinor
}

export function computeTotals(
  items: LineItem[],
  discountType: DiscountType | null,
  discountValue: MoneyMinor,
  taxRateBps: number,
): Totals {
  const subtotal = subtotalMinor(items)
  const discount = discountMinor(subtotal, discountType, discountValue)
  const taxableBase = subtotal - discount
  const tax = round((taxableBase * taxRateBps) / 10000)
  const total = taxableBase + tax
  return { subtotalMinor: subtotal, discountMinor: discount, taxMinor: tax, totalMinor: total }
}

export function formatMinor(minor: MoneyMinor, code: string): string {
  const exp = currencyMinorExponent(code)
  const major = minor / 10 ** exp
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  }).format(major)
}
