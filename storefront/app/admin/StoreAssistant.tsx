'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { askStore } from '@/lib/actions/store-assistant'
import Icon from '@/app/_components/Icon'

type Message = {
  role: 'user' | 'assistant'
  text: string
  link?: { href: string; label: string }
}
export default function StoreAssistant({
  defaultStore,
}: {
  defaultStore?: number
}) {
  const path = usePathname(),
    search = useSearchParams()
  const pageStore =
    Number(
      path.match(/\/admin\/stores\/(\d+)\/edit/)?.[1] ||
        (path === '/admin/affliate-tool'
          ? search.get('store') || defaultStore
          : 0),
    ) || undefined
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [followup, setFollowup] = useState<{ path: string; store?: number }>()
  const field = useRef<HTMLInputElement>(null),
    bottom = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null)
  const location = path + '?' + search.toString()
  useEffect(() => {
    if (open) field.current?.focus()
  }, [open])
  useEffect(() => {
    if (open) bottom.current?.scrollIntoView({ block: 'nearest' })
  }, [open, messages, busy])
  function close() {
    setOpen(false)
    trigger.current?.focus()
  }
  async function ask(q: string) {
    if (!q.trim() || busy) return
    setMessages((m) => [...m, { role: 'user', text: q.trim() }])
    setInput('')
    setBusy(true)
    try {
      const reply = await askStore(
        q.trim(),
        followup?.path === location ? followup.store || pageStore : pageStore,
      )
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: reply.text, link: reply.link },
      ])
      setFollowup({ path: location, store: reply.storeId })
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: 'I could not read the catalog. Please try again.',
        },
      ])
    } finally {
      setBusy(false)
    }
  }
  return (
    <div
      className="ua-assistant"
      onKeyDown={(e) => {
        if (e.key === 'Escape') close()
      }}
    >
      {open && (
        <section className="ua-chat" role="dialog" aria-label="Store assistant">
          <header>
            <span className="ua-chat-icon">
              <Icon name="chat" />
            </span>
            <div>
              <strong>Store assistant</strong>
              <small>UnityAffliate · Admin portal</small>
            </div>
            <button aria-label="Close assistant" onClick={close}>
              <Icon name="close" />
            </button>
          </header>
          <div className="ua-messages" role="log" aria-live="polite">
            {!messages.length && (
              <>
                <h3>How can I help with your stores?</h3>
                <p>Ask about catalog offers, coupon codes, or publishing.</p>
                {[
                  'Which stores have no offers?',
                  'Show expiring coupons',
                  'How do I verify a coupon?',
                ].map((q) => (
                  <button className="ua-suggest" key={q} onClick={() => ask(q)}>
                    {q}
                  </button>
                ))}
              </>
            )}
            {messages.map((m, i) => (
              <div key={i} className={'ua-message ' + m.role}>
                <b>{m.role === 'user' ? 'You' : 'Store assistant'}</b>
                <p>{m.text}</p>
                {m.link && (
                  <Link href={m.link.href} onClick={close}>
                    {m.link.label}
                  </Link>
                )}
              </div>
            ))}
            {busy && <p>Checking the catalog…</p>}
            <div ref={bottom} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              ask(input)
            }}
          >
            <input
              ref={field}
              value={input}
              maxLength={600}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Store question"
              placeholder="Ask about a store…"
            />
            <button disabled={busy || !input.trim()} aria-label="Send question">
              <Icon name="send" size={17} />
            </button>
          </form>
        </section>
      )}
      <button
        ref={trigger}
        className="ua-launch"
        aria-expanded={open}
        aria-label={open ? 'Hide store assistant' : 'Open store assistant'}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Icon name={open ? 'close' : 'chat'} />
        <span>Store assistant</span>
      </button>
    </div>
  )
}
