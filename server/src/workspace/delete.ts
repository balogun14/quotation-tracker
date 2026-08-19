import { and, eq, isNotNull, lte } from 'drizzle-orm'
import type { TxDb } from '../db/index.js'
import { auditEvents, workspaces } from '../db/schema.js'
import { errors } from '../errors.js'
import { requirePermission } from './service.js'
import { recordAudit } from '../audit/service.js'

const RECOVERY_MS = 30 * 86_400_000

export async function scheduleDeletion(db: TxDb, workspaceId: string, actorId: string) {
  await requirePermission(db, workspaceId, actorId, 'workspace:delete')
  const now = new Date()
  await db
    .update(workspaces)
    .set({ deletedAt: now, purgeAt: new Date(now.getTime() + RECOVERY_MS) })
    .where(eq(workspaces.id, workspaceId))
  await recordAudit(db, {
    workspaceId,
    actorId,
    action: 'workspace.delete_scheduled',
    entityType: 'workspace',
    entityId: workspaceId,
    after: { purgeAt: now.getTime() + RECOVERY_MS },
  })
}

export async function restoreWorkspace(db: TxDb, workspaceId: string, actorId: string) {
  await requirePermission(db, workspaceId, actorId, 'workspace:delete', { includeDeleted: true })
  const row = (await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1))[0]
  if (!row?.deletedAt) throw errors.conflict('Workspace is not deleted')
  if (row.purgeAt && row.purgeAt.getTime() < Date.now()) throw errors.conflict('Workspace can no longer be restored')
  await db
    .update(workspaces)
    .set({ deletedAt: null, purgeAt: null })
    .where(eq(workspaces.id, workspaceId))
  await recordAudit(db, {
    workspaceId,
    actorId,
    action: 'workspace.restored',
    entityType: 'workspace',
    entityId: workspaceId,
    after: { restoredAt: new Date().toISOString() },
  })
}

export async function purgeDeletedWorkspaces(db: TxDb): Promise<number> {
  const now = new Date()
  const due = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(isNotNull(workspaces.deletedAt), isNotNull(workspaces.purgeAt), lte(workspaces.purgeAt, now)))

  for (const ws of due) {
    await db.delete(auditEvents).where(eq(auditEvents.workspaceId, ws.id))
    await db.delete(workspaces).where(eq(workspaces.id, ws.id))
  }
  return due.length
}
