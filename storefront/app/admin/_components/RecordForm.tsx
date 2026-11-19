'use client'
import { useActionState, type ReactNode } from 'react'
type Save = (data: FormData) => Promise<{ error: string } | void>
export default function RecordForm({
  action,
  className,
  children,
}: {
  action: Save
  className: string
  children: ReactNode
}) {
  const [message, submit, pending] = useActionState(
    async (_previous: string, data: FormData) => {
      const result = await action(data)
      return result?.error || ''
    },
    '',
  )
  return (
    <form action={submit} className={className} aria-busy={pending}>
      {message && <p role="alert">{message}</p>}
      <fieldset disabled={pending} className="grid min-w-0 gap-4">
        {children}
      </fieldset>
    </form>
  )
}
