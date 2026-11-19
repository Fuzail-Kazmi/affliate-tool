import { redirect } from 'next/navigation'
import { getActor } from '@/lib/auth'
import Brand from '@/app/_components/Brand'
import { setupAvailable } from '@/lib/actions/setup'
import LoginForm from './LoginForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Login | UnityAffliate',
  robots: { index: false, follow: false },
}

export default async function LoginPage() {
  const session = await getActor()
  if (session) redirect('/admin')

  const setup = await setupAvailable()
  return (
    <main className="ua-login">
      <section className="ua-logincard">
        <Brand />
        <h1>{setup ? 'Create your admin account' : 'Workspace sign in'}</h1>
        <p>
          {setup
            ? 'Set up the first administrator for your UnityAffliate store portal.'
            : 'Sign in to manage stores and publish offers.'}
        </p>
        <LoginForm setup={setup} />
      </section>
      <aside className="ua-login-art">
        <div className="ua-hero-art" />
        <div>
          <small>UnityAffliate</small>
          <h2>
            Store offers,
            <br />
            from discovery
            <br />
            to publication.
          </h2>
          <p>Powered by UnityAlgo</p>
        </div>
      </aside>
    </main>
  )
}
