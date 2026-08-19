import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { index, integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sqliteTable } from 'drizzle-orm/sqlite-core'

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID())

const now = () => sql`(unixepoch() * 1000)`

export const users = sqliteTable(
  'users',
  {
    id: id(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    emailVerifiedAt: integer('email_verified_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
)

export const workspaces = sqliteTable('workspaces', {
  id: id(),
  businessName: text('business_name').notNull(),
  replyToEmail: text('reply_to_email').notNull(),
  logoUrl: text('logo_url'),
  phone: text('phone'),
  address: text('address'),
  website: text('website'),
  paymentInstructions: text('payment_instructions'),
  defaultCurrency: text('default_currency').notNull().default('NGN'),
  accentColor: text('accent_color').notNull().default('#4F46E5'),
  defaultQuoteExpiryDays: integer('default_quote_expiry_days').notNull().default(14),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  purgeAt: integer('purge_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export const workspaceMembers = sqliteTable(
  'workspace_members',
  {
    id: id(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'member'] }).notNull().default('member'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('workspace_members_unique').on(t.workspaceId, t.userId),
    index('workspace_members_workspace').on(t.workspaceId),
    index('workspace_members_user').on(t.userId),
  ],
)

export const refreshSessions = sqliteTable(
  'refresh_sessions',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('refresh_sessions_user').on(t.userId)],
)

export const invitations = sqliteTable(
  'invitations',
  {
    id: id(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role', { enum: ['owner', 'member'] }).notNull().default('member'),
    tokenHash: text('token_hash').notNull(),
    status: text('status', { enum: ['pending', 'accepted', 'revoked', 'expired'] })
      .notNull()
      .default('pending'),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    acceptedAt: integer('accepted_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('invitations_workspace').on(t.workspaceId)],
)

export const passwordResets = sqliteTable(
  'password_resets',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    usedAt: integer('used_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('password_resets_user').on(t.userId)],
)

export const emailVerifications = sqliteTable(
  'email_verifications',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    usedAt: integer('used_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('email_verifications_user').on(t.userId)],
)

export const quotes = sqliteTable(
  'quotes',
  {
    id: id(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    clientName: text('client_name').notNull(),
    clientCompany: text('client_company'),
    clientEmail: text('client_email'),
    clientPhone: text('client_phone'),
    serviceDescription: text('service_description').notNull(),
    notes: text('notes'),
    status: text('status', {
      enum: ['draft', 'sent', 'followed_up', 'accepted', 'declined', 'expired', 'cancelled'],
    })
      .notNull()
      .default('draft'),
    currency: text('currency').notNull(),
    expiryDate: integer('expiry_date', { mode: 'timestamp_ms' }),
    discountType: text('discount_type', { enum: ['percent', 'amount'] }),
    discountValue: integer('discount_value').notNull().default(0),
    taxRateBps: integer('tax_rate_bps').notNull().default(0),
    subtotalMinor: integer('subtotal_minor').notNull().default(0),
    discountMinor: integer('discount_minor').notNull().default(0),
    taxMinor: integer('tax_minor').notNull().default(0),
    totalMinor: integer('total_minor').notNull().default(0),
    followUpMode: text('follow_up_mode', { enum: ['reminder', 'email', 'none'] })
      .notNull()
      .default('reminder'),
    followUpDays: integer('follow_up_days'),
    sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
    decidedAt: integer('decided_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('quotes_workspace').on(t.workspaceId)],
)

export const quoteItems = sqliteTable(
  'quote_items',
  {
    id: id(),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    description: text('description').notNull(),
    quantity: integer('quantity').notNull(),
    unitPriceMinor: integer('unit_price_minor').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('quote_items_quote').on(t.quoteId)],
)

export const quoteVersions = sqliteTable(
  'quote_versions',
  {
    id: id(),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    snapshotJson: text('snapshot_json').notNull(),
    pdfFileId: text('pdf_file_id'),
    sentAt: integer('sent_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('quote_versions_unique').on(t.quoteId, t.versionNumber),
    index('quote_versions_quote').on(t.quoteId),
  ],
)

export const publicLinks = sqliteTable(
  'public_links',
  {
    id: id(),
    quoteVersionId: text('quote_version_id')
      .notNull()
      .references(() => quoteVersions.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('public_links_version').on(t.quoteVersionId)],
)

export const quoteDecisions = sqliteTable(
  'quote_decisions',
  {
    id: id(),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id, { onDelete: 'cascade' }),
    versionId: text('version_id')
      .notNull()
      .references(() => quoteVersions.id, { onDelete: 'cascade' }),
    decision: text('decision', { enum: ['accepted', 'declined'] }).notNull(),
    recipientName: text('recipient_name'),
    recipientEmail: text('recipient_email'),
    decidedAt: integer('decided_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('quote_decisions_quote').on(t.quoteId)],
)

export const followUps = sqliteTable(
  'follow_ups',
  {
    id: id(),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['reminder', 'email'] }).notNull().default('reminder'),
    dueAt: integer('due_at', { mode: 'timestamp_ms' }).notNull(),
    status: text('status', { enum: ['pending', 'sent', 'cancelled'] }).notNull().default('pending'),
    sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('follow_ups_quote').on(t.quoteId)],
)

export const fxRates = sqliteTable(
  'fx_rates',
  {
    id: id(),
    baseCurrency: text('base_currency').notNull(),
    quoteCurrency: text('quote_currency').notNull(),
    rate: text('rate').notNull(),
    precision: integer('precision').notNull(),
    rateDate: integer('rate_date', { mode: 'timestamp_ms' }).notNull(),
    source: text('source', { enum: ['frankfurter', 'manual'] }).notNull().default('frankfurter'),
    reason: text('reason'),
    actorId: text('actor_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('fx_rates_unique').on(t.baseCurrency, t.quoteCurrency, t.rateDate),
    index('fx_rates_pair').on(t.baseCurrency, t.quoteCurrency),
  ],
)

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: id(),
    workspaceId: text('workspace_id').notNull(),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    before: text('before'),
    after: text('after'),
    metadata: text('metadata'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('audit_events_workspace').on(t.workspaceId)],
)

export const jobs = sqliteTable(
  'jobs',
  {
    id: id(),
    type: text('type').notNull(),
    payload: text('payload').notNull().default('{}'),
    idempotencyKey: text('idempotency_key'),
    status: text('status', { enum: ['pending', 'running', 'done', 'failed'] })
      .notNull()
      .default('pending'),
    scheduledAt: integer('scheduled_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    lockedUntil: integer('locked_until', { mode: 'timestamp_ms' }),
    lastError: text('last_error'),
    runAt: integer('run_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index('jobs_status_scheduled').on(t.status, t.scheduledAt),
    uniqueIndex('jobs_idempotency_unique').on(t.idempotencyKey),
  ],
)

export const files = sqliteTable(
  'files',
  {
    id: id(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    originalName: text('original_name'),
    mimeType: text('mime_type').notNull().default('application/octet-stream'),
    size: integer('size').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('files_workspace').on(t.workspaceId)],
)

export type User = typeof users.$inferSelect
export type Workspace = typeof workspaces.$inferSelect
export type WorkspaceMember = typeof workspaceMembers.$inferSelect
export type Quote = typeof quotes.$inferSelect
export type QuoteItem = typeof quoteItems.$inferSelect
export type QuoteVersion = typeof quoteVersions.$inferSelect
export type Job = typeof jobs.$inferSelect
export type FileRow = typeof files.$inferSelect

export { now }
