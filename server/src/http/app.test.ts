import { describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestDb } from '../test/db.js'
import { LocalFileStorage } from '../files/storage.js'
import type { EmailProvider, EmailMessage } from '../email/provider.js'
import { createApp } from './app.js'
import { signup } from '../auth/service.js'

class FakeEmail implements EmailProvider {
  sent: EmailMessage[] = []
  async send(message: EmailMessage) {
    this.sent.push(message)
  }
}

const tempDirs: string[] = []
afterEach(() => {
  for (const d of tempDirs) rmSync(d, { recursive: true, force: true })
  tempDirs.length = 0
})

function setup() {
  const { db, close } = createTestDb()
  const dir = mkdtempSync(join(tmpdir(), 'quotely-http-'))
  tempDirs.push(dir)
  const email = new FakeEmail()
  const app = createApp({ db, storage: new LocalFileStorage(dir), email })
  return { app, db, close, email }
}

const draft = {
  clientName: 'Amina Bello',
  clientEmail: 'amina@brightpath.co',
  serviceDescription: 'Event furniture hire',
  currency: 'NGN',
  items: [{ description: 'Chairs', quantity: 10, unitPriceMinor: 5000 }],
}

describe('HTTP API', () => {
  it('health and ready endpoints report ok', async () => {
    const { app, close } = setup()
    const health = await request(app).get('/health')
    expect(health.status).toBe(200)
    expect(health.body.status).toBe('ok')
    const ready = await request(app).get('/ready')
    expect(ready.status).toBe(200)
    expect(ready.body.status).toBe('ok')
    close()
  })

  it('signs up over HTTP, setting a refresh cookie and returning tokens', async () => {
    const { app, close } = setup()
    const res = await request(app).post('/api/v1/auth/signup').send({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'pw123456',
      businessName: 'Lovelace Rentals',
    })
    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe('ada@example.com')
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.refreshToken).toBeUndefined()
    const cookies = res.headers['set-cookie'] as unknown as string[]
    expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true)
    expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true)
    close()
  })

  it('rejects requests without a bearer token', async () => {
    const { app, close } = setup()
    const res = await request(app).get('/api/v1/workspaces')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } })
    close()
  })

  it('wraps unknown routes in the 404 error envelope', async () => {
    const { app, close } = setup()
    const res = await request(app).get('/api/v1/nope')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    close()
  })

  it('wraps validation failures in a 422 envelope', async () => {
    const { app, close } = setup()
    const res = await request(app).post('/api/v1/auth/signup').send({
      name: 'A',
      email: 'not-an-email',
      password: 'short',
      businessName: 'Biz',
      extra: 'field',
    })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(res.body.error.details)).toBe(true)
    close()
  })

  it('rotates the refresh token through the cookie', async () => {
    const { app, close } = setup()
    const agent = request.agent(app)
    const signupRes = await agent.post('/api/v1/auth/signup').send({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'pw123456',
      businessName: 'Biz',
    })
    const cookieHeader = (signupRes.headers['set-cookie'] as unknown as string[])[0] ?? ''
    const before = cookieHeader.split(';')[0]!.slice('refresh_token='.length)
    expect(before).toBeTruthy()

    const rotated = await agent.post('/api/v1/auth/refresh')
    expect(rotated.status).toBe(200)
    const rotatedHeader = (rotated.headers['set-cookie'] as unknown as string[])[0] ?? ''
    const after = rotatedHeader.split(';')[0]!.slice('refresh_token='.length)
    expect(after).toBeTruthy()
    expect(after).not.toBe(before)
    close()
  })

  it('lists workspaces with a valid token', async () => {
    const { app, db, close } = setup()
    const { accessToken } = await signup(db, {
      name: 'Ada',
      email: 'ada@example.com',
      password: 'pw123456',
      businessName: 'Lovelace Rentals',
    })
    const res = await request(app).get('/api/v1/workspaces').set('Authorization', `Bearer ${accessToken}`)
    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].businessName).toBe('Lovelace Rentals')
    close()
  })

  it('creates and sends a quote, then serves it over the public link and accepts a decision', async () => {
    const { app, db, close } = setup()
    const { accessToken, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme Rentals',
    })
    const auth = { Authorization: `Bearer ${accessToken}` }

    const created = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/quotes`)
      .set(auth)
      .send(draft)
    expect(created.status).toBe(201)
    const quoteId = created.body.quote.id

    const sent = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/quotes/${quoteId}/send`)
      .set(auth)
    expect(sent.status).toBe(200)
    const publicToken = sent.body.result.publicToken

    const view = await request(app).get(`/p/${publicToken}`)
    expect(view.status).toBe(200)
    expect(view.body.snapshot.quote.clientName).toBe('Amina Bello')
    expect(view.body.snapshot.items).toHaveLength(1)
    expect(view.body.status).toBe('sent')

    const pdf = await request(app).get(`/p/${publicToken}/pdf`)
    expect(pdf.status).toBe(200)
    expect(pdf.headers['content-type']).toContain('application/pdf')
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF')

    const decided = await request(app).post(`/p/${publicToken}/decide`).send({
      decision: 'accepted',
      recipientName: 'Amina Bello',
      recipientEmail: 'amina@brightpath.co',
    })
    expect(decided.status).toBe(200)
    expect(decided.body.decision).toBe('accepted')

    // the decision revokes the public link, so re-fetching it 404s
    const revoked = await request(app).get(`/p/${publicToken}`)
    expect(revoked.status).toBe(404)

    const updated = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/quotes/${quoteId}`)
      .set(auth)
    expect(updated.body.quote.status).toBe('accepted')
    close()
  })

  it('serves dashboard report for a workspace', async () => {
    const { app, db, close } = setup()
    const { accessToken, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme Rentals',
    })
    const auth = { Authorization: `Bearer ${accessToken}` }
    await request(app).post(`/api/v1/workspaces/${workspace.id}/quotes`).set(auth).send(draft)

    const res = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/reports/dashboard`)
      .set(auth)
    expect(res.status).toBe(200)
    expect(res.body.totalQuotes).toBe(1)
    close()
  })

  it('logs out and invalidates the refresh session', async () => {
    const { app, db, close } = setup()
    const agent = request.agent(app)
    await agent.post('/api/v1/auth/signup').send({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'pw123456',
      businessName: 'Biz',
    })
    const loggedOut = await agent.post('/api/v1/auth/logout')
    expect(loggedOut.status).toBe(204)
    const refreshed = await agent.post('/api/v1/auth/refresh')
    expect(refreshed.status).toBe(401)
    close()
  })
})
