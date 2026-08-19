import { describe, it, expect } from 'vitest'
import { createTestDb } from '../test/db.js'
import { signup, login, refresh, logout } from './service.js'
import { errors } from '../errors.js'

describe('auth service', () => {
  it('signs up a user, creating a workspace with owner membership', async () => {
    const { db, close } = createTestDb()
    const result = await signup(db, {
      name: 'Ada Lovelace',
      email: 'ADA@example.com',
      password: 'correct horse',
      businessName: 'Lovelace Rentals',
    })

    expect(result.user.email).toBe('ada@example.com')
    expect(result.workspace.businessName).toBe('Lovelace Rentals')
    expect(result.accessToken).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
    close()
  })

  it('rejects duplicate signup emails', async () => {
    const { db, close } = createTestDb()
    const input = { name: 'A', email: 'a@example.com', password: 'pw123456', businessName: 'Biz' }
    await signup(db, input)
    await expect(signup(db, input)).rejects.toMatchObject({ code: 'EMAIL_TAKEN' })
    close()
  })

  it('logs in with correct credentials and rejects wrong password', async () => {
    const { db, close } = createTestDb()
    await signup(db, { name: 'A', email: 'a@example.com', password: 'pw123456', businessName: 'Biz' })

    await expect(login(db, 'a@example.com', 'wrong')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })

    const result = await login(db, 'a@example.com', 'pw123456')
    expect(result.accessToken).toBeTruthy()
    close()
  })

  it('rotates refresh tokens and invalidates the old one', async () => {
    const { db, close } = createTestDb()
    const { refreshToken } = await signup(db, {
      name: 'A',
      email: 'a@example.com',
      password: 'pw123456',
      businessName: 'Biz',
    })

    const rotated = await refresh(db, refreshToken)
    expect(rotated.refreshToken).not.toBe(refreshToken)

    await expect(refresh(db, refreshToken)).rejects.toMatchObject({ code: 'TOKEN_INVALID' })
    close()
  })

  it('logs out by revoking the session', async () => {
    const { db, close } = createTestDb()
    const { refreshToken } = await signup(db, {
      name: 'A',
      email: 'a@example.com',
      password: 'pw123456',
      businessName: 'Biz',
    })

    await logout(db, refreshToken)
    await expect(refresh(db, refreshToken)).rejects.toMatchObject({ code: 'TOKEN_INVALID' })
    close()
  })
})
