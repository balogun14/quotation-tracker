import express from 'express'
import cookieParser from 'cookie-parser'
import { randomUUID } from 'node:crypto'
import { pinoHttp } from 'pino-http'
import type { Logger } from 'pino'
import { sql } from 'drizzle-orm'
import type { Db } from '../db/index.js'
import type { FileStorageProvider } from '../files/storage.js'
import type { EmailProvider } from '../email/provider.js'
import { createSendService } from '../quote/send.js'
import { config } from '../config.js'
import { authRoutes } from './auth.routes.js'
import { accountRoutes } from './account.routes.js'
import { workspaceRoutes, acceptInvitationRoutes } from './workspace.routes.js'
import { quoteRoutes } from './quote.routes.js'
import { publicRoutes } from './public.routes.js'
import { reportRoutes } from './report.routes.js'
import {
  apiLimiter,
  errorHandler,
  notFoundHandler,
  requestId,
} from './middleware.js'
import { openapiJson } from './openapi.js'

export interface AppDeps {
  db: Db
  storage: FileStorageProvider
  email: EmailProvider
  logger?: Logger
}

export function createApp(deps: AppDeps) {
  const app = express()
  app.disable('x-powered-by')
  if (config.TRUST_PROXY > 0) app.set('trust proxy', config.TRUST_PROXY)
  if (deps.logger) {
    app.use(
      pinoHttp({
        logger: deps.logger,
        // Routine requests are high-volume noise. Retain concise client/server
        // failures only, without request headers or bodies.
        autoLogging: {
          ignore: (req) => req.url === '/health' || req.url === '/ready',
        },
        customLogLevel: (_req, res, err) =>
          err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'silent',
        customReceivedObject: (req) => ({
          method: req.method,
          url: req.url,
          remoteAddress: req.socket.remoteAddress,
        }),
        customSuccessObject: (_req, res) => ({ statusCode: res.statusCode }),
        genReqId: (req) => (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
      }),
    )
  }
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())
  app.use(requestId)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', config.CORS_ORIGIN)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    if (req.method === 'OPTIONS') return res.status(204).end()
    next()
  })

  app.get('/health', (_req, res) => res.json({ status: 'ok' }))

  app.get('/ready', async (_req, res) => {
    try {
      await deps.db.run(sql`SELECT 1`)
      res.json({ status: 'ok' })
    } catch {
      res.status(503).json({ status: 'unavailable' })
    }
  })

  const send = createSendService({ storage: deps.storage, email: deps.email })

  const api = express.Router()
  api.use('/auth', authRoutes(deps.db))
  api.use('/account', accountRoutes(deps.db))
  api.use('/public', publicRoutes(deps.db, { storage: deps.storage }))
  // The general API limiter applies to authenticated business endpoints; auth
  // routes carry their own stricter per-route limiters and must not double-count.
  api.use(apiLimiter)
  api.use('/workspaces', workspaceRoutes(deps.db))
  api.use('/invitations', acceptInvitationRoutes(deps.db))
  api.use('/workspaces', quoteRoutes(deps.db, { storage: deps.storage, send }))
  api.use('/workspaces', reportRoutes(deps.db))
  api.get('/openapi.json', (_req, res) => res.json(openapiJson))
  app.use('/api/v1', api)

  app.use(publicRoutes(deps.db, { storage: deps.storage }))

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
