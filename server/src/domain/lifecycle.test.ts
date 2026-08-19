import { describe, it, expect } from 'vitest'
import { canTransition, isTerminal, toProductStage } from './lifecycle.js'

describe('lifecycle', () => {
  it('allows draft to sent and cancelled only', () => {
    expect(canTransition('draft', 'sent')).toBe(true)
    expect(canTransition('draft', 'cancelled')).toBe(true)
    expect(canTransition('draft', 'accepted')).toBe(false)
  })

  it('allows sent to terminal states and followed_up', () => {
    expect(canTransition('sent', 'accepted')).toBe(true)
    expect(canTransition('sent', 'declined')).toBe(true)
    expect(canTransition('sent', 'expired')).toBe(true)
    expect(canTransition('sent', 'followed_up')).toBe(true)
    expect(canTransition('sent', 'draft')).toBe(false)
  })

  it('never leaves a terminal state', () => {
    for (const s of ['accepted', 'declined', 'expired', 'cancelled'] as const) {
      expect(isTerminal(s)).toBe(true)
      expect(canTransition(s, 'sent')).toBe(false)
      expect(canTransition(s, 'draft')).toBe(false)
    }
  })

  it('maps statuses to product stages', () => {
    expect(toProductStage('accepted')).toBe('Booked')
    expect(toProductStage('declined')).toBe('Lost')
    expect(toProductStage('expired')).toBe('Lost')
    expect(toProductStage('followed_up')).toBe('Followed Up')
    expect(toProductStage('sent')).toBe('Sent')
  })
})
