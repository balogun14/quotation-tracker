import { and, eq } from 'drizzle-orm'
import type { Db, TxDb } from '../db/index.js'
import { invitations, users, workspaceMembers } from '../db/schema.js'
import { errors } from '../errors.js'
import type { Role } from '../auth/authorization.js'
import { requirePermission } from '../workspace/service.js'
import { recordAudit } from '../audit/service.js'
import { hashPassword } from '../auth/password.js'
import { randomToken, hashToken } from '../security/tokens.js'

const INVITE_TTL_MS = 7 * 86_400_000
const normalizeEmail = (email: string) => email.trim().toLowerCase()

export interface InviteInput {
  email: string
  role?: Role
}

export interface AcceptInviteInput {
  mode: 'login' | 'signup'
  userId?: string
  name?: string
  password?: string
}

export async function inviteMember(db: TxDb, workspaceId: string, actorId: string, input: InviteInput) {
  await requirePermission(db, workspaceId, actorId, 'members:manage')
  const email = normalizeEmail(input.email)
  const role = input.role ?? 'member'

  const existing = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(users.email, email)))
    .limit(1)
  if (existing.length > 0) throw errors.conflict('This person is already a member')

  const token = randomToken(32)
  await db
    .insert(invitations)
    .values({
      workspaceId,
      email,
      role,
      tokenHash: hashToken(token),
      invitedBy: actorId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    })
    .onConflictDoNothing()

  await recordAudit(db, {
    workspaceId,
    actorId,
    action: 'member.invited',
    entityType: 'invitation',
    entityId: undefined,
    after: { email, role },
  })

  return { token, email, role, expiresAt: new Date(Date.now() + INVITE_TTL_MS) }
}

export async function listInvitations(db: TxDb, workspaceId: string, actorId: string) {
  await requirePermission(db, workspaceId, actorId, 'members:manage')
  return db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(eq(invitations.workspaceId, workspaceId))
    .orderBy(invitations.createdAt)
}

export async function revokeInvitation(db: TxDb, workspaceId: string, actorId: string, invitationId: string) {
  await requirePermission(db, workspaceId, actorId, 'members:manage')
  await db
    .update(invitations)
    .set({ status: 'revoked' })
    .where(and(eq(invitations.id, invitationId), eq(invitations.workspaceId, workspaceId)))
}

export async function acceptInvitation(db: Db, token: string, input: AcceptInviteInput) {
  const rows = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.tokenHash, hashToken(token)), eq(invitations.status, 'pending')))
    .limit(1)
  const invitation = rows[0]
  if (!invitation) throw errors.tokenInvalid()
  if (invitation.expiresAt.getTime() < Date.now()) throw errors.tokenInvalid('Invitation has expired')

  return db.transaction(async (tx) => {
    let userId: string

    if (input.mode === 'signup') {
      if (!input.name || !input.password) throw errors.validation('Name and password are required to sign up')
      const existing = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, invitation.email))
        .limit(1)
      if (existing.length > 0) throw errors.conflict('An account already exists for this email — log in to accept')
      const passwordHash = await hashPassword(input.password)
      const [user] = await tx
        .insert(users)
        .values({ name: input.name, email: invitation.email, passwordHash, emailVerifiedAt: null })
        .returning({ id: users.id })
      userId = user!.id
    } else {
      if (!input.userId) throw errors.validation('User id is required to accept')
      const user = await tx.select().from(users).where(eq(users.id, input.userId)).limit(1)
      if (!user[0]) throw errors.unauthorized()
      if (user[0].email.toLowerCase() !== invitation.email) {
        throw errors.conflict('This invitation was sent to a different email address')
      }
      userId = user[0].id
    }

    const membership = await tx
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(eq(workspaceMembers.workspaceId, invitation.workspaceId), eq(workspaceMembers.userId, userId)),
      )
      .limit(1)
    if (membership.length === 0) {
      await tx
        .insert(workspaceMembers)
        .values({ workspaceId: invitation.workspaceId, userId, role: invitation.role })
    }

    await tx
      .update(invitations)
      .set({ status: 'accepted', acceptedAt: new Date() })
      .where(eq(invitations.id, invitation.id))

    return { workspaceId: invitation.workspaceId, userId, role: invitation.role }
  })
}
