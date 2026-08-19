export function isCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code)
}
