import { describe, it, expect } from 'vitest'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { createTestDb } from '../test/db.js'
import { signup } from '../auth/service.js'
import { createQuote } from '../quote/service.js'
import { requireMember } from './service.js'
import { scheduleDeletion, restoreWorkspace, purgeDeletedWorkspaces } from './delete.js'
import { exportWorkspaceData } from './export.js'
import { recordAudit, listAudit } from '../audit/service.js'
import { workspaces, auditEvents } from '../db/schema.js'

describe('workspace deletion', () => {
  it('soft-deletes a workspace and blocks access during recovery window', async () => {
    const { db, close } = createTestDb()
    const { user, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })

    await scheduleDeletion(db, workspace.id, user.id)
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspace.id))
    expect(ws?.deletedAt).toBeTruthy()
    expect(ws?.purgeAt).toBeTruthy()

    await expect(requireMember(db, workspace.id, user.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    close()
  })

  it('restores a deleted workspace within the recovery window', async () => {
    const { db, close } = createTestDb()
    const { user, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })

    await scheduleDeletion(db, workspace.id, user.id)
    await restoreWorkspace(db, workspace.id, user.id)

    const membership = await requireMember(db, workspace.id, user.id)
    expect(membership.role).toBe('owner')
    close()
  })

  it('purges deleted workspaces past their purge date', async () => {
    const { db, close } = createTestDb()
    const { user, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })
    await scheduleDeletion(db, workspace.id, user.id)
    await db
      .update(workspaces)
      .set({ purgeAt: new Date(Date.now() - 1000) })
      .where(eq(workspaces.id, workspace.id))

    const purged = await purgeDeletedWorkspaces(db)
    expect(purged).toBe(1)
    const left = await db.select().from(workspaces).where(eq(workspaces.id, workspace.id))
    expect(left).toHaveLength(0)
    close()
  })
})

describe('workspace export', () => {
  it('exports quotes with items, members, and audit events', async () => {
    const { db, close } = createTestDb()
    const { user, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })
    const quote = await createQuote(db, workspace.id, user.id, {
      clientName: 'Client',
      serviceDescription: 'Hire',
      currency: 'NGN',
      items: [{ description: 'Rig', quantity: 1, unitPriceMinor: 5000 }],
    })
    await recordAudit(db, {
      workspaceId: workspace.id,
      actorId: user.id,
      action: 'quote.created',
      entityType: 'quote',
      entityId: quote.id,
    })

    const data = await exportWorkspaceData(db, workspace.id, user.id)
    expect(data.workspace.id).toBe(workspace.id)
    expect(data.members).toHaveLength(1)
    expect(data.quotes).toHaveLength(1)
    expect(data.quotes[0]?.items).toHaveLength(1)
    expect(data.quotes[0]?.totalMinor).toBe(5000)
    expect(data.audit).toHaveLength(1)
    expect(data.audit[0]?.action).toBe('quote.created')
    close()
  })

  it('records and lists audit events', async () => {
    const { db, close } = createTestDb()
    const { user, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })
    await recordAudit(db, {
      workspaceId: workspace.id,
      actorId: user.id,
      action: 'test.action',
      entityType: 'test',
      entityId: '123',
      after: { note: 'hello' },
    })
    const events = await listAudit(db, workspace.id)
    expect(events).toHaveLength(1)
    expect(JSON.parse(events[0]!.after!)).toEqual({ note: 'hello' })
    close()
  })
})