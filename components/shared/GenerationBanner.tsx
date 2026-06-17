'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ActiveProject {
  id:        string
  name:      string
  status:    string
  updatedAt: string
}

const POLL_MS = 10_000

// Lightweight sticky banner shown across the app whenever the current user has
// any project still generating (status === PROCESSING). Polls /api/projects every
// 10s and auto-dismisses when nothing is in flight. No external deps.
export function GenerationBanner() {
  const [active, setActive]       = useState<ActiveProject[]>([])
  const [dismissedId, setDismissedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    async function check() {
      try {
        const res = await fetch('/api/projects?status=PROCESSING', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { projects?: ActiveProject[] }
        if (!cancelled) setActive(data.projects ?? [])
      } catch {
        /* network hiccup — keep last known state */
      }
    }

    check()
    timer = setInterval(check, POLL_MS)
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [])

  if (active.length === 0) return null

  // Most recently started generation first (API already orders by updatedAt desc).
  const first = [...active].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0]
  const more = active.length - 1

  // Dismissed — stays hidden until a *different* generation becomes the active one.
  if (dismissedId === first.id) return null

  return (
    <div className="sticky top-0 z-30 flex h-9 items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 text-xs font-medium text-amber-800">
      {/* pulsing dot */}
      <span className="inline-flex h-2 w-2 animate-pulse-dot rounded-full bg-amber-500" />
      <span className="truncate">
        ⚡ Generating prompts for <strong>{first.name}</strong>
        {more > 0 && ` and ${more} other project${more !== 1 ? 's' : ''}`}
      </span>
      <Link
        href={`/project/${first.id}/generating?jobId=${first.id}`}
        className="ml-1 shrink-0 underline underline-offset-2 hover:text-amber-900"
      >
        View progress →
      </Link>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissedId(first.id)}
        className="absolute right-3 text-amber-500 hover:text-amber-800"
      >
        ✕
      </button>
    </div>
  )
}
