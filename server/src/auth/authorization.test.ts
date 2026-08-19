import { describe, it, expect } from 'vitest'
import { can } from './authorization.js'

describe('authorization policy', () => {
  it('grants owners full control', () => {
    for (const p of [
      'workspace:manage',
      'workspace:delete',
      'members:manage',
      'quotes:manage',
      'reports:read',
      'reports:export',
      'fx:override',
    ] as const) {
      expect(can('owner', p)).toBe(true)
    }
  })

  it('limits members to quote and report work', () => {
    expect(can('member', 'quotes:manage')).toBe(true)
    expect(can('member', 'reports:read')).toBe(true)
    expect(can('member', 'members:manage')).toBe(false)
    expect(can('member', 'workspace:manage')).toBe(false)
    expect(can('member', 'workspace:delete')).toBe(false)
    expect(can('member', 'fx:override')).toBe(false)
    expect(can('member', 'reports:export')).toBe(false)
  })
})
