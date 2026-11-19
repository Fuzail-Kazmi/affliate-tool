'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { products } from '@/lib/db/schema'
import { authorized } from '@/lib/authorized'
import { getSession } from '@/lib/auth'
import { resolveImageUrl } from '@/lib/upload'

async function requireAdmin() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

export async function createProduct(formData: FormData) {
  const actor = await requireAdmin()

  const name = formData.get('name') as string
  const price = formData.get('price') as string
  if (!name || !price) return { error: 'Name and price are required' }

  const imageUrl = await resolveImageUrl(formData)
  const linkUrl = formData.get('linkUrl') as string
  const existing = await db.select({ sortOrder: products.sortOrder }).from(products)
  const maxOrder = existing.length > 0 ? Math.max(...existing.map(r => r.sortOrder)) : -1

  await authorized(actor,'admin',async db => db.insert(products).values({ name, imageUrl, price, linkUrl: linkUrl || null, sortOrder: maxOrder + 1 }))

  revalidatePath('/')
  redirect('/admin/products')
}

export async function updateProduct(id: number, formData: FormData) {
  const actor = await requireAdmin()

  const name = formData.get('name') as string
  const price = formData.get('price') as string
  if (!name || !price) return { error: 'Name and price are required' }

  const imageUrl = await resolveImageUrl(formData)
  const linkUrl = formData.get('linkUrl') as string

  await authorized(actor,'admin',async db => db.update(products).set({ name, imageUrl, price, linkUrl: linkUrl || null }).where(eq(products.id, id)))

  revalidatePath('/')
  redirect('/admin/products')
}

export async function deleteProduct(id: number) {
  const actor = await requireAdmin()
  await authorized(actor,'admin',async db => db.delete(products).where(eq(products.id, id)))
  revalidatePath('/', 'layout')
  revalidatePath('/admin/products')
}
