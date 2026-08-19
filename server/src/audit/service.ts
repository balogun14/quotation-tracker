import { desc, eq } from 'drizzle-orm'
import type { TxDb } from '../db/index.js'
import { auditEvents } from '../db/schema.js'

export interface AuditInput {
  workspaceId: string
  actorId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  before?: unknown
  after?: unknown
  metadata?: unknown
}

export function recordAudit(db: TxDb, input: AuditInput) {
  return db.insert(auditEvents).values({
    workspaceId: input.workspaceId,
    actorId: input.actorId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    before: input.before === undefined ? null : JSON.stringify(input.before),
    after: input.after === undefined ? null : JSON.stringify(input.after),
    metadata: input.metadata === undefined ? null : JSON.stringify(input.metadata),
  })
}

export function listAudit(db: TxDb, workspaceId: string, limit = 200) {
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.workspaceId, workspaceId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit)
}
