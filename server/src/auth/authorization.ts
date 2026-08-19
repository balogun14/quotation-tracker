export type Role = 'owner' | 'member'

export type Permission =
  | 'workspace:manage'
  | 'workspace:delete'
  | 'members:manage'
  | 'quotes:manage'
  | 'reports:read'
  | 'reports:export'
  | 'fx:override'

const PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: [
    'workspace:manage',
    'workspace:delete',
    'members:manage',
    'quotes:manage',
    'reports:read',
    'reports:export',
    'fx:override',
  ],
  member: ['quotes:manage', 'reports:read'],
}

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission)
}
