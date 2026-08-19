import { eq } from 'drizzle-orm'
import type { Db } from '../db/index.js'
import { users, workspaces, workspaceMembers, type User, type Workspace } from '../db/schema.js'
import { errors } from '../errors.js'
import { hashPassword, verifyPassword } from './password.js'
import { signAccessToken } from './tokens.js'
import { createSession, findValidSession, revokeSession } from './session.js'
import { config } from '../config.js'

export interface SignupInput {
  name: string
  email: string
  password: string
  businessName: string
}

export interface AuthResult {
  user: Pick<User, 'id' | 'name' | 'email'>
  workspace: Pick<Workspace, 'id' | 'businessName'>
  accessToken: string
  refreshToken: string
  sessionId: string
  expiresAt: Date
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

export async function signup(db: Db, input: SignupInput): Promise<AuthResult> {
  const email = normalizeEmail(input.email)
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) throw errors.emailTaken()

  const passwordHash = await hashPassword(input.password)
  const replyToEmail = email

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ name: input.name, email, passwordHash, emailVerifiedAt: null })
      .returning({ id: users.id, name: users.name, email: users.email })

    const [workspace] = await tx
      .insert(workspaces)
      .values({ businessName: input.businessName, replyToEmail })
      .returning({ id: workspaces.id, businessName: workspaces.businessName })

    if (!user || !workspace) throw new Error('Signup failed')

    await tx.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: user.id, role: 'owner' })

    const session = await createSession(tx, user.id)
    const accessToken = await signAccessToken(user.id, config.ACCESS_TOKEN_TTL)
    return { user, workspace, accessToken, ...session }
  })
}

export async function login(db: Db, email: string, password: string): Promise<AuthResult> {
  const user = (await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1))[0]
  if (!user) throw errors.invalidCredentials()

  const ok = await verifyPassword(user.passwordHash, password)
  if (!ok) throw errors.invalidCredentials()

  const workspace = await primaryWorkspace(db, user.id)
  const session = await createSession(db, user.id)
  const accessToken = await signAccessToken(user.id, config.ACCESS_TOKEN_TTL)
  return {
    user: { id: user.id, name: user.name, email: user.email },
    workspace,
    accessToken,
    ...session,
  }
}

export async function refresh(db: Db, refreshToken: string): Promise<AuthResult> {
  const session = await findValidSession(db, refreshToken)
  if (!session) throw errors.tokenInvalid()

  await revokeSession(db, session.id)
  const user = await getUserById(db, session.userId)
  const workspace = await primaryWorkspace(db, user.id)
  const newSession = await createSession(db, user.id, session.userAgent ?? undefined)
  const accessToken = await signAccessToken(user.id, config.ACCESS_TOKEN_TTL)
  return {
    user: { id: user.id, name: user.name, email: user.email },
    workspace,
    accessToken,
    ...newSession,
  }
}

export async function logout(db: Db, refreshToken: string): Promise<void> {
  const session = await findValidSession(db, refreshToken)
  if (session) await revokeSession(db, session.id)
}

export async function getUserById(db: Db, id: string): Promise<User> {
  const user = (await db.select().from(users).where(eq(users.id, id)).limit(1))[0]
  if (!user) throw errors.unauthorized()
  return user
}

export async function primaryWorkspace(
  db: Db,
  userId: string,
): Promise<Pick<Workspace, 'id' | 'businessName'>> {
  const rows = await db
    .select({
      id: workspaces.id,
      businessName: workspaces.businessName,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(workspaceMembers.createdAt)
    .limit(1)
  const workspace = rows[0]
  if (!workspace) throw errors.unauthorized('No workspace found')
  return workspace
}
