import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getActor } from '@/lib/auth'
import { can } from '@/lib/access'
import { pool } from '@/lib/db'
import WorkForm from './WorkForm'
export default async function Workspace({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; before?: string }>
}) {
  const a = await getActor()
  if (!a) redirect('/login')
  const admin = a.role === 'Admin',
    assign = can(a, 'assign.write'),
    team = can(a, 'team.read'),
    today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })
  const params = await searchParams,
    day =
      params.day &&
      Number.isFinite(Date.parse(params.day + 'T00:00:00Z')) &&
      new Date(params.day + 'T00:00:00Z').toISOString().slice(0, 10) ===
        params.day &&
      Number(params.day.slice(0, 4)) > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(params.day || '')
        ? params.day!
        : today
  const jobs = (
    await pool.query(
      'select t.*,s.name,s.website,u.email from tasks t left join stores s on s.id=t.store_id left join users u on u.id=t.employee_id where ($1 or employee_id=$2) order by completed nulls first,t.id desc',
      [team, a.userId],
    )
  ).rows
  const employees = assign
    ? (
        await pool.query(
          'select id,email from users where active order by email',
        )
      ).rows
    : []
  const catalog = assign
    ? (await pool.query('select id,name from stores order by name')).rows
    : []
  const events = can(a, 'audit.read')
    ? (
        await pool.query(
          'select * from activity_log where id<$1 order by id desc limit 50',
          [
            Number.isSafeInteger(Number(params.before)) &&
            Number(params.before) > 0 &&
            Number(params.before) <= 2147483647
              ? Number(params.before)
              : 2147483647,
          ],
        )
      ).rows
    : []
  const daily = can(a, 'reports.read')
    ? (
        await pool.query(
          `with bounds as (select $1::date::timestamp at time zone 'Asia/Karachi' as lo, ($1::date+1)::timestamp at time zone 'Asia/Karachi' as hi)
  , spans as (select employee_id,store_name,kind,started,completed,completed as ended from tasks where started is not null union all select (previous->>'employee_id')::int,previous->>'store_name',previous->>'kind',(previous->>'started')::timestamptz,null,at from activity_log where action='tasks update' and previous->>'started' is not null and previous->>'completed' is null and updated->>'started' is null) select u.email,t.store_name,t.kind, (t.completed>=lo and t.completed<hi) as done,
 floor(extract(epoch from greatest(interval '0',least(coalesce(t.ended,now()),hi)-greatest(t.started,lo))))::int as seconds
 from spans t join users u on u.id=t.employee_id cross join bounds where t.started<hi and coalesce(t.ended,now())>=lo order by u.email,t.store_name,t.started`,
          [day],
        )
      ).rows
    : []
  const totals = new Map<
    string,
    { adds: number; updates: number; seconds: number }
  >()
  for (const r of daily) {
    const v = totals.get(r.email) || { adds: 0, updates: 0, seconds: 0 }
    v.seconds += r.seconds
    if (r.done) {
      if (r.kind === 'Add') v.adds++
      else v.updates++
    }
    totals.set(r.email, v)
  }
  return (
    <section className="workspace">
      <header>
        <p className="muted">{a.role}</p>
        <h1>Operations workspace</h1>
        <p>Manage store assignments, review offers and track completed work.</p>
      </header>
      <div className="metrics">
        {[
          ['Open assignments', jobs.filter((j) => !j.completed).length],
          ['In progress', jobs.filter((j) => j.started && !j.completed).length],
          ['Completed', jobs.filter((j) => j.completed).length],
        ].map(([k, v]) => (
          <div key={k}>
            <small>{k}</small>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      {assign && (
        <section className="work-card">
          <h2>Assign store work</h2>
          {catalog.length && employees.length ? (
            <WorkForm op="assign" label="Assign task">
              <label>
                Store
                <select name="id">
                  {catalog.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Employee
                <select name="employee">
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.email}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Task
                <select name="kind">
                  <option>Add</option>
                  <option>Update</option>
                </select>
              </label>
              <label>
                Sheet URL (optional)
                <input type="url" name="sheet" />
              </label>
            </WorkForm>
          ) : (
            <Link href="/admin/stores/new">Add your first store</Link>
          )}
        </section>
      )}
      <section className="work-card">
        <h2>{team ? 'Team assignments' : 'My assignments'}</h2>
        {!jobs.length && <p>No assignments yet.</p>}
        {jobs.map((j) => (
          <article className="job" key={j.id}>
            <div>
              <strong>{j.name || j.store_name}</strong>
              <small>
                {j.email} · {j.kind} ·{' '}
                {j.completed ? 'Done' : j.started ? 'In progress' : 'Pending'}
              </small>
            </div>
            {j.sheet &&
              (assign ||
                (j.employee_id === a.userId && can(a, 'sheets.read'))) && (
                <a href={j.sheet} target="_blank" rel="noreferrer">
                  Work sheet
                </a>
              )}
            {j.employee_id === a.userId && !j.completed && (
              <>
                {can(a, 'work.write') && (
                  <WorkForm
                    id={j.id}
                    op={j.started ? 'complete' : 'start'}
                    label={j.started ? 'Save as done' : 'Start task'}
                  />
                )}
                {j.started && can(a, 'work.write') && (
                  <WorkForm id={j.id} op="pause" label="Pause timer" />
                )}
                {can(a, 'offers.write') && can(a, 'stores.read') && (
                  <Link href={'/admin/affliate-tool?store=' + j.store_id}>
                    Review offers
                  </Link>
                )}
                {can(a, 'stores.read') &&
                  (can(a, 'stores.update') ||
                    can(a, 'links.update') ||
                    can(a, 'links.add') ||
                    can(a, 'links.delete')) && (
                    <details>
                      <summary>Edit store</summary>
                      <WorkForm op="edit" id={j.store_id} label="Save">
                        <label>
                          Name
                          <input
                            name="name"
                            defaultValue={j.name}
                            readOnly={!can(a, 'stores.update')}
                          />
                        </label>
                        <label>
                          Website
                          <input
                            type="url"
                            name="website"
                            defaultValue={j.website || ''}
                          />
                        </label>
                      </WorkForm>
                    </details>
                  )}
                {can(a, 'stores.delete') && (
                  <details>
                    <summary>Remove store</summary>
                    <WorkForm
                      op="delete"
                      id={j.store_id}
                      label="Confirm removal"
                    />
                  </details>
                )}
              </>
            )}
          </article>
        ))}
      </section>
      {!admin && can(a, 'stores.add') && (
        <section className="work-card">
          <h2>Add store</h2>
          <WorkForm op="add" label="Create store">
            <label>
              Name
              <input name="name" required />
            </label>
            {can(a, 'links.add') && (
              <label>
                Website
                <input type="url" name="website" />
              </label>
            )}
          </WorkForm>
        </section>
      )}
      {can(a, 'reports.read') && (
        <section className="work-card">
          <h2>Daily performance</h2>
          <form className="work-form">
            <label>
              Reporting date
              <input type="date" name="day" defaultValue={day} />
            </label>
            <button>View report</button>
          </form>
          {!daily.length && <p>No tracked work for this date.</p>}
          {[...totals].map(([email, v]) => (
            <p key={email}>
              <strong>{email}</strong> · {v.adds} added · {v.updates} updated ·{' '}
              {Math.floor(v.seconds / 60)}m {v.seconds % 60}s
            </p>
          ))}
          {daily.map((v, i) => (
            <small key={i}>
              {v.store_name} · {v.email} · {Math.floor(v.seconds / 60)}m{' '}
              {v.seconds % 60}s
            </small>
          ))}
        </section>
      )}
      {can(a, 'audit.read') && (
        <section className="work-card">
          <h2>Activity log</h2>
          {events.map((e) => (
            <details key={e.id}>
              <summary>
                {e.action} · {e.actor} · {e.role} ·{' '}
                {e.at.toISOString().slice(0, 19)} UTC
              </summary>
              <pre>
                {JSON.stringify(
                  { before: e.previous, after: e.updated },
                  null,
                  2,
                )}
              </pre>
            </details>
          ))}
          {events.length === 50 && (
            <Link href={'?before=' + events.at(-1).id}>Older activity</Link>
          )}
        </section>
      )}
    </section>
  )
}
