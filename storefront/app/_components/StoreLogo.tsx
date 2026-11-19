'use client'

import Image from 'next/image'
import { useState } from 'react'

export default function StoreLogo({
  name,
  imageUrl,
  website,
}: {
  name: string
  imageUrl: string | null
  website: string | null
}) {
  const [failed, setFailed] = useState<string[]>([])
  let favicon = ''
  try {
    const url = new URL(website || '')
    if (['https:', 'http:'].includes(url.protocol))
      favicon = new URL('/favicon.ico', url).href
  } catch {
    /* Stores may have no merchant website yet. */
  }
  const source = [imageUrl, favicon].find((url) => url && !failed.includes(url))
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-white p-2 text-lg font-semibold text-brand">
      {source ? (
        <Image
          width={48}
          height={48}
          unoptimized
          src={source}
          alt={name + ' logo'}
          className="h-full w-full object-contain"
          onError={() => setFailed((previous) => [...previous, source])}
        />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </span>
  )
}
