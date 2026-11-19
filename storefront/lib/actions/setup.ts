'use server'
import bcrypt from 'bcryptjs'
import { sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { stores, users } from '@/lib/db/schema'

export async function setupAvailable() {
  const host = (await headers()).get('host') || ''
  if (
    process.env.UNITY_LOCAL_SETUP !== '1' ||
    !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
  )
    return false
  return !(await db.select({ id: users.id }).from(users).limit(1)).length
}
export async function createOwner(
  _prev: { error?: string } | undefined,
  data: FormData,
) {
  if (!(await setupAvailable())) return { error: 'Workspace setup is closed.' }
  const email = String(data.get('email') || '')
    .trim()
    .toLowerCase()
  const password = String(data.get('password') || '')
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    password.length < 10 ||
    Buffer.byteLength(password) > 72
  )
    return { error: 'Enter a valid email and a password of 10–72 bytes.' }
  const passwordHash = await bcrypt.hash(password, 12)
  const user = await db.transaction(async (tx) => {
    await tx.execute(sql`lock table users in exclusive mode`)
    if ((await tx.select({ id: users.id }).from(users).limit(1)).length)
      return null
    const [owner] = await tx
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id })
    if (data.get('starter'))
      await tx
        .insert(stores)
        .values({
          name: 'Allbirds',
          slug: 'allbirds',
          website: 'https://www.allbirds.com/',
        })
        .onConflictDoNothing()
    return owner
  })
  if (!user) return { error: 'Workspace setup is closed.' }
  await createSession(user.id)
  redirect('/admin/affliate-tool')
}
