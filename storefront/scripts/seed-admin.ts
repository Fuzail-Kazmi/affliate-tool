import bcrypt from 'bcryptjs'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { users } from '../lib/db/schema'

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password || password.length < 10) throw Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 10 characters).')

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
  const db = drizzle(pool)

  const passwordHash = await bcrypt.hash(password, 12)

  await db.insert(users).values({ email, passwordHash })

  console.log(`Admin user created: ${email}`)
  await pool.end()
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
