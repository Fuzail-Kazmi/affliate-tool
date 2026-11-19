import { can } from '@/lib/access'
import { asc, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { getActor } from '@/lib/auth'
import { db } from '@/lib/db'
import { stores } from '@/lib/db/schema'
import { latestScan } from '@/lib/actions/affiliate'
import DiscoveryPanel from './DiscoveryPanel'

export const metadata = { title: 'Affliate Tool | UnityAffliate' }
export default async function ToolPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>
}) {
  const actor = await getActor()
  if (!actor) redirect('/login')
  if (!can(actor, 'offers.write') || !can(actor, 'stores.read'))
    redirect('/admin')
  const list = await db
    .select({
      id: stores.id,
      name: stores.name,
      slug: stores.slug,
      website: stores.website,
    })
    .from(stores)
    .where(
      actor.role === 'Admin'
        ? undefined
        : sql`exists(select 1 from tasks where store_id=${stores.id} and employee_id=${actor.userId} and completed is null)`,
    )
    .orderBy(asc(stores.name))
  const id = Number((await searchParams).store)
  const current = list.find((s) => s.id === id) || list[0]
  const latest = current ? await latestScan(current.id) : null
  return (
    <DiscoveryPanel
      key={current?.id ?? 0}
      stores={list}
      initial={current}
      admin={actor.role === 'Admin'}
      editWebsite={can(actor, current?.website ? 'links.update' : 'links.add')}
      initialScan={latest?.ok ? latest.value : null}
    />
  )
}
