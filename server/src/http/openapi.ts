const jsonBody = {
  content: {
    'application/json': { schema: { type: 'object' } },
  },
}

const errorResponses = {
  400: { description: 'Bad request', content: { 'application/json': { schema: { type: 'object' } } } },
  401: { description: 'Unauthorized', content: { 'application/json': { schema: { type: 'object' } } } },
  403: { description: 'Forbidden', content: { 'application/json': { schema: { type: 'object' } } } },
  404: { description: 'Not found', content: { 'application/json': { schema: { type: 'object' } } } },
  409: { description: 'Conflict', content: { 'application/json': { schema: { type: 'object' } } } },
  422: { description: 'Validation error', content: { 'application/json': { schema: { type: 'object' } } } },
  429: { description: 'Rate limited', content: { 'application/json': { schema: { type: 'object' } } } },
}

function ok(description: string) {
  return { description, content: { 'application/json': { schema: { type: 'object' } } } }
}

const bearer = {
  bearerAuth: [],
}

const paths: Record<string, unknown> = {}
function route(method: 'get' | 'post' | 'patch' | 'delete', path: string, tag: string, summary: string, opts: { auth?: boolean; ok?: string; created?: string } = {}) {
  const item: Record<string, unknown> = {
    summary,
    tags: [tag],
    security: opts.auth ? [bearer] : [],
    responses: {
      ...(opts.created ? { 201: ok(opts.created) } : {}),
      ...(opts.ok ? { 200: ok(opts.ok) } : {}),
      ...errorResponses,
    },
  }
  if (method !== 'get') item.requestBody = jsonBody
  const existing = (paths[path] ??= {}) as Record<string, unknown>
  existing[method] = item
}

route('post', '/auth/signup', 'auth', 'Create an account and workspace', { created: 'Created' })
route('post', '/auth/login', 'auth', 'Sign in', { ok: 'Signed in' })
route('post', '/auth/refresh', 'auth', 'Rotate the refresh token from cookie', { ok: 'Refreshed' })
route('post', '/auth/logout', 'auth', 'Revoke the refresh session and clear cookie')

route('get', '/account/me', 'account', 'Current user', { auth: true, ok: 'User' })
route('post', '/account/password-reset', 'account', 'Request a password reset email')
route('post', '/account/password-reset/confirm', 'account', 'Confirm a password reset')
route('post', '/account/verify-email', 'account', 'Send an email verification link', { auth: true })
route('post', '/account/verify-email/confirm', 'account', 'Confirm an email address')

route('get', '/workspaces', 'workspaces', 'List workspaces for the user', { auth: true, ok: 'Workspaces' })
route('get', '/workspaces/{id}', 'workspaces', 'Get workspace branding', { auth: true, ok: 'Workspace' })
route('patch', '/workspaces/{id}/branding', 'workspaces', 'Update workspace branding', { auth: true, ok: 'Workspace' })
route('delete', '/workspaces/{id}', 'workspaces', 'Schedule workspace deletion', { auth: true })
route('post', '/workspaces/{id}/restore', 'workspaces', 'Restore a deleted workspace', { auth: true, ok: 'Restored' })
route('get', '/workspaces/{id}/members', 'workspaces', 'List members', { auth: true, ok: 'Members' })
route('patch', '/workspaces/{id}/members/{userId}', 'workspaces', 'Change a member role', { auth: true, ok: 'Member' })
route('delete', '/workspaces/{id}/members/{userId}', 'workspaces', 'Remove a member', { auth: true })
route('get', '/workspaces/{id}/invitations', 'workspaces', 'List invitations', { auth: true, ok: 'Invitations' })
route('post', '/workspaces/{id}/invitations', 'workspaces', 'Invite a teammate by email', { auth: true, created: 'Invitation' })
route('post', '/workspaces/{id}/invitations/{invitationId}/revoke', 'workspaces', 'Revoke an invitation', { auth: true })
route('post', '/invitations/accept', 'workspaces', 'Accept an invitation with a new or existing account', { ok: 'Accepted' })
route('get', '/workspaces/{id}/audit', 'workspaces', 'List audit events', { auth: true, ok: 'Audit events' })
route('get', '/workspaces/{id}/export', 'workspaces', 'Export workspace data as JSON', { auth: true, ok: 'Workspace export' })

route('get', '/workspaces/{id}/quotes', 'quotes', 'List quotes with cursor pagination', { auth: true, ok: 'Quote page' })
route('post', '/workspaces/{id}/quotes', 'quotes', 'Create a draft quote', { auth: true, created: 'Quote' })
route('get', '/workspaces/{id}/quotes/{quoteId}', 'quotes', 'Get a quote', { auth: true, ok: 'Quote' })
route('patch', '/workspaces/{id}/quotes/{quoteId}', 'quotes', 'Update a quote', { auth: true, ok: 'Quote' })
route('delete', '/workspaces/{id}/quotes/{quoteId}', 'quotes', 'Cancel a quote', { auth: true })
route('post', '/workspaces/{id}/quotes/{quoteId}/send', 'quotes', 'Send a quote (snapshot, PDF, email, link)', { auth: true, ok: 'Sent' })
route('post', '/workspaces/{id}/quotes/{quoteId}/preview', 'quotes', 'Preview the quote PDF', { auth: true, ok: 'PDF' })
route('post', '/workspaces/{id}/quotes/{quoteId}/revoke-links', 'quotes', 'Revoke all public links', { auth: true, ok: 'Revoked' })

route('get', '/workspaces/{id}/reports/dashboard', 'reports', 'Native-currency dashboard totals', { auth: true, ok: 'Dashboard' })
route('get', '/workspaces/{id}/reports', 'reports', 'Filtered report with optional reporting currency', { auth: true, ok: 'Report' })
route('get', '/workspaces/{id}/reports/export.csv', 'reports', 'Export filtered quotes to CSV', { auth: true, ok: 'CSV' })
route('post', '/workspaces/{id}/fx/override', 'reports', 'Override an FX rate with a reason', { auth: true, ok: 'Rate' })

route('get', '/p/{token}', 'public', 'View a quote from a public link', { ok: 'Quote view' })
route('get', '/p/{token}/pdf', 'public', 'Download the branded PDF', { ok: 'PDF' })
route('post', '/p/{token}/decide', 'public', 'Accept or decline a quote', { ok: 'Decision' })

export const openapiJson = {
  openapi: '3.0.3',
  info: {
    title: 'Quotely API',
    version: '1.0.0',
    description: 'REST API for rental quotation tracking, under the /api/v1 namespace.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  paths,
}