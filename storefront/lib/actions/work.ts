'use server'
import { revalidatePath } from 'next/cache'
import { eq, sql } from 'drizzle-orm'
import { getActor } from '@/lib/auth'
import { authorized, storeScope } from '@/lib/authorized'
import { can, permissions, roles } from '@/lib/access'
import { stores, tasks, users } from '@/lib/db/schema'
export async function changeWork(
  data: FormData,
): Promise<{ message: string; ok: boolean }> {
  const actor = await getActor()
  if (!actor) return { ok: false, message: 'Sign in again.' }
  const op = String(data.get('op')),
    id = Number(data.get('id')),
    employee = Number(data.get('employee'))
  const value = (key: string) => String(data.get(key) || '').trim()
  function url(key: string) {
    const raw = value(key)
    if (!raw) return null
    const u = new URL(raw)
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password)
      throw Error('Enter a public website URL.')
    return u.href
  }
  try {
    if (op === 'access')
      await authorized(actor, 'admin', async (tx) => {
        const role = value('role'),
          grants = data.has('custom') ? data.getAll('grant').map(String) : null
        if (
          id === actor.userId ||
          !roles.some((r) => r === role) ||
          grants?.some((p) => !permissions.some((k) => k === p))
        )
          throw Error('Invalid access change.')
        await tx
          .update(tasks)
          .set({ started: null })
          .where(
            sql`employee_id=${id} and started is not null and completed is null`,
          )
        await tx
          .update(users)
          .set({
            role,
            grants,
            active: data.has('active'),
            sessionVersion: sql`session_version+1`,
          })
          .where(eq(users.id, id))
      })
    else if (op === 'assign')
      await authorized(actor, 'assign.write', async (tx) => {
        const [store] = await tx
          .select()
          .from(stores)
          .where(eq(stores.id, id))
          .for('update')
        const [user] = await tx
          .select()
          .from(users)
          .where(eq(users.id, employee))
        if (!store || !user?.active)
          throw Error('Select an active employee and store.')
        const prior = await tx.execute(
          sql`select id from tasks where store_id=${id} and (completed is null or employee_id=${employee}) or (employee_id=${employee} and completed is not null and completed_website=rtrim(${store.website}::text,'/'))`,
        )
        if (prior.rows.length)
          throw Error(
            'This store already has an open task or this employee completed it previously.',
          )
        await tx
          .insert(tasks)
          .values({
            storeId: id,
            employeeId: employee,
            storeName: store.name,
            sheet: url('sheet'),
            kind: value('kind') === 'Update' ? 'Update' : 'Add',
          })
      })
    else if (op === 'start' || op === 'pause' || op === 'complete')
      await authorized(actor, 'work.write', async (tx) => {
        const where = sql`id=${id} and employee_id=${actor.userId} and completed is null`
        const result =
          op === 'start'
            ? await tx
                .update(tasks)
                .set({ started: sql`now()` })
                .where(sql`${where} and started is null`)
                .returning()
            : await tx
                .update(tasks)
                .set(
                  op === 'pause'
                    ? { started: null }
                    : { completed: sql`now()` },
                )
                .where(sql`${where} and started is not null`)
                .returning()
        if (!result.length)
          throw Error('This task is unavailable. Refresh your workspace.')
      })
    else if (['edit', 'add', 'delete'].includes(op))
      await authorized(
        actor,
        op === 'add'
          ? 'stores.add'
          : op === 'delete'
            ? 'stores.delete'
            : 'stores.read',
        async (tx, a) => {
          const name = value('name'),
            website = url('website')
          if (op !== 'delete' && (!name || name.length > 150))
            throw Error('Enter a store name of up to 150 characters.')
          if (op === 'add') {
            if (website && !can(a, 'links.add'))
              throw Error('Website permission required.')
            const [s] = await tx
              .insert(stores)
              .values({
                name,
                website,
                slug:
                  name.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
                  '-' +
                  crypto.randomUUID().slice(0, 8),
              })
              .returning()
            await tx
              .insert(tasks)
              .values({
                storeId: s.id,
                storeName: name,
                employeeId: a.userId,
                kind: 'Add',
              })
            return
          }
          if (!(await storeScope(tx, a, id)))
            throw Error('Assigned stores only.')
          const [s] = await tx
            .select()
            .from(stores)
            .where(eq(stores.id, id))
            .for('update')
          if (!s) throw Error('Store unavailable.')
          if (op === 'delete') {
            if (s.website && !can(a, 'links.delete'))
              throw Error('Removing this website requires permission.')
            await tx.delete(stores).where(eq(stores.id, id))
            return
          }
          if (name !== s.name && !can(a, 'stores.update'))
            throw Error('Store update permission required.')
          if (
            website !== s.website &&
            !can(
              a,
              !website
                ? 'links.delete'
                : s.website
                  ? 'links.update'
                  : 'links.add',
            )
          )
            throw Error('Website permission required.')
          await tx
            .update(stores)
            .set({ name, website })
            .where(eq(stores.id, id))
        },
      )
    else throw Error('Unknown action.')
    revalidatePath('/admin', 'layout')
    return { ok: true, message: 'Changes saved.' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    return {
      ok: false,
      message: /query|duplicate key/i.test(msg)
        ? 'This change conflicts with an existing record or active timer.'
        : msg || 'Could not save changes.',
    }
  }
}
