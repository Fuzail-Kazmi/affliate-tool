export const roles = ['Admin', 'Store Adder', 'Store Updater'] as const
export const permissions = [
  'stores.read',
  'stores.add',
  'stores.update',
  'stores.delete',
  'links.add',
  'links.update',
  'links.delete',
  'offers.write',
  'work.write',
  'assign.write',
  'sheets.read',
  'team.read',
  'reports.read',
  'audit.read',
] as const
export type Permission = (typeof permissions)[number]
export type Actor = {
  userId: number
  email: string
  role: string
  grants: string[] | null
  version: number
}
export function can(actor: Actor, permission: Permission) {
  if (actor.role === 'Admin') return true
  if (!roles.some((r) => r === actor.role)) return false
  const defaults = ['stores.read', 'work.write', 'offers.write', 'sheets.read']
  if (actor.role === 'Store Updater')
    defaults.push('stores.update', 'team.read')
  return (actor.grants ?? defaults).includes(permission)
}
