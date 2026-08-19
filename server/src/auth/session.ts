import { and, eq, isNull } from 'drizzle-orm'
import type { TxDb } from '../db/index.js'
import { refreshSessions } from '../db/schema.js'
import { config } from '../config.js'
import { generateRefreshToken, hashToken, parseDuration } from './tokens.js'

export interface Session {
  sessionId: string
  refreshToken: string
  expiresAt: Date
}

export function createSession(db: TxDb, userId: string, userAgent?: string): Promise<Session> {
  const refreshToken = generateRefreshToken()
  const expiresAt = new Date(Date.now() + parseDuration(config.REFRESH_TOKEN_TTL))
  return db
    .insert(refreshSessions)
    .values({ userId, tokenHash: hashToken(refreshToken), expiresAt, userAgent })
    .returning({ id: refreshSessions.id })
    .then((rows) => {
      const row = rows[0]
      if (!row) throw new Error('Failed to create session')
      return { sessionId: row.id, refreshToken, expiresAt }
    })
}

export async function findValidSession(db: TxDb, refreshToken: string) {
  const rows = await db
    .select()
    .from(refreshSessions)
    .where(
      and(
        eq(refreshSessions.tokenHash, hashToken(refreshToken)),
        isNull(refreshSessions.revokedAt),
      ),
    )
    .limit(1)
  const session = rows[0]
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) return null
  return session
}

export function revokeSession(db: TxDb, sessionId: string) {
  return db
    .update(refreshSessions)
    .set({ revokedAt: new Date() })
    .where(eq(refreshSessions.id, sessionId))
}

export function revokeAllForUser(db: TxDb, userId: string) {
  return db
    .update(refreshSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshSessions.userId, userId), isNull(refreshSessions.revokedAt)))
}
