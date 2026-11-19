import { describe, expect, test } from 'bun:test'
import { can, permissions, type Actor } from '../lib/access'

const actor: Actor = {
  userId: 9,
  email: 'test@example.test',
  role: 'Store Adder',
  grants: null,
  version: 0,
}
describe('workspace access', () => {
  test('administrators can manage every permission', () => {
    expect(permissions.every((p) => can({ ...actor, role: 'Admin' }, p))).toBe(
      true,
    )
  })
  test('employee defaults keep merchant links protected', () => {
    for (const role of ['Store Adder', 'Store Updater']) {
      const employee = { ...actor, role }
      for (const p of [
        'links.add',
        'links.update',
        'links.delete',
        'assign.write',
        'reports.read',
        'audit.read',
      ] as const)
        expect(can(employee, p)).toBe(false)
      expect(can(employee, 'offers.write')).toBe(true)
      expect(can(employee, 'team.read')).toBe(role === 'Store Updater')
    }
  })
  test('individual grants replace defaults and unknown roles receive no grants', () => {
    expect(can({ ...actor, grants: [] }, 'offers.write')).toBe(false)
    expect(can({ ...actor, grants: ['links.add'] }, 'links.add')).toBe(true)
    expect(
      can({ ...actor, role: 'Visitor', grants: ['links.add'] }, 'links.add'),
    ).toBe(false)
  })
})
