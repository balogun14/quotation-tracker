import { Router } from 'express'
import { z } from 'zod'
import type { Db } from '../db/index.js'
import type { FileStorageProvider } from '../files/storage.js'
import { createPublicService } from '../public/service.js'
import { asyncRoute, param, resetLimiter } from './middleware.js'

const decideSchema = z
  .object({
    decision: z.enum(['accepted', 'declined']),
    recipientName: z.string().min(1).max(120).optional(),
    recipientEmail: z.string().email().optional(),
  })
  .strict()

export function publicRoutes(db: Db, deps: { storage: FileStorageProvider }): Router {
  const r = Router()
  const publicService = createPublicService(deps.storage)

  r.get('/p/:token', asyncRoute(async (req, res) => {
    const view = await publicService.getPublicQuote(db, param(req, 'token'))
    res.json(view)
  }))

  r.get('/p/:token/pdf', asyncRoute(async (req, res) => {
    const pdf = await publicService.getPublicPdf(db, param(req, 'token'))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline')
    res.send(pdf)
  }))

  r.post('/p/:token/decide', resetLimiter, asyncRoute(async (req, res) => {
    const input = decideSchema.parse(req.body)
    const result = await publicService.decide(db, param(req, 'token'), input)
    res.json(result)
  }))

  return r
}