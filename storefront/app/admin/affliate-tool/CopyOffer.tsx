'use client'
import { useState } from 'react'
export default function CopyOffer({ text }: { text: string }) {
  const [status, setStatus] = useState('')
  return (
    <span>
      <button
        type="button"
        className="copy-offer"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
            setStatus('Copied')
          } catch {
            setStatus('Select and copy the text below.')
          }
        }}
      >
        Copy offer
      </button>
      <small role="status">{status}</small>
      {status.startsWith('Select') && (
        <textarea
          aria-label="Offer text"
          readOnly
          value={text}
          onFocus={(e) => e.target.select()}
        />
      )}
    </span>
  )
}
