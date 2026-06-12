'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

interface AppShellProps {
  sidebar:  React.ReactNode
  children: React.ReactNode
}

export function AppShell({ sidebar, children }: AppShellProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close sidebar whenever the route changes (link was tapped on mobile)
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Mobile backdrop ────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────────────────────── */}
      <div
        className={[
          // Mobile: fixed overlay that slides in from left
          'fixed inset-y-0 left-0 z-30 transition-transform duration-300',
          // Desktop: always visible as part of normal flow
          'md:relative md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        {/* Mobile close button — overlaid on top corner of sidebar */}
        {open && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 md:hidden"
          >
            <X className="size-4" />
          </button>
        )}
        {sidebar}
      </div>

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={open}
            aria-controls="app-sidebar"
            onClick={() => setOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 transition-colors"
          >
            <Menu className="size-5" />
          </button>
          <span className="font-semibold text-zinc-900">PromptForge</span>
        </header>

        <main id="main-content" className="flex-1 overflow-y-auto bg-zinc-50">
          {children}
        </main>
      </div>
    </div>
  )
}
