import { sql } from 'drizzle-orm'
import { can, type Actor } from './access'
import { stores } from './db/schema'

export function orderAccess(actor: Actor | null) {
  if (actor?.role === 'Admin') return sql<boolean>`true`
  if (
    !actor ||
    actor.role !== 'Store Adder' ||
    !can(actor, 'offers.write') ||
    !can(actor, 'stores.read')
  )
    return sql<boolean>`false`
  return sql<boolean>`coalesce((select employee_id from tasks where store_id = ${stores}."id" order by id desc limit 1) = ${actor.userId}, false)`
}

export function validOfferOrder(
  current: number[],
  original: number[],
  proposed: number[],
) {
  if (current.length !== original.length || proposed.length !== current.length)
    return false
  const proposedIds = new Set(proposed)
  return (
    proposedIds.size === current.length &&
    current.every((id, index) => original[index] === id && proposedIds.has(id))
  )
}
