import { Router } from 'express'
import { z } from 'zod'
import type { Db } from '../db/index.js'
import { config } from '../config.js'
import { getUserById } from '../auth/service.js'
import { requestPasswordReset, resetPassword, createEmailVerification, verifyEmail } from '../account/service.js'
import { enqueueJob } from '../jobs/service.js'
import { asyncRoute, requireAuth, resetLimiter } from './middleware.js'

const emailSchema = z.object({ email: z.string().email() }).strict()
const tokenSchema = z
  .object({ token: z.string().min(10), password: z.string().min(8).max(200) })
  .strict()
const tokenOnlySchema = z.object({ token: z.string().min(10) }).strict()

export function accountRoutes(db: Db): Router {
  const r = Router()

  r.post('/password-reset', resetLimiter, asyncRoute(async (req, res) => {
    const { email } = emailSchema.parse(req.body)
    const result = await requestPasswordReset(db, email)
    if (result) {
      await enqueueJob(db, 'email.send', {
        to: result.email,
        subject: 'Reset your Quotely password',
        text: `Click here to reset your password: ${config.PUBLIC_BASE_URL}/reset-password?token=${result.token}\nThis link expires in one hour.`,
      })
    }
    res.status(202).json({ ok: true })
  }))

  r.post('/password-reset/confirm', resetLimiter, asyncRoute(async (req, res) => {
    const { token, password } = tokenSchema.parse(req.body)
    await resetPassword(db, token, password)
    res.status(204).end()
  }))

  r.post('/verify-email', requireAuth, resetLimiter, asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const result = await createEmailVerification(db, userId)
    await enqueueJob(db, 'email.send', {
      to: result.email,
      subject: 'Verify your Quotely email',
      text: `Click here to verify your email: ${config.PUBLIC_BASE_URL}/verify-email?token=${result.token}\nThis link expires in 48 hours.`,
    })
    res.status(202).json({ ok: true })
  }))

  r.post('/verify-email/confirm', resetLimiter, asyncRoute(async (req, res) => {
    const { token } = tokenOnlySchema.parse(req.body)
    await verifyEmail(db, token)
    res.status(204).end()
  }))

  r.get('/me', requireAuth, asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const user = await getUserById(db, userId)
    res.json({ id: user.id, name: user.name, email: user.email, emailVerifiedAt: user.emailVerifiedAt })
  }))

  return r
}