import { eq, sql } from 'drizzle-orm'
import { db } from './db'
import { users } from './db/schema'
import { can, type Actor, type Permission } from './access'

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
export async function authorized<T>(
  session: Actor,
  permission: Permission | 'admin',
  work: (tx: Tx, actor: Actor) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .for('share')
    if (!user?.active || user.sessionVersion !== session.version)
      throw Error('Session expired.')
    const actor = { ...session, role: user.role, grants: user.grants }
    if (
      permission === 'admin' ? actor.role !== 'Admin' : !can(actor, permission)
    )
      throw Error('Permission denied.')
    await tx.execute(
      sql`select set_config('unity.actor',${user.email},true),set_config('unity.role',${user.role},true)`,
    )
    return work(tx, actor)
  })
}
export async function storeScope(tx: Tx, actor: Actor, id: number) {
  if (actor.role === 'Admin') return true
  const r = await tx.execute(
    sql`select id from tasks where store_id=${id} and employee_id=${actor.userId} and completed is null for update`,
  )
  return !!r.rows.length
}
