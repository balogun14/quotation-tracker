import { describe, it, expect } from 'vitest'
import { createTestDb } from '../test/db.js'
import { signup } from '../auth/service.js'
import { users, workspaceMembers } from '../db/schema.js'
import {
  getMembership,
  requireMember,
  listWorkspaces,
  listMembers,
  updateBranding,
  changeRole,
  removeMember,
} from './service.js'
import { errors } from '../errors.js'

describe('workspace service', () => {
  it('lists workspaces for a user and updates branding', async () => {
    const { db, close } = createTestDb()
    const { user, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme Rentals',
    })

    const memberships = await listWorkspaces(db, user.id)
    expect(memberships).toHaveLength(1)
    expect(memberships[0]?.role).toBe('owner')

    await updateBranding(db, workspace.id, user.id, { accentColor: '#FF0000', defaultCurrency: 'USD' })
    const membership = await getMembership(db, workspace.id, user.id)
    expect(membership?.role).toBe('owner')

    close()
  })

  it('enforces membership when requiring a member', async () => {
    const { db, close } = createTestDb()
    const { workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })

    await expect(requireMember(db, workspace.id, 'not-a-user')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    close()
  })

  it('prevents removing the last owner', async () => {
    const { db, close } = createTestDb()
    const { user, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })

    await expect(removeMember(db, workspace.id, user.id, user.id)).rejects.toMatchObject({ code: 'CONFLICT' })
    close()
  })

  it('promotes a member to owner, then allows demotion back', async () => {
    const { db, close } = createTestDb()
    const { user: owner, workspace } = await signup(db, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'pw123456',
      businessName: 'Acme',
    })

    const [memberUser] = await db
      .insert(users)
      .values({ name: 'Member', email: 'member@example.com', passwordHash: 'x' })
      .returning({ id: users.id })
    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: memberUser!.id,
      role: 'member',
    })

    await changeRole(db, workspace.id, owner.id, memberUser!.id, 'owner')
    const members = await listMembers(db, workspace.id)
    expect(members).toHaveLength(2)

    await changeRole(db, workspace.id, owner.id, memberUser!.id, 'member')
    expect((await getMembership(db, workspace.id, memberUser!.id))?.role).toBe('member')
    close()
  })
})
