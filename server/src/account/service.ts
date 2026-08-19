import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '../db/index.js'
import { users, passwordResets, emailVerifications } from '../db/schema.js'
import { errors } from '../errors.js'
import { hashPassword } from '../auth/password.js'
import { revokeAllForUser } from '../auth/session.js'
import { randomToken, hashToken } from '../security/tokens.js'

const RESET_TTL_MS = 60 * 60_000
const VERIFY_TTL_MS = 48 * 60 * 60_000

export async function requestPasswordReset(db: Db, email: string): Promise<{ token: string; email: string } | null> {
  const user = (
    await db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1)
  )[0]
  if (!user) return null

  const token = randomToken(32)
  await db.insert(passwordResets).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  })
  return { token, email: user.email }
}

export async function resetPassword(db: Db, token: string, newPassword: string): Promise<void> {
  const row = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, hashToken(token)), isNull(passwordResets.usedAt)))
    .limit(1)
  const reset = row[0]
  if (!reset) throw errors.tokenInvalid()
  if (reset.expiresAt.getTime() < Date.now()) throw errors.tokenInvalid('Reset link has expired')

  const passwordHash = await hashPassword(newPassword)
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, reset.userId))
    await tx
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(eq(passwordResets.id, reset.id))
    await revokeAllForUser(tx, reset.userId)
  })
}

export async function createEmailVerification(db: Db, userId: string): Promise<{ token: string; email: string }> {
  const user = (
    await db
      .select({ id: users.id, email: users.email, emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
  )[0]
  if (!user) throw errors.notFound('User not found')

  const token = randomToken(32)
  await db.insert(emailVerifications).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
  })
  return { token, email: user.email }
}

export async function verifyEmail(db: Db, token: string): Promise<void> {
  const row = await db
    .select()
    .from(emailVerifications)
    .where(and(eq(emailVerifications.tokenHash, hashToken(token)), isNull(emailVerifications.usedAt)))
    .limit(1)
  const verification = row[0]
  if (!verification) throw errors.tokenInvalid()
  if (verification.expiresAt.getTime() < Date.now()) throw errors.tokenInvalid('Verification link has expired')

  await db.transaction(async (tx) => {
    await tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, verification.userId))
    await tx
      .update(emailVerifications)
      .set({ usedAt: new Date() })
      .where(eq(emailVerifications.id, verification.id))
  })
}