import { Router } from 'express'
import { z } from 'zod'
import type { Db } from '../db/index.js'
import { createQuote, getQuote, updateQuote, cancelQuote, listQuotes, transitionQuote } from '../quote/service.js'
import type { QuoteWithItems } from '../quote/service.js'
import type { SendService } from '../quote/send.js'
import { createPublicService } from '../public/service.js'
import type { FileStorageProvider } from '../files/storage.js'
import { requireMember } from '../workspace/service.js'
import { asyncRoute, requireAuth, param } from './middleware.js'

const statusSchema = z.object({ status: z.enum(['sent', 'followed_up', 'accepted', 'declined']) }).strict()
const followUpSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
}).strict()

function serializeQuote(quote: QuoteWithItems) {
  return quote
}

export function quoteRoutes(db: Db, deps: { storage: FileStorageProvider; send: SendService }): Router {
  const r = Router()
  r.use(requireAuth)
  const publicService = createPublicService(deps.storage)

  r.get('/:id/quotes', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const workspaceId = param(req, 'id')
    await requireMember(db, workspaceId, userId)
    const page = await listQuotes(db, workspaceId, req.query)
    res.json({ items: page.items.map(serializeQuote), nextCursor: page.nextCursor })
  }))

  r.post('/:id/quotes', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const workspaceId = param(req, 'id')
    await requireMember(db, workspaceId, userId)
    const quote = await createQuote(db, workspaceId, userId, req.body)
    res.status(201).json({ quote: serializeQuote(quote) })
  }))

  r.get('/:id/quotes/:quoteId', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const workspaceId = param(req, 'id')
    const quoteId = param(req, 'quoteId')
    await requireMember(db, workspaceId, userId)
    res.json({ quote: serializeQuote(await getQuote(db, workspaceId, quoteId)) })
  }))

  r.patch('/:id/quotes/:quoteId', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const workspaceId = param(req, 'id')
    const quoteId = param(req, 'quoteId')
    await requireMember(db, workspaceId, userId)
    const quote = await updateQuote(db, workspaceId, userId, quoteId, req.body)
    res.json({ quote: serializeQuote(quote) })
  }))

  r.post('/:id/quotes/:quoteId/status', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const workspaceId = param(req, 'id')
    const quoteId = param(req, 'quoteId')
    const { status } = statusSchema.parse(req.body)
    const quote = await transitionQuote(db, workspaceId, userId, quoteId, status)
    res.json({ quote: serializeQuote(quote) })
  }))

  r.delete('/:id/quotes/:quoteId', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const workspaceId = param(req, 'id')
    const quoteId = param(req, 'quoteId')
    await requireMember(db, workspaceId, userId)
    await cancelQuote(db, workspaceId, userId, quoteId)
    res.status(204).end()
  }))

  r.post('/:id/quotes/:quoteId/send', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const workspaceId = param(req, 'id')
    const quoteId = param(req, 'quoteId')
    await requireMember(db, workspaceId, userId)
    const result = await deps.send.sendQuote(db, workspaceId, userId, quoteId)
    res.json({ result })
  }))

  r.post('/:id/quotes/:quoteId/follow-up', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const workspaceId = param(req, 'id')
    const quoteId = param(req, 'quoteId')
    const result = await deps.send.sendFollowUp(db, workspaceId, userId, quoteId, followUpSchema.parse(req.body))
    res.json({ result })
  }))

  r.post('/:id/quotes/:quoteId/preview', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const workspaceId = param(req, 'id')
    const quoteId = param(req, 'quoteId')
    await requireMember(db, workspaceId, userId)
    const pdf = await deps.send.previewPdf(db, workspaceId, userId, quoteId)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline')
    res.send(pdf)
  }))

  r.post('/:id/quotes/:quoteId/revoke-links', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const workspaceId = param(req, 'id')
    const quoteId = param(req, 'quoteId')
    await requireMember(db, workspaceId, userId)
    const revoked = await publicService.revokeQuoteLinks(db, workspaceId, userId, quoteId)
    res.json({ revoked })
  }))

  return r
}
