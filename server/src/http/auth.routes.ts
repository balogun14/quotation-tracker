import { Router } from 'express'
import { z } from 'zod'
import type { Db } from '../db/index.js'
import { config } from '../config.js'
import { parseDuration } from '../auth/tokens.js'
import { signup, login, refresh, logout } from '../auth/service.js'
import { errors } from '../errors.js'
import { asyncRoute, authLimiter } from './middleware.js'

const signupSchema = z
  .object({
    name: z.string().min(1).max(120),
    email: z.string().email(),
    password: z.string().min(8).max(200),
    businessName: z.string().min(1).max(200),
  })
  .strict()

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) }).strict()

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: parseDuration(config.REFRESH_TOKEN_TTL),
  }
}

function publicAuthResult(result: Awaited<ReturnType<typeof login>>) {
  const { refreshToken: _rt, sessionId, ...rest } = result
  return rest
}

export function authRoutes(db: Db): Router {
  const r = Router()

  r.post('/signup', authLimiter, asyncRoute(async (req, res) => {
    const input = signupSchema.parse(req.body)
    const result = await signup(db, input)
    res.cookie('refresh_token', result.refreshToken, refreshCookieOptions())
    res.status(201).json(publicAuthResult(result))
  }))

  r.post('/login', authLimiter, asyncRoute(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body)
    const result = await login(db, email, password)
    res.cookie('refresh_token', result.refreshToken, refreshCookieOptions())
    res.json(publicAuthResult(result))
  }))

  r.post('/refresh', authLimiter, asyncRoute(async (req, res) => {
    const token = req.cookies?.refresh_token
    if (!token) throw errors.unauthorized()
    const result = await refresh(db, token)
    res.cookie('refresh_token', result.refreshToken, refreshCookieOptions())
    res.json(publicAuthResult(result))
  }))

  r.post('/logout', authLimiter, asyncRoute(async (req, res) => {
    const token = req.cookies?.refresh_token
    if (token) await logout(db, token)
    res.clearCookie('refresh_token', { httpOnly: true, secure: config.COOKIE_SECURE, sameSite: 'lax', path: '/' })
    res.status(204).end()
  }))

  return r
}