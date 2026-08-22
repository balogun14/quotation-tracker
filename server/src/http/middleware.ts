import type { NextFunction, Request, Response, RequestHandler } from 'express'
import { ZodError } from 'zod'
import rateLimit from 'express-rate-limit'
import { verifyAccessToken } from '../auth/tokens.js'
import { AppError, errors } from '../errors.js'

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

export function asyncRoute(handler: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) return next(errors.unauthorized())
  verifyAccessToken(token)
    .then(({ sub }) => {
      res.locals.userId = sub
      next()
    })
    .catch(() => next(errors.unauthorized()))
}

export function param(req: Request, name: string): string {
  const value = req.params[name]
  if (!value) throw errors.validation(`Missing path parameter: ${name}`)
  return value
}

const rateLimitHandler = (req: Request, res: Response) => {
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, try again later' } })
}

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
})

export const resetLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
})

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } })
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    const body: Record<string, unknown> = { error: { code: err.code, message: err.message } }
    if (err.details !== undefined) (body.error as Record<string, unknown>).details = err.details
    res.status(err.status).json(body)
    return
  }
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.issues[0]?.message ?? 'Invalid input',
        details: err.issues,
      },
    })
    return
  }
  req.log?.error?.({ err }, 'unhandled error')
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
}