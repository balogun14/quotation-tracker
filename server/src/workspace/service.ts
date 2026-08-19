import { and, count, eq } from 'drizzle-orm'
import type { TxDb } from '../db/index.js'
import {
  users,
  workspaces,
  workspaceMembers,
  type Workspace,
  type WorkspaceMember,
} from '../db/schema.js'
import { errors } from '../errors.js'
import { can, type Role } from '../auth/authorization.js'

export interface BrandingInput {
  businessName?: string
  replyToEmail?: string
  logoUrl?: string | null
  phone?: string | null
  address?: string | null
  website?: string | null
  paymentInstructions?: string | null
  defaultCurrency?: string
  accentColor?: string
}

export interface MemberView {
  userId: string
  name: string
  email: string
  role: Role
}

export async function getMembership(
  db: TxDb,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMember | null> {
  const rows = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1)
  return rows[0] ?? null
}

export async function requireMember(db: TxDb, workspaceId: string, userId: string) {
  const membership = await getMembership(db, workspaceId, userId)
  if (!membership) throw errors.forbidden('You are not a member of this workspace')
  return membership
}

export async function requirePermission(
  db: TxDb,
  workspaceId: string,
  userId: string,
  permission: Parameters<typeof can>[1],
) {
  const membership = await requireMember(db, workspaceId, userId)
  if (!can(membership.role, permission)) throw errors.forbidden('Insufficient permissions')
  return membership
}

export async function getWorkspace(db: TxDb, workspaceId: string): Promise<Workspace> {
  const workspace = (await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1))[0]
  if (!workspace || workspace.deletedAt) throw errors.notFound('Workspace not found')
  return workspace
}

export async function listWorkspaces(db: TxDb, userId: string) {
  return db
    .select({
      id: workspaces.id,
      businessName: workspaces.businessName,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
}

export async function listMembers(db: TxDb, workspaceId: string): Promise<MemberView[]> {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
  return rows.map((r) => ({ ...r, role: r.role as Role }))
}

async function ownerCount(db: TxDb, workspaceId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, 'owner')))
  return rows[0]?.n ?? 0
}

export async function updateBranding(db: TxDb, workspaceId: string, input: BrandingInput) {
  return db.update(workspaces).set(input).where(eq(workspaces.id, workspaceId)).returning()
}

export async function changeRole(
  db: TxDb,
  workspaceId: string,
  actorId: string,
  targetUserId: string,
  role: Role,
) {
  const target = await getMembership(db, workspaceId, targetUserId)
  if (!target) throw errors.notFound('Member not found')

  if (target.role === 'owner' && role === 'member') {
    const owners = await ownerCount(db, workspaceId)
    if (owners <= 1) throw errors.conflict('Workspace must have at least one owner')
  }

  await db
    .update(workspaceMembers)
    .set({ role })
    .where(eq(workspaceMembers.id, target.id))
  return { ...target, role }
}

export async function removeMember(db: TxDb, workspaceId: string, targetUserId: string) {
  const target = await getMembership(db, workspaceId, targetUserId)
  if (!target) throw errors.notFound('Member not found')

  if (target.role === 'owner') {
    const owners = await ownerCount(db, workspaceId)
    if (owners <= 1) throw errors.conflict('Workspace must have at least one owner')
  }

  await db.delete(workspaceMembers).where(eq(workspaceMembers.id, target.id))
}
