import { getActor } from '@/lib/auth'
import { orderAccess } from '@/lib/store-order'
import OfferOrderLink from '@/app/_components/OfferOrderLink'
import { getTableColumns } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/lib/db'
import { stores } from '@/lib/db/schema'
import StoreLogo from '@/app/_components/StoreLogo'

export const dynamic = 'force-dynamic'
export default async function Catalog() {
  const shops = await db
    .select({
      ...getTableColumns(stores),
      editable: orderAccess(await getActor()),
    })
    .from(stores)
    .orderBy(stores.sortOrder, stores.name)
  return (
    <div className="workspace ua-content">
      <header>
        <h1>Store offers</h1>
        <p>Choose a store to browse its deals and coupon codes.</p>
      </header>
      <div className="catalog-grid">
        {shops.map((store) => (
          <article key={store.id} className="relative">
            <Link
              className="work-card h-full grid content-start justify-items-start gap-3 hover:bg-gray-50"
              href={'/' + store.slug + '/view/vouchers'}
            >
              <StoreLogo {...store} />
              <div>
                <h2>{store.name}</h2>
                <small>View offers</small>
              </div>
            </Link>
            {store.editable && (
              <div className="absolute right-3 top-3">
                <OfferOrderLink {...store} />
              </div>
            )}
          </article>
        ))}
      </div>
      {!shops.length && <p>No stores are listed yet.</p>}
    </div>
  )
}
