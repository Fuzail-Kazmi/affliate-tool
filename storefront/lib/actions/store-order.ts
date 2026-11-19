'use server'
import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getActor } from '../auth'
import { authorized } from '../authorized'
import { stores, coupons } from '../db/schema'
import { orderAccess, validOfferOrder } from '../store-order'

export async function saveStoreOrder(
  id: number,
  original: number[],
  proposed: number[],
) {
  const actor = await getActor()
  if (
    !actor ||
    !Number.isSafeInteger(id) ||
    !Array.isArray(original) ||
    !Array.isArray(proposed)
  )
    return { error: 'Sign in and reopen this store.' }
  const result = await authorized(
    actor,
    'offers.write',
    async (tx, currentActor) => {
      const [store] = await tx
        .select({ slug: stores.slug })
        .from(stores)
        .where(eq(stores.id, id))
        .for('update')
      if (!store) return { error: 'This store is unavailable.' }
      const [allowed] = await tx
        .select({ id: stores.id })
        .from(stores)
        .where(and(eq(stores.id, id), orderAccess(currentActor)))
      if (!allowed)
        return { error: 'You no longer have access to sort this store.' }
      const rows = await tx
        .select({ id: coupons.id })
        .from(coupons)
        .where(eq(coupons.storeId, id))
        .orderBy(coupons.sortOrder, coupons.createdAt, coupons.id)
        .for('update')
      if (
        !validOfferOrder(
          rows.map((row) => row.id),
          original,
          proposed,
        )
      )
        return {
          error:
            'The offers changed. Reopen the editor to load the latest order.',
        }
      if (rows.length)
        await tx.execute(
          sql`update coupons c set sort_order = r.position::integer - 1 from unnest(${sql.param(proposed)}::int[]) with ordinality as r(id,position) where c.store_id=${id} and c.id=r.id and c.sort_order<>r.position-1`,
        )
      return { slug: store.slug }
    },
  )
  if (result.slug) {
    revalidatePath('/' + result.slug + '/view/vouchers')
    revalidatePath('/admin/coupons')
  }
  return result
}
