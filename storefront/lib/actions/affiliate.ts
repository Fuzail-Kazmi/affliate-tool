'use server'

import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { authorized, storeScope } from '@/lib/authorized'
import { can } from '@/lib/access'
import { tasks } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import { getActor } from '@/lib/auth'
import { db } from '@/lib/db'
import { coupons, offerScans, stores } from '@/lib/db/schema'
import type { Discovery, Scan } from '@/lib/affiliate/types'

type Result<T> = { ok: true; value: T } | { ok: false; error: string }
const signIn = {
  ok: false as const,
  error: 'Sign in to the admin portal to continue.',
}

export async function latestScan(
  storeId: number,
): Promise<Result<Scan | null>> {
  const admin = await getActor()
  if (!admin || !can(admin, 'offers.write') || !can(admin, 'stores.read'))
    return signIn
  if (
    !(await authorized(admin, 'offers.write', (tx) =>
      storeScope(tx, admin, storeId),
    ))
  )
    return signIn
  const [scan] = await db
    .select()
    .from(offerScans)
    .where(
      and(
        eq(offerScans.storeId, storeId),
        eq(offerScans.adminId, admin.userId),
      ),
    )
    .orderBy(desc(offerScans.id))
    .limit(1)
  return { ok: true, value: scan ?? null }
}

export async function discover(
  storeId: number,
  address: string,
): Promise<Result<Scan>> {
  const admin = await getActor()
  if (!admin || !can(admin, 'offers.write') || !can(admin, 'stores.read'))
    return signIn
  if (
    !Number.isSafeInteger(storeId) ||
    typeof address !== 'string' ||
    address.length > 2048
  )
    return { ok: false, error: 'Choose a store and enter its website.' }
  let url: URL
  try {
    url = new URL(address)
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw Error()
  } catch {
    return { ok: false, error: 'Enter a valid public merchant website URL.' }
  }
  const [store] = await db
    .select({ id: stores.id, website: stores.website })
    .from(stores)
    .where(eq(stores.id, storeId))
  if (!store)
    return { ok: false, error: 'This store is no longer in the catalog.' }
  if (
    !(await authorized(admin, 'offers.write', (tx) =>
      storeScope(tx, admin, storeId),
    ))
  )
    return signIn
  if (
    store.website !== url.href &&
    !can(admin, store.website ? 'links.update' : 'links.add')
  )
    return { ok: false, error: 'Use the assigned merchant website.' }
  let result: Discovery & { error?: string }
  try {
    const { stdout } = await promisify(execFile)(
      process.env.PYTHON_BIN || 'python',
      ['-m', 'src.offer_cli', url.href],
      {
        cwd: resolve(process.cwd(), '..'),
        timeout: 150_000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
    )
    result = JSON.parse(stdout)
  } catch {
    return {
      ok: false,
      error:
        'The analysis worker was unavailable or timed out. Check the Python runtime and retry.',
    }
  }
  if (result.error) return { ok: false, error: result.error }
  const scan = await authorized(admin, 'offers.write', async (tx, actor) => {
    if (!can(actor, 'stores.read') || !(await storeScope(tx, actor, storeId)))
      throw Error('Assignment changed.')
    const [current] = await tx
      .select()
      .from(stores)
      .where(eq(stores.id, storeId))
      .for('update')
    if (current.website !== store.website)
      throw Error('Website changed. Retry analysis.')
    if (
      current.website !== url.href &&
      !can(actor, current.website ? 'links.update' : 'links.add')
    )
      throw Error('Website permission revoked.')
    const logo =
      !current.imageUrl && can(actor, 'stores.update') ? result.logo : undefined
    if (current.website !== url.href || logo)
      await tx
        .update(stores)
        .set({ website: url.href, imageUrl: logo || undefined })
        .where(eq(stores.id, storeId))
    const [row] = await tx
      .insert(offerScans)
      .values({ storeId, adminId: admin.userId, url: url.href, result })
      .returning()
    return row
  })
  return { ok: true, value: scan }
}

export async function publishOffers(
  scanId: number,
  indices: number[],
): Promise<Result<{ saved: number[]; inserted: number; slug: string }>> {
  const admin = await getActor()
  if (!admin || !can(admin, 'offers.write') || !can(admin, 'stores.read'))
    return signIn
  if (
    !Number.isSafeInteger(scanId) ||
    !Array.isArray(indices) ||
    !indices.length ||
    indices.length > 200 ||
    indices.some((i) => !Number.isInteger(i) || i < 0)
  )
    return { ok: false, error: 'Select offers from the current scan.' }
  const result = await authorized(admin, 'offers.write', async (tx, actor) => {
    const [scan] = await tx
      .select()
      .from(offerScans)
      .where(
        and(eq(offerScans.id, scanId), eq(offerScans.adminId, admin.userId)),
      )
      .for('update')
    if (!scan || indices.some((i) => i >= scan.result.offers.length))
      return null
    if (
      !can(actor, 'stores.read') ||
      !(await storeScope(tx, actor, scan.storeId))
    )
      return null
    if (actor.role !== 'Admin' && !can(actor, 'work.write')) return null
    const [store] = await tx
      .select()
      .from(stores)
      .where(eq(stores.id, scan.storeId))
      .for('update')
    const job = await tx
      .update(tasks)
      .set({ completed: sql`now()` })
      .where(
        sql`store_id=${scan.storeId} and employee_id=${actor.userId} and completed is null and started is not null`,
      )
      .returning({ id: tasks.id })
    if (actor.role !== 'Admin' && !job.length)
      return {
        error: 'Start the assignment in your workspace before publishing.',
      } as const
    const previous = await tx
      .select({ title: coupons.title, code: coupons.code })
      .from(coupons)
      .where(eq(coupons.storeId, store.id))
    const keys = new Set(
      previous.map((o) => (o.code || o.title).trim().toLowerCase()),
    )
    const saved = new Set(scan.saved)
    let inserted = 0
    for (const i of new Set(indices)) {
      if (saved.has(i)) continue
      const o = scan.result.offers[i]
      const key = (o.code || o.title).trim().toLowerCase()
      if (!keys.has(key)) {
        await tx.insert(coupons).values({
          storeId: store.id,
          title: o.title,
          description: o.evidence,
          type: o.code ? 'copy' : 'link',
          code: o.code || null,
          linkUrl: o.source,
        })
        keys.add(key)
        inserted++
      }
      saved.add(i)
    }
    await tx
      .update(offerScans)
      .set({ saved: [...saved] })
      .where(eq(offerScans.id, scan.id))
    return { saved: [...saved], inserted, slug: store.slug }
  })
  if (!result)
    return {
      ok: false,
      error: 'This scan is unavailable. Open the store and analyze it again.',
    }
  if ('error' in result)
    return { ok: false, error: result.error || 'Cannot publish this scan.' }
  revalidatePath('/admin/coupons')
  revalidatePath('/admin')
  revalidatePath('/' + result.slug + '/view/vouchers')
  revalidatePath('/')
  return { ok: true, value: result }
}
