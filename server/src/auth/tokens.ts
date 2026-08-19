import { createHash, randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { config } from '../config.js'

const UNITS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }

export function parseDuration(input: string): number {
  const m = /^(\d+)([smhd])$/.exec(input)
  const value = m?.[1]
  const unit = m?.[2] as keyof typeof UNITS | undefined
  if (!value || !unit) throw new Error(`Invalid duration: ${input}`)
  return Number(value) * UNITS[unit]!
}

const key = () => new TextEncoder().encode(config.JWT_SECRET)

export function signAccessToken(sub: string, ttl: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(key())
}

export async function verifyAccessToken(token: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, key())
  if (!payload.sub) throw new Error('Missing subject')
  return { sub: payload.sub }
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
