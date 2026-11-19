'use client'
import CopyOffer from './CopyOffer'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from '@/app/_components/Icon'
import { discover, publishOffers } from '@/lib/actions/affiliate'
import type { Scan, StoreOption } from '@/lib/affiliate/types'

export default function DiscoveryPanel({
  stores,
  initial,
  initialScan,
  admin,
  editWebsite,
}: {
  admin: boolean
  editWebsite: boolean
  stores: StoreOption[]
  initial?: StoreOption
  initialScan: Scan | null
}) {
  const router = useRouter()
  const [url, setUrl] = useState(initial?.website || initialScan?.url || '')
  const [scan, setScan] = useState(initialScan)
  const [selected, setSelected] = useState<number[]>([])
  const [pending, setPending] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const offers = scan?.result.offers || []
  const saved = scan?.saved || []
  async function analyze(e: React.FormEvent) {
    e.preventDefault()
    if (!initial || pending) return
    setPending('scan')
    setMessage('')
    setError('')
    try {
      const reply = await discover(initial.id, url)
      if (!reply.ok) {
        setError(reply.error)
        return
      }
      setScan(reply.value)
      setSelected([])
      setMessage(
        reply.value.result.offers.length
          ? 'Analysis complete. Review the offers below.'
          : 'No public promotions were found at this website.',
      )
    } catch {
      setError('Analysis could not finish. Check your connection and retry.')
    } finally {
      setPending('')
    }
  }
  async function publish() {
    if (!scan || !selected.length || pending) return
    setPending('save')
    setError('')
    setMessage('')
    try {
      const reply = await publishOffers(scan.id, selected)
      if (!reply.ok) {
        setError(reply.error)
        return
      }
      setScan({ ...scan, saved: reply.value.saved })
      setSelected([])
      setMessage(
        `${reply.value.inserted} new offers published. Existing offers were skipped.`,
      )
    } catch {
      setError('Saving was interrupted. You can retry the same selection.')
    } finally {
      setPending('')
    }
  }
  return (
    <section className="ua-tool">
      <header className="ua-hero">
        <div className="ua-hero-copy">
          <span className="ua-overline">
            <Icon name="scan" size={16} /> Affliate Tool
          </span>
          <h1>Offer discovery</h1>
          <p>
            Find merchant deals, check coupon codes, and publish reviewed offers
            to your store.
          </p>
        </div>
        <div aria-hidden="true" className="ua-hero-art" />
      </header>
      <section className="ua-card">
        <div className="ua-cardhead">
          <span className="ua-tile">
            <Icon name="globe" />
          </span>
          <div>
            <h2>Analyze a store</h2>
            <p>Choose a catalog store and its official merchant website.</p>
          </div>
        </div>
        {initial ? (
          <form onSubmit={analyze} className="ua-formline">
            <label>
              Catalog store
              <select
                value={initial.id}
                disabled={!!pending}
                onChange={(e) =>
                  router.push('/admin/affliate-tool?store=' + e.target.value)
                }
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Merchant website
              <input
                required
                type="url"
                maxLength={2048}
                readOnly={!editWebsite}
                value={url}
                placeholder="https://merchant.com"
                onChange={(e) => setUrl(e.target.value)}
                disabled={!!pending}
              />
            </label>
            <button className="ua-primary" disabled={!!pending}>
              <Icon name="scan" />
              {pending === 'scan' ? 'Analyzing…' : 'Analyze website'}
            </button>
          </form>
        ) : (
          <div className="ua-empty">
            <Icon name="store" />
            <h3>{admin ? 'Add your first store' : 'No stores assigned'}</h3>
            <p>
              {admin
                ? 'Offers are published to a store in your catalog.'
                : 'Your assigned stores will appear here.'}
            </p>
            {admin && (
              <Link className="ua-primary" href="/admin/stores/new">
                Add store
              </Link>
            )}
          </div>
        )}
      </section>
      {error && (
        <p className="ua-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="ua-notice" role="status">
          {message}
        </p>
      )}
      {pending === 'scan' && (
        <p role="status" className="ua-notice">
          Reading merchant promotions and checking supported guest carts…
        </p>
      )}
      <section className="ua-card">
        <div className="ua-cardhead split">
          <div>
            <h2>
              Offer review{' '}
              {scan && <span className="ua-count">{offers.length}</span>}
            </h2>
            <p>
              {scan
                ? scan.result.engine + ' · ' + new URL(scan.url).hostname
                : 'Discovered offers and their supporting evidence appear here.'}
            </p>
          </div>
          {scan && !!offers.length && (
            <button
              className="ua-primary"
              disabled={!!pending || !selected.length}
              onClick={publish}
            >
              {pending === 'save'
                ? 'Publishing…'
                : `Publish selected (${selected.length})`}
            </button>
          )}
        </div>
        {scan?.result.warnings.map((w) => (
          <p className="ua-warn" key={w}>
            {w}
          </p>
        ))}
        {offers.length > 0 ? (
          <div className="ua-offers">
            <label className="ua-all">
              <input
                type="checkbox"
                disabled={!!pending || saved.length === offers.length}
                checked={
                  selected.length > 0 &&
                  selected.length === offers.length - saved.length
                }
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? offers
                          .map((_, i) => i)
                          .filter((i) => !saved.includes(i))
                      : [],
                  )
                }
              />
              Select all unpublished offers
            </label>
            {offers.map((o, i) => (
              <article key={i} className="ua-offer">
                <input
                  type="checkbox"
                  aria-label={'Select ' + o.title}
                  checked={selected.includes(i) || saved.includes(i)}
                  disabled={!!pending || saved.includes(i)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, i]
                        : selected.filter((n) => n !== i),
                    )
                  }
                />
                <div>
                  <div className="ua-tags">
                    <span>{o.code ? 'Coupon code' : 'Deal'}</span>
                    {o.code && <code>{o.code}</code>}
                    <span>{o.verification}</span>
                    {saved.includes(i) && <strong>In catalog</strong>}
                  </div>
                  <h3>{o.title}</h3>
                  <CopyOffer
                    text={[o.title, o.code && 'Code: ' + o.code]
                      .filter(Boolean)
                      .join('\n')}
                  />
                  <details>
                    <summary>Evidence &amp; coupon tests</summary>
                    <p>{o.evidence}</p>
                    {o.image && (
                      <p>
                        <a href={o.image} target="_blank" rel="noreferrer">
                          Original merchant banner
                        </a>
                      </p>
                    )}
                    <a href={o.source} target="_blank" rel="noreferrer">
                      Merchant source
                    </a>
                    {o.trials.length > 0 && (
                      <ul>
                        {o.trials.map((t, j) => (
                          <li key={j}>
                            {t.product} · {t.price} · {t.result}
                            {t.savingsMinor
                              ? ` · saved ${t.savingsMinor} minor units (${t.currency})`
                              : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="ua-empty">
            <Icon name="ticket" size={32} />
            <h3>{scan ? 'No offers found' : 'No analysis yet'}</h3>
            <p>
              {scan
                ? 'Try a merchant promotion page or add an offer through Coupons.'
                : 'Analyze a merchant website to start reviewing its offers.'}
            </p>
          </div>
        )}
        {initial && saved.length > 0 && (
          <div className="ua-foot">
            <Link href={'/' + initial.slug + '/view/vouchers'}>
              View published store offers
            </Link>
          </div>
        )}
      </section>
    </section>
  )
}
