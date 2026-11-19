'use server'
import { and, asc, count, eq, gte, isNull, lte, or } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { coupons, stores } from '@/lib/db/schema'
import { classify } from '@/lib/affiliate/questions'

type Answer = {
  text: string
  storeId?: number
  link?: { href: string; label: string }
}

export async function askStore(
  question: string,
  contextId?: number,
): Promise<Answer> {
  if (!(await getSession()))
    return { text: 'Sign in to the admin portal to ask about stores.' }
  if (typeof question !== 'string' || !question.trim() || question.length > 600)
    return { text: 'Enter a store question of up to 600 characters.' }
  const catalog = await db
    .select({ id: stores.id, name: stores.name, slug: stores.slug })
    .from(stores)
    .orderBy(asc(stores.name))
  const norm = (s: string) =>
    ' ' +
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim() +
    ' '
  const named = [...catalog]
    .sort((a, b) => b.name.length - a.name.length)
    .find((s) => norm(question).includes(norm(s.name)))
  const allStores = /\b(all stores|across the catalog|every store)\b/i.test(
    question,
  )
  const store = allStores
    ? undefined
    : named || catalog.find((s) => s.id === contextId)
  const intent = await classify(question, named ? [named.name] : [])
  const tool = {
    href: '/admin/affliate-tool' + (store ? '?store=' + store.id : ''),
    label: 'Open Affliate Tool',
  }
  if (intent === 'outside')
    return {
      text: 'I can help with store listings, offers, coupon codes, expiry dates, and offer discovery. Which store would you like to check?',
    }
  if (
    !named &&
    !allStores &&
    /\b(?:offers?|coupons?|codes?|deals?)\s+(?:for|at|from)\s+(?!this store|the store|it\b)\S/i.test(
      question,
    )
  )
    return {
      text: 'I could not match that merchant to a catalog store. Use its name from Stores.',
      link: { href: '/admin/stores', label: 'View stores' },
    }
  if (intent === 'discover')
    return {
      text: 'Open Affliate Tool, select a store, enter its merchant website, and choose Analyze website. Review the source and any coupon test results before publishing.',
      link: tool,
    }
  if (intent === 'publish')
    return {
      text: 'Select the discoveries you want and choose Publish selected. Saved offers appear under Coupons and on that store’s public voucher page. Repeat saves skip existing offers.',
      link: tool,
    }
  if (intent === 'verify')
    return {
      text: 'Compatible Shopify stores are tested with separate guest carts using the lowest- and highest-priced available variants in the readable catalog. A matching accepted code must reduce the cart total. “Sitewide coupon (sampled)” requires savings at both ends of a distinct price range. Untested codes still need review.',
      link: tool,
    }
  if (intent === 'empty') {
    const empty = await db
      .select({ name: stores.name })
      .from(stores)
      .leftJoin(coupons, eq(coupons.storeId, stores.id))
      .where(isNull(coupons.id))
      .orderBy(asc(stores.name))
    return {
      text: empty.length
        ? `${empty.length} stores have no published offers: ${empty
            .slice(0, 20)
            .map((s) => s.name)
            .join(', ')}.${empty.length > 20 ? ' Showing the first 20.' : ''}`
        : catalog.length
          ? 'Every store has at least one published offer.'
          : 'Your catalog is empty. Add a store to start.',
      link: tool,
    }
  }
  if (intent === 'catalog' && !store)
    return {
      text: `Your catalog has ${catalog.length} stores.${
        catalog.length
          ? ' ' +
            catalog
              .slice(0, 20)
              .map((s) => s.name)
              .join(', ') +
            '.'
          : ''
      }`,
      link: { href: '/admin/stores', label: 'View stores' },
    }
  const now = new Date()
  const conditions = [
    or(isNull(coupons.expiresAt), gte(coupons.expiresAt, now)),
  ]
  if (store) conditions.push(eq(coupons.storeId, store.id))
  if (intent === 'codes') conditions.push(eq(coupons.type, 'copy'))
  if (intent === 'expiry')
    conditions.push(
      lte(coupons.expiresAt, new Date(now.getTime() + 30 * 86400000)),
    )
  const where = and(...conditions)
  const [[total], items] = await Promise.all([
    db.select({ n: count() }).from(coupons).where(where),
    db
      .select({
        title: coupons.title,
        code: coupons.code,
        merchant: stores.name,
        expires: coupons.expiresAt,
      })
      .from(coupons)
      .innerJoin(stores, eq(stores.id, coupons.storeId))
      .where(where)
      .orderBy(asc(coupons.expiresAt), asc(coupons.id))
      .limit(6),
  ])
  const label =
    intent === 'expiry'
      ? 'offers expiring in the next 30 days'
      : intent === 'codes'
        ? 'current coupon codes'
        : 'current offers'
  return {
    text:
      `${store?.name || 'Across the catalog'} · ${total.n} ${label}.` +
      items
        .map(
          (o) =>
            `\n• ${store ? '' : o.merchant + ' — '}${o.title}${o.code ? ' [' + o.code + ']' : ''}${o.expires ? ' · expires ' + o.expires.toISOString().slice(0, 10) : ''}`,
        )
        .join('') +
      (total.n > items.length ? '\nShowing the first six.' : ''),
    storeId: store?.id,
    link: store
      ? {
          href: '/' + encodeURIComponent(store.slug) + '/view/vouchers',
          label: 'View store vouchers',
        }
      : { href: '/admin/coupons', label: 'View coupons' },
  }
}
