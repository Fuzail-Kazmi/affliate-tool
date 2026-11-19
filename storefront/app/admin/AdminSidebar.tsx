'use client'

import { useState } from 'react'
import Brand from '@/app/_components/Brand'
import Icon from '@/app/_components/Icon'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/lib/actions/auth'

const navItems = [
  { href: '/admin', label: 'Workspace', icon: 'dashboard' },
  { href: '/admin/affliate-tool', label: 'Affliate Tool', icon: 'scan' },
  { href: '/admin/stores', label: 'Stores', icon: 'store' },
  { href: '/admin/coupons', label: 'Coupons', icon: 'ticket' },
  { href: '/admin/users', label: 'Team & access', icon: 'team' },
] as const

export default function AdminSidebar({
  admin,
  offers,
}: {
  admin: boolean
  offers: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const pathname = usePathname()

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <aside className={'ua-sidebar ' + (expanded ? 'expanded' : '')}>
      <div className="ua-side-head">
        <Link href="/admin" aria-label="UnityAffliate dashboard">
          <Brand />
        </Link>
        <button
          aria-label="Toggle admin navigation"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <Icon name="menu" />
        </button>
      </div>
      <nav aria-label="Admin navigation" onClick={() => setExpanded(false)}>
        {navItems
          .filter(
            (n) =>
              admin ||
              n.href === '/admin' ||
              (offers && n.href === '/admin/affliate-tool'),
          )
          .map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={
                isActive(href, href === '/admin') ? 'page' : undefined
              }
              className={
                'ua-navlink ' +
                (isActive(href, href === '/admin') ? 'current' : '')
              }
            >
              <Icon name={icon} size={17} />
              {label}
            </Link>
          ))}
      </nav>

      <div className="ua-side-foot">
        <Link
          href="/"
          target="_blank"
          className="flex items-center px-3 py-2 rounded-lg text-sm text-emerald-800 hover:bg-gray-800 hover:text-white transition-colors mb-1"
        >
          View storefront
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-emerald-800 hover:bg-gray-800 hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  )
}
