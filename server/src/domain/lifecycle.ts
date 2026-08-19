export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'followed_up'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'cancelled'

export const QUOTE_STATUSES: readonly QuoteStatus[] = [
  'draft',
  'sent',
  'followed_up',
  'accepted',
  'declined',
  'expired',
  'cancelled',
]

const TERMINAL: ReadonlySet<QuoteStatus> = new Set([
  'accepted',
  'declined',
  'expired',
  'cancelled',
])

const TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['followed_up', 'accepted', 'declined', 'expired', 'cancelled'],
  followed_up: ['accepted', 'declined', 'expired', 'cancelled'],
  accepted: [],
  declined: [],
  expired: [],
  cancelled: [],
}

export function isTerminal(status: QuoteStatus): boolean {
  return TERMINAL.has(status)
}

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export type ProductStage = 'Sent' | 'Followed Up' | 'Booked' | 'Lost'

export function toProductStage(status: QuoteStatus): ProductStage {
  switch (status) {
    case 'accepted':
      return 'Booked'
    case 'declined':
    case 'expired':
      return 'Lost'
    case 'followed_up':
      return 'Followed Up'
    default:
      return 'Sent'
  }
}
