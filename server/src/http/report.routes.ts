import { Router } from 'express'
import { z } from 'zod'
import type { Db } from '../db/index.js'
import { report, exportQuotesCsv, type ReportFilter } from '../report/service.js'
import { createFxRateProvider } from '../fx/provider.js'
import { recordAudit } from '../audit/service.js'
import { requireMember, requirePermission } from '../workspace/service.js'
import { asyncRoute, requireAuth, param } from './middleware.js'

const reportQuerySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    ownerId: z.string().min(1).optional(),
    status: z
      .enum(['draft', 'sent', 'followed_up', 'accepted', 'declined', 'expired', 'cancelled'])
      .optional(),
    currency: z.string().regex(/^[A-Z]{3}$/).optional(),
    reportingCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
  })
  .strict()

const fxOverrideSchema = z
  .object({
    base: z.string().regex(/^[A-Z]{3}$/),
    quote: z.string().regex(/^[A-Z]{3}$/),
    rate: z.number().positive(),
    date: z.string().datetime().optional(),
    reason: z.string().min(1).max(500),
  })
  .strict()

function parseFilter(query: z.infer<typeof reportQuerySchema>): ReportFilter {
  return {
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
    ownerId: query.ownerId,
    status: query.status,
    currency: query.currency,
    reportingCurrency: query.reportingCurrency,
  }
}

export function reportRoutes(db: Db): Router {
  const r = Router()
  r.use(requireAuth)

  r.get('/:id/reports/dashboard', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const id = param(req, 'id')
    await requireMember(db, id, userId)
    const fx = createFxRateProvider(db)
    const result = await report(db, id, {}, fx)
    res.json(result)
  }))

  r.get('/:id/reports', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const id = param(req, 'id')
    await requireMember(db, id, userId)
    const query = reportQuerySchema.parse(req.query)
    const fx = createFxRateProvider(db)
    const result = await report(db, id, parseFilter(query), fx)
    res.json(result)
  }))

  r.get('/:id/reports/export.csv', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const id = param(req, 'id')
    await requirePermission(db, id, userId, 'reports:export')
    const query = reportQuerySchema.parse(req.query)
    const csv = await exportQuotesCsv(db, id, parseFilter(query))
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="quotes.csv"')
    res.send(csv)
  }))

  r.post('/:id/fx/override', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const id = param(req, 'id')
    await requirePermission(db, id, userId, 'fx:override')
    const input = fxOverrideSchema.parse(req.body)
    const fx = createFxRateProvider(db)
    const rate = await fx.overrideRate(
      userId,
      input.base,
      input.quote,
      input.date ? new Date(input.date) : new Date(),
      input.rate,
      input.reason,
    )
    await recordAudit(db, {
      workspaceId: id,
      actorId: userId,
      action: 'fx.override',
      entityType: 'fx_rate',
      entityId: `${input.base}/${input.quote}`,
      after: { rate: input.rate, reason: input.reason },
    })
    res.json({ rate })
  }))

  return r
}