import type { Quote, QuoteItem, Workspace } from '../db/schema.js'

export interface QuoteSnapshot {
  quote: Quote
  items: QuoteItem[]
  workspace: Pick<
    Workspace,
    | 'businessName'
    | 'replyToEmail'
    | 'logoUrl'
    | 'phone'
    | 'address'
    | 'website'
    | 'paymentInstructions'
    | 'accentColor'
  >
  versionNumber: number
  issuedAt: string
}
