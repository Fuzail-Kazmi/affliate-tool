import { can } from '@/lib/access'
import { redirect } from 'next/navigation'
import { getActor } from '@/lib/auth'
import { asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { stores } from '@/lib/db/schema'
import StoreAssistant from './StoreAssistant'
import AdminSidebar from './AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getActor()
  if (!session) redirect('/login')

  const [first] = await db
    .select({ id: stores.id })
    .from(stores)
    .orderBy(asc(stores.name))
    .limit(1)
  return (
    <div className="ua-admin">
      <AdminSidebar admin={session.role==="Admin"} offers={can(session,"offers.write") && can(session,"stores.read")}/>
      <main className="ua-main">
        <div className="ua-content">{children}</div>
      </main>
      {session.role==="Admin" && <StoreAssistant defaultStore={first?.id} />}
    </div>
  )
}
