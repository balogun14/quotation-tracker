import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from '../test/db.js'
import { signup, login } from '../auth/service.js'
import { listWorkspaces } from '../workspace/service.js'
import { inviteMember, listInvitations, acceptInvitation } from './service.js'
import { invitations, workspaceMembers, users } from '../db/schema.js'

describe('invite service', () => {
  it('invites a member and lists pending invitations', async () => {
    const { db, close } = createTestDb()
    const { user, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })

    const invite = await inviteMember(db, workspace.id, user.id, { email: 'dev@example.com', role: 'member' })
    expect(invite.token).toBeTruthy()

    const pending = await listInvitations(db, workspace.id, user.id)
    expect(pending).toHaveLength(1)
    expect(pending[0]?.email).toBe('dev@example.com')
    expect(pending[0]?.status).toBe('pending')
    close()
  })

  it('rejects inviting someone who is already a member', async () => {
    const { db, close } = createTestDb()
    const { user, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })
    await expect(inviteMember(db, workspace.id, user.id, { email: 'owner@example.com' })).rejects.toMatchObject({
      code: 'CONFLICT',
    })
    close()
  })

  it('accepts an invitation with a new account', async () => {
    const { db, close } = createTestDb()
    const { user, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })
    const invite = await inviteMember(db, workspace.id, user.id, { email: 'dev@example.com' })

    const accepted = await acceptInvitation(db, invite.token, {
      mode: 'signup',
      name: 'Dev',
      password: 'pw123456',
    })
    expect(accepted.workspaceId).toBe(workspace.id)

    const members = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(users.email, 'dev@example.com'))
    expect(members[0]?.role).toBe('member')

    const inv = await db.select().from(invitations).limit(1)
    expect(inv[0]?.status).toBe('accepted')
    close()
  })

  it('accepts an invitation with an existing account whose email matches', async () => {
    const { db, close } = createTestDb()
    const { user, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })
    const { user: dev } = await signup(db, {
      name: 'Dev',
      email: 'dev@example.com',
      password: 'pw123456',
      businessName: 'Other',
    })
    const invite = await inviteMember(db, workspace.id, user.id, { email: 'dev@example.com' })

    const accepted = await acceptInvitation(db, invite.token, { mode: 'login', userId: dev.id })
    expect(accepted.workspaceId).toBe(workspace.id)

    const workspaces = await listWorkspaces(db, dev.id)
    expect(workspaces.map((w) => w.id)).toContain(workspace.id)
    close()
  })

  it('rejects an expired invitation', async () => {
    const { db, close } = createTestDb()
    const { user, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })
    const invite = await inviteMember(db, workspace.id, user.id, { email: 'dev@example.com' })
    await db
      .update(invitations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invitations.workspaceId, workspace.id))

    await expect(acceptInvitation(db, invite.token, { mode: 'signup', name: 'Dev', password: 'pw123456' })).rejects.toMatchObject(
      { code: 'TOKEN_INVALID' },
    )
    close()
  })
})