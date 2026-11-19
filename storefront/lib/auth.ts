import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from './db'
import type { Actor } from './access'
import { users } from './db/schema'

const SESSION_COOKIE = 'session'
function secretKey() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error(
      'Set JWT_SECRET to a random secret of at least 32 characters.',
    )
  return new TextEncoder().encode(process.env.JWT_SECRET)
}

export async function createSession(userId: number, expectedVersion = 0) {
  const [account] = await db
    .select({ version: users.sessionVersion, active: users.active })
    .from(users)
    .where(eq(users.id, userId))
  if (!account?.active || account.version !== expectedVersion)
    throw Error('Account unavailable')
  const token = await new SignJWT({ userId, version: account.version })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secretKey())

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
}

export async function getActor(): Promise<Actor | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ['HS256'],
      requiredClaims: ['exp'],
    })
    if (
      typeof payload.userId !== 'number' ||
      !Number.isSafeInteger(payload.userId)
    )
      return null
    const [user] = await db
      .select({
        userId: users.id,
        role: users.role,
        email: users.email,
        grants: users.grants,
        version: users.sessionVersion,
        active: users.active,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1)
    return user?.active && user.version === (payload.version ?? 0) ? user : null
  } catch {
    return null
  }
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getSession() {
  const actor = await getActor()
  return actor?.role === 'Admin' ? actor : null
}
