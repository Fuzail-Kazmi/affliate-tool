'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq, sql } from 'drizzle-orm'
import { users } from '@/lib/db/schema'
import { authorized } from '@/lib/authorized'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

async function requireAdmin() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

export async function deleteUser(id: number) {
  const actor = await requireAdmin()
  if (id === actor.userId)
    throw Error('Keep your current administrator account.')
  await authorized(actor, 'admin', async (db) =>
    db.delete(users).where(eq(users.id, id)),
  )
  revalidatePath('/admin/users')
}

export async function createUser(formData: FormData) {
  const actor = await requireAdmin()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) return { error: 'Email and password are required' }
  if (password.length < 8)
    return { error: 'Password must be at least 8 characters' }

  const passwordHash = await bcrypt.hash(password, 12)

  try {
    await authorized(actor, 'admin', async (db) =>
      db
        .insert(users)
        .values({
          email: email.trim().toLowerCase(),
          passwordHash,
          role:
            formData.get('role') === 'Store Updater'
              ? 'Store Updater'
              : 'Store Adder',
        }),
    )
  } catch {
    return { error: 'Email already in use' }
  }

  revalidatePath('/admin/users')
  redirect('/admin/users')
}

export async function changePassword(id: number, formData: FormData) {
  const actor = await requireAdmin()

  const password = formData.get('password') as string
  if (!password || password.length < 8)
    return { error: 'Password must be at least 8 characters' }

  const passwordHash = await bcrypt.hash(password, 12)
  await authorized(actor, 'admin', async (db) =>
    db
      .update(users)
      .set({ passwordHash, sessionVersion: sql`${users.sessionVersion}+1` })
      .where(eq(users.id, id)),
  )

  revalidatePath('/admin/users')
  redirect('/admin/users')
}
