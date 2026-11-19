import Link from 'next/link'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { permissions, roles, can } from '@/lib/access'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import WorkForm from '../WorkForm'
const permissionLabel: Record<(typeof permissions)[number], string> = {
  'stores.read': 'View assigned stores',
  'stores.add': 'Create stores',
  'stores.update': 'Edit store details',
  'stores.delete': 'Delete assigned stores',
  'links.add': 'Add a merchant URL',
  'links.update': 'Replace a merchant URL',
  'links.delete': 'Remove a merchant URL',
  'offers.write': 'Discover and publish offers',
  'work.write': 'Track and complete work',
  'sheets.read': 'View assigned sheets',
  'assign.write': 'Assign stores and sheets',
  'team.read': 'View team assignments',
  'reports.read': 'View daily performance',
  'audit.read': 'View the activity log',
}
export default async function Team() {
  const actor = await getSession()
  if (!actor) redirect('/admin')
  const team = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      active: users.active,
      grants: users.grants,
    })
    .from(users)
    .orderBy(users.email)
  return (
    <section className="workspace">
      <header>
        <h1>Team & access</h1>
        <p>
          Assign roles and customize the permissions available to each employee.
        </p>
      </header>
      <div>
        <Link className="ua-primary" href="/admin/users/new">
          Add employee
        </Link>
      </div>
      {team.map((u) => (
        <section className="work-card" key={u.id}>
          <h2>{u.email}</h2>
          <p>
            {u.role} · {u.active ? 'Active' : 'Disabled'}
          </p>
          <Link href={'/admin/users/' + u.id + '/change-password'}>
            Change password
          </Link>
          {actor.userId !== u.id && (
            <details>
              <summary>Manage access</summary>
              <WorkForm op="access" id={u.id} label="Save access">
                <label>
                  Role
                  <select name="role" defaultValue={u.role}>
                    {roles.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={u.active}
                  />{' '}
                  Account enabled
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="custom"
                    defaultChecked={!!u.grants}
                  />{' '}
                  Use individual permissions
                </label>
                <fieldset>
                  <legend>Individual permissions</legend>
                  {permissions.map((p) => (
                    <label key={p}>
                      <input
                        name="grant"
                        value={p}
                        type="checkbox"
                        defaultChecked={can({ ...actor, ...u }, p)}
                      />{' '}
                      {permissionLabel[p]}
                    </label>
                  ))}
                </fieldset>
              </WorkForm>
            </details>
          )}
        </section>
      ))}
    </section>
  )
}
