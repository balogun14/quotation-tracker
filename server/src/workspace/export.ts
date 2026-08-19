import { and, asc, eq, inArray } from 'drizzle-orm'
import type { TxDb } from '../db/index.js'
import {
  auditEvents,
  quoteDecisions,
  quoteItems,
  quoteVersions,
  quotes,
  users,
  workspaceMembers,
  workspaces,
} from '../db/schema.js'
import { errors } from '../errors.js'
import { requireMember } from './service.js'

export async function exportWorkspaceData(db: TxDb, workspaceId: string, actorId: string) {
  await requireMember(db, workspaceId, actorId)

  const workspace = (await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1))[0]
  if (!workspace || workspace.deletedAt) throw errors.notFound('Workspace not found')

  const members = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId))

  const rows = await db
    .select()
    .from(quotes)
    .where(eq(quotes.workspaceId, workspaceId))
    .orderBy(asc(quotes.createdAt))
  const ids = rows.map((r) => r.id)

  const [items, versions, decisions] = ids.length === 0
    ? [[], [], []]
    : await Promise.all([
        db.select().from(quoteItems).where(inArray(quoteItems.quoteId, ids)),
        db.select().from(quoteVersions).where(inArray(quoteVersions.quoteId, ids)),
        db.select().from(quoteDecisions).where(inArray(quoteDecisions.quoteId, ids)),
      ])

  const itemsByQuote = groupBy(items, (i) => i.quoteId)
  const versionsByQuote = groupBy(versions, (v) => v.quoteId)
  const decisionsByQuote = groupBy(decisions, (d) => d.quoteId)
  const quotesWithItems = rows.map((q) => ({
    ...q,
    items: itemsByQuote.get(q.id) ?? [],
    versions: versionsByQuote.get(q.id) ?? [],
    decisions: decisionsByQuote.get(q.id) ?? [],
  }))

  const audit = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.workspaceId, workspaceId))
    .orderBy(asc(auditEvents.createdAt))

  return {
    exportedAt: new Date().toISOString(),
    workspace,
    members,
    quotes: quotesWithItems,
    audit,
  }
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const k = key(row)
    const arr = map.get(k)
    if (arr) arr.push(row)
    else map.set(k, [row])
  }
  return map
}