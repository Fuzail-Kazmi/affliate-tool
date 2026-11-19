'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { saveStoreOrder } from '@/lib/actions/store-order'

export default function OfferOrderEditor({
  storeId,
  path,
  offers,
}: {
  storeId: number
  path: string
  offers: { id: number; title: string }[]
}) {
  const router = useRouter()
  const [draft, setDraft] = useState(offers)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function move(index: number, delta: number) {
    const next = [...draft]
    ;[next[index], next[index + delta]] = [next[index + delta], next[index]]
    setDraft(next)
  }
  async function save() {
    setBusy(true)
    try {
      const result = await saveStoreOrder(
        storeId,
        offers.map((o) => o.id),
        draft.map((o) => o.id),
      )
      if (result.error) {
        setError(result.error)
        return
      }
      router.replace(path)
      router.refresh()
    } catch {
      setError('Could not save. Refresh the page and check your access.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="work-card">
      <h2 className="font-semibold">Edit offer order</h2>
      <p className="text-sm text-muted">
        The first offer appears at the top of this store.
      </p>
      <ol className="my-4 divide-y divide-border">
        {draft.map((o, i) => (
          <li key={o.id} className="flex items-center gap-2 py-2">
            <span className="text-sm text-muted">{i + 1}.</span>
            <span className="flex-1 min-w-0 break-words">{o.title}</span>
            {([-1, 1] as const).map((d) => (
              <button
                key={d}
                type="button"
                className="p-2 rounded border border-border hover:bg-gray-100 disabled:opacity-30"
                disabled={busy || i + d < 0 || i + d >= draft.length}
                aria-label={'Move ' + o.title + (d < 0 ? ' up' : ' down')}
                onClick={() => move(i, d)}
              >
                {d < 0 ? '↑' : '↓'}
              </button>
            ))}
          </li>
        ))}
      </ol>
      {draft.length < 2 && (
        <p className="text-muted text-sm mb-3">
          Sorting is available when this store has at least two offers.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="flex items-center gap-4">
        <button
          className="ua-primary disabled:opacity-50"
          disabled={busy || draft.every((o, i) => o.id === offers[i]?.id)}
          onClick={save}
        >
          {busy ? 'Saving…' : 'Save order'}
        </button>
        <Link href={path}>Cancel</Link>
      </div>
    </section>
  )
}
