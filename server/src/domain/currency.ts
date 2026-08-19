export function isCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code)
}

const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF',
  'UGX', 'UYI', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

export function currencyMinorExponent(code: string): number {
  return ZERO_DECIMAL.has(code) ? 0 : 2
}
