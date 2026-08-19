import { describe, it, expect } from 'vitest'
import { computeTotals, discountMinor, subtotalMinor, lineItemTotal } from './money.js'

describe('money', () => {
  it('sums line items in minor units', () => {
    expect(lineItemTotal(3, 1000)).toBe(3000)
    expect(subtotalMinor([{ quantity: 2, unitPriceMinor: 150 }, { quantity: 1, unitPriceMinor: 700 }])).toBe(1000)
  })

  it('applies a flat discount capped at subtotal', () => {
    expect(discountMinor(1000, 'amount', 250)).toBe(250)
    expect(discountMinor(1000, 'amount', 5000)).toBe(1000)
  })

  it('applies a percent discount in basis points', () => {
    expect(discountMinor(1000, 'percent', 1000)).toBe(100)
    expect(discountMinor(999, 'percent', 500)).toBe(50)
  })

  it('returns zero discount when type or value is empty', () => {
    expect(discountMinor(1000, null, 0)).toBe(0)
    expect(discountMinor(1000, 'percent', 0)).toBe(0)
  })

  it('computes totals: subtotal - discount + tax', () => {
    const totals = computeTotals([{ quantity: 2, unitPriceMinor: 500 }], 'percent', 1000, 750)
    expect(totals).toEqual({ subtotalMinor: 1000, discountMinor: 100, taxMinor: 68, totalMinor: 968 })
  })
})
