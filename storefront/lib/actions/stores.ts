'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { stores } from '@/lib/db/schema'
import { authorized } from '@/lib/authorized'
import { getSession } from '@/lib/auth'
import { resolveImageUrl } from '@/lib/upload'

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function merchantWebsite(form: FormData) {
  const value = String(form.get('website') || '').trim()
  if (!value) return null
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw Error('Enter a valid merchant website.')
  return url.href
}

async function requireAdmin() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

export async function createStore(formData: FormData) {
  const actor = await requireAdmin()

  const name = formData.get('name') as string
  if (!name) return { error: 'Name is required' }

  const slug = slugify(name)
  const imageUrl = await resolveImageUrl(formData)

  await authorized(actor,'admin',async db => db.insert(stores).values({ name, slug, imageUrl, website:merchantWebsite(formData) }))

  revalidatePath('/')
  redirect('/admin/stores')
}

export async function updateStore(id: number, formData: FormData) {
  const actor = await requireAdmin()

  const name = formData.get('name') as string
  if (!name) return { error: 'Name is required' }

  const imageUrl = await resolveImageUrl(formData)

  await authorized(actor,'admin',async db => db.update(stores).set({ name, imageUrl, website:merchantWebsite(formData) }).where(eq(stores.id, id)))

  revalidatePath('/')
  redirect('/admin/stores')
}

export async function deleteStore(id: number) {
  const actor = await requireAdmin()
  await authorized(actor,'admin',async db => db.delete(stores).where(eq(stores.id, id)))
  revalidatePath('/', 'layout')
  revalidatePath('/admin/stores')
}

export async function reorderStores(orderedIds: number[]) {
  const actor = await requireAdmin()
  await authorized(actor,'admin',async db=>Promise.all(
    orderedIds.map((id, index) =>
      db.update(stores).set({ sortOrder: index }).where(eq(stores.id, id))
    )
  ))
  revalidatePath('/')
  revalidatePath('/admin/stores')
}
