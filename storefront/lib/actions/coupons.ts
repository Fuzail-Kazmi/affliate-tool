'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { coupons } from '@/lib/db/schema'
import { authorized } from '@/lib/authorized'
import { getSession } from '@/lib/auth'

async function requireAdmin() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

export async function createCoupon(formData: FormData) {
  const actor = await requireAdmin()

  const storeId = parseInt(formData.get('storeId') as string)
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const type = formData.get('type') as 'copy' | 'link'
  const code = formData.get('code') as string
  const linkUrl = formData.get('linkUrl') as string
  const expiresAt = formData.get('expiresAt') as string

  if (!title || !type || !storeId) {
    return { error: 'Title, type, and store are required' }
  }

  await authorized(actor,'admin',async db => db.insert(coupons).values({
    storeId,
    title,
    description: description || null,
    type,
    code: type === 'copy' ? code || null : null,
    linkUrl: linkUrl || null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  }))

  revalidatePath('/')
  redirect('/admin/coupons')
}

export async function updateCoupon(id: number, formData: FormData) {
  const actor = await requireAdmin()

  const storeId = parseInt(formData.get('storeId') as string)
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const type = formData.get('type') as 'copy' | 'link'
  const code = formData.get('code') as string
  const linkUrl = formData.get('linkUrl') as string
  const expiresAt = formData.get('expiresAt') as string

  if (!title || !type || !storeId) {
    return { error: 'Title, type, and store are required' }
  }

  await authorized(actor,'admin',async db => db
    .update(coupons)
    .set({
      storeId,
      title,
      description: description || null,
      type,
      code: type === 'copy' ? code || null : null,
      linkUrl: linkUrl || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .where(eq(coupons.id, id)))

  revalidatePath('/')
  redirect('/admin/coupons')
}

export async function deleteCoupon(id: number) {
  const actor = await requireAdmin()
  await authorized(actor,'admin',async db => db.delete(coupons).where(eq(coupons.id, id)))
  revalidatePath('/', 'layout')
  revalidatePath('/admin/coupons')
}

export async function reorderCoupons(orderedIds: number[]) {
  const actor = await requireAdmin()
  await authorized(actor,'admin',async db=>Promise.all(
    orderedIds.map((id, index) =>
      db.update(coupons).set({ sortOrder: index }).where(eq(coupons.id, id))
    )
  ))
  revalidatePath('/')
  revalidatePath('/admin/coupons')
}
