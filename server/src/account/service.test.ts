import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from '../test/db.js'
import { signup, login } from '../auth/service.js'
import { requestPasswordReset, resetPassword, createEmailVerification, verifyEmail } from './service.js'
import { users, emailVerifications } from '../db/schema.js'

describe('password reset', () => {
  it('issues a token and lets the user reset the password', async () => {
    const { db, close } = createTestDb()
    const { user } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })

    const reset = await requestPasswordReset(db, 'owner@example.com')
    expect(reset?.token).toBeTruthy()

    await resetPassword(db, reset!.token, 'newpassword9')
    await expect(login(db, 'owner@example.com', 'pw123456')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    const result = await login(db, 'owner@example.com', 'newpassword9')
    expect(result.user.id).toBe(user.id)
    close()
  })

  it('returns null for an unknown email without leaking existence', async () => {
    const { db, close } = createTestDb()
    expect(await requestPasswordReset(db, 'nobody@example.com')).toBeNull()
    close()
  })

  it('rejects an invalid reset token', async () => {
    const { db, close } = createTestDb()
    await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })
    await expect(resetPassword(db, 'bad-token', 'newpassword9')).rejects.toMatchObject({ code: 'TOKEN_INVALID' })
    close()
  })
})

describe('email verification', () => {
  it('marks the email verified after confirming the token', async () => {
    const { db, close } = createTestDb()
    const { user } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })

    const verification = await createEmailVerification(db, user.id)
    expect(verification.email).toBe('owner@example.com')

    await verifyEmail(db, verification.token)
    const [updated] = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
    expect(updated?.emailVerifiedAt).toBeTruthy()

    // token is single-use
    await expect(verifyEmail(db, verification.token)).rejects.toMatchObject({ code: 'TOKEN_INVALID' })
    close()
  })

  it('rejects an expired verification token', async () => {
    const { db, close } = createTestDb()
    const { user } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })
    const verification = await createEmailVerification(db, user.id)
    await db
      .update(emailVerifications)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(emailVerifications.userId, user.id))

    await expect(verifyEmail(db, verification.token)).rejects.toMatchObject({ code: 'TOKEN_INVALID' })
    close()
  })
})