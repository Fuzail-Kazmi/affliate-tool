import type { Metadata } from 'next'
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import './globals.css'
import './unity.css'

export const metadata: Metadata = {
  title: 'UnityAffliate',
  icons: { icon: '/unityalgo.png' },
  description: 'Find the best coupons, deals, and discount codes.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
