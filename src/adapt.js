// Adapters between the backend API contract and the UI's shape model.
// Backend: ISO statuses, integer minor units, camelCase, IDs.
// UI: stage labels ('Sent'/'Followed Up'/'Booked'/'Lost'), major units, 'client'/'service'.

import { currencyMinorExponent } from '../server/src/domain/currency.js'
import { toProductStage } from '../server/src/domain/lifecycle.js'
import { formatMinor } from '../server/src/domain/money.js'

// UI stages (in pipeline order).
export const STAGES = ['Sent', 'Followed Up', 'Booked', 'Lost']

export const STATUS_META = {
  Sent: { className: 'sent', label: 'Sent' },
  'Followed Up': { className: 'followed', label: 'Followed up' },
  Booked: { className: 'booked', label: 'Booked' },
  Lost: { className: 'lost', label: 'Lost' },
}

export const initials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

// Formats major-unit values (as used by the UI) in the given currency.
export const money = {
  format(value, currency = 'NGN') {
    return formatMinor(Math.round(value * 10 ** currencyMinorExponent(currency)), currency)
  },
}

export function quoteToUi(q) {
  const status = toProductStage(q.status)
  const exp = currencyMinorExponent(q.currency)
  return {
    id: q.id,
    client: q.clientName,
    company: q.clientCompany || '',
    email: q.clientEmail || '',
    phone: q.clientPhone || '',
    service: q.serviceDescription,
    value: q.totalMinor / 10 ** exp,
    currency: q.currency,
    status,
    sent: q.sentAt ? new Date(q.sentAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    followUp: followUpLabel(q),
    // raw backend quote for actions (send, revoke, cancel)
    _raw: q,
  }
}

function followUpLabel(q) {
  if (q.status === 'accepted') return 'Completed'
  if (q.status === 'declined' || q.status === 'expired' || q.status === 'cancelled') return 'Closed'
  if (q.status === 'draft') return 'Draft'
  const due = q.followUpDays
    ? new Date((q.sentAt ? new Date(q.sentAt).getTime() : Date.now()) + q.followUpDays * 86_400_000)
    : null
  if (due && due.getTime() < Date.now()) return 'Overdue'
  if (due) return due.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  return '—'
}

export function moneyFormat(value, currency = 'NGN') {
  return formatMinor(Math.round(value * 10 ** currencyMinorExponent(currency)), currency)
}

export function workspaceToUi(ws) {
  return {
    id: ws.id,
    businessName: ws.businessName,
    replyToEmail: ws.replyToEmail,
    logoUrl: ws.logoUrl,
    phone: ws.phone,
    address: ws.address,
    website: ws.website,
    paymentInstructions: ws.paymentInstructions,
    defaultCurrency: ws.defaultCurrency,
    accentColor: ws.accentColor,
    status: ws.status,
  }
}

export { formatMinor }
