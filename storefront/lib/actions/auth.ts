'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { events, tasks, users } from '@/lib/db/schema'
import { createSession, deleteSession, getActor } from '@/lib/auth'

export async function login(
  _prevState: { error?: string } | undefined,
  formData: FormData,
) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1)

  if (!user || !user.active) {
    return { error: 'Invalid credentials' }
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return { error: 'Invalid credentials' }
  }

  await db
    .insert(events)
    .values({ actor: user.email, role: user.role, action: 'Signed in' })
  await createSession(user.id, user.sessionVersion)
  redirect('/admin')
}

export async function logout() {
  const actor = await getActor()
  if (actor)
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('unity.actor',${actor.email},true),set_config('unity.role',${actor.role},true)`,
      )
      await tx
        .update(users)
        .set({ sessionVersion: sql`session_version+1` })
        .where(eq(users.id, actor.userId))
      await tx
        .update(tasks)
        .set({ started: null })
        .where(
          sql`employee_id=${actor.userId} and started is not null and completed is null`,
        )
      await tx
        .insert(events)
        .values({ actor: actor.email, role: actor.role, action: 'Signed out' })
    })
  await deleteSession()
  redirect('/login')
}
