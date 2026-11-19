'use client'
import { useState } from 'react'
import { changeWork } from '@/lib/actions/work'
export default function WorkForm({
  children,
  label,
  op,
  id,
}: {
  children?: React.ReactNode
  label: string
  op: string
  id?: number
}) {
  const [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false)
  return (
    <form
      className="work-form"
      action={async (data) => {
        setBusy(true)
        try {
          const result = await changeWork(data)
          setStatus(result.message)
        } catch {
          setStatus('Connection interrupted. Refresh and try again.')
        } finally {
          setBusy(false)
        }
      }}
    >
      <input type="hidden" name="op" value={op} />
      {id !== undefined && <input type="hidden" name="id" value={id} />}
      {children}
      <button className="ua-primary" disabled={busy}>
        {busy ? 'Saving…' : label}
      </button>
      {status && <small role="status">{status}</small>}
    </form>
  )
}
