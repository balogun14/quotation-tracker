import { Router } from 'express'
import { z } from 'zod'
import type { NextFunction, Request, Response } from 'express'
import type { Db } from '../db/index.js'
import { config } from '../config.js'
import { errors } from '../errors.js'
import { verifyAccessToken } from '../auth/tokens.js'
import {
  getWorkspace,
  listWorkspaces,
  listMembers,
  updateBranding,
  changeRole,
  removeMember,
  requirePermission,
  requireMember,
} from '../workspace/service.js'
import { scheduleDeletion, restoreWorkspace } from '../workspace/delete.js'
import { exportWorkspaceData } from '../workspace/export.js'
import { listAudit } from '../audit/service.js'
import { inviteMember, listInvitations, revokeInvitation, acceptInvitation } from '../invite/service.js'
import { enqueueJob } from '../jobs/service.js'
import { asyncRoute, requireAuth, resetLimiter, param } from './middleware.js'

const brandingSchema = z
  .object({
    businessName: z.string().min(1).max(200).optional(),
    replyToEmail: z.string().email().optional(),
    logoUrl: z.string().url().nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    website: z.string().url().nullable().optional(),
    paymentInstructions: z.string().max(1000).nullable().optional(),
    defaultCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  })
  .strict()

const inviteSchema = z.object({ email: z.string().email(), role: z.enum(['owner', 'member']).optional() }).strict()

const acceptSchema = z
  .object({
    token: z.string().min(10),
    mode: z.enum(['login', 'signup']),
    name: z.string().min(1).max(120).optional(),
    password: z.string().min(8).max(200).optional(),
  })
  .strict()

function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) return next()
  verifyAccessToken(token)
    .then(({ sub }) => {
      res.locals.userId = sub
      next()
    })
    .catch(() => next())
}

export function workspaceRoutes(db: Db): Router {
  const r = Router()
  r.use(requireAuth)

  r.get('/', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    res.json({ items: await listWorkspaces(db, userId) })
  }))

  r.get('/:id', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const id = param(req, 'id')
    await requireMember(db, id, userId)
    res.json({ workspace: await getWorkspace(db, id) })
  }))

  r.patch('/:id/branding', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const id = param(req, 'id')
    const input = brandingSchema.parse(req.body)
    await requirePermission(db, id, userId, 'workspace:manage')
    const workspace = await updateBranding(db, id, userId, input)
    res.json({ workspace })
  }))

  r.get('/:id/members', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const id = param(req, 'id')
    await requireMember(db, id, userId)
    res.json({ items: await listMembers(db, id) })
  }))

  r.patch('/:id/members/:userId', asyncRoute(async (req, res) => {
    const { userId: actorId } = res.locals
    const id = param(req, 'id')
    const targetUserId = param(req, 'userId')
    const role = z.enum(['owner', 'member']).parse(req.body.role)
    await requirePermission(db, id, actorId, 'members:manage')
    const member = await changeRole(db, id, actorId, targetUserId, role)
    res.json({ member })
  }))

  r.delete('/:id/members/:userId', asyncRoute(async (req, res) => {
    const { userId: actorId } = res.locals
    const id = param(req, 'id')
    const targetUserId = param(req, 'userId')
    await requirePermission(db, id, actorId, 'members:manage')
    await removeMember(db, id, actorId, targetUserId)
    res.status(204).end()
  }))

  r.get('/:id/invitations', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const id = param(req, 'id')
    res.json({ items: await listInvitations(db, id, userId) })
  }))

  r.post('/:id/invitations', resetLimiter, asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const id = param(req, 'id')
    const input = inviteSchema.parse(req.body)
    const result = await inviteMember(db, id, userId, input)
    await enqueueJob(db, 'email.send', {
      to: result.email,
      subject: 'You have been invited to Quotely',
      text:
        `You've been invited to join a workspace on Quotely.\n\n` +
        `Accept the invitation here: ${config.PUBLIC_BASE_URL}/invite?token=${result.token}\n` +
        `This invitation expires in 7 days.`,
    })
    res.status(201).json({ invitation: result })
  }))

  r.post('/:id/invitations/:invitationId/revoke', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const id = param(req, 'id')
    const invitationId = param(req, 'invitationId')
    await revokeInvitation(db, id, userId, invitationId)
    res.status(204).end()
  }))

  r.get('/:id/audit', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const id = param(req, 'id')
    await requireMember(db, id, userId)
    res.json({ items: await listAudit(db, id) })
  }))

  r.get('/:id/export', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const id = param(req, 'id')
    const data = await exportWorkspaceData(db, id, userId)
    res.setHeader('Content-Disposition', 'attachment; filename="quotely-export.json"')
    res.setHeader('Content-Type', 'application/json')
    res.json(data)
  }))

  r.delete('/:id', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const id = param(req, 'id')
    await scheduleDeletion(db, id, userId)
    res.status(202).json({ ok: true })
  }))

  r.post('/:id/restore', asyncRoute(async (req, res) => {
    const { userId } = res.locals
    const id = param(req, 'id')
    await restoreWorkspace(db, id, userId)
    res.json({ ok: true })
  }))

  return r
}

export function acceptInvitationRoutes(db: Db): Router {
  const r = Router()
  r.post('/invitations/accept', optionalAuth, resetLimiter, asyncRoute(async (req, res) => {
    const input = acceptSchema.parse(req.body)
    if (input.mode === 'login' && !res.locals.userId) throw errors.unauthorized()
    const result = await acceptInvitation(db, input.token, {
      mode: input.mode,
      userId: input.mode === 'login' ? res.locals.userId : undefined,
      name: input.mode === 'signup' ? input.name : undefined,
      password: input.mode === 'signup' ? input.password : undefined,
    })
    res.json({ ...result, requiresLogin: input.mode === 'signup' })
  }))
  return r
}