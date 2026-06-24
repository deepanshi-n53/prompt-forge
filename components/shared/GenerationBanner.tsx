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
  const [active, setActive]             = useState<ActiveProject[]>([])
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    async function check() {
      try {
        const res = await fetch('/api/projects?status=PROCESSING', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { projects?: ActiveProject[] }
        // Empty result → clear immediately so a just-deleted/finished project's
        // name never lingers until the next interval.
        if (!cancelled) setActive(data.projects ?? [])
      } catch {
        /* network hiccup — keep last known state */
      }
    }

    // Re-poll the instant a project is deleted elsewhere (e.g. the dashboard),
    // rather than waiting up to POLL_MS for the banner to notice it's gone.
    function onProjectDeleted() {
      check()
    }

    check()
    timer = setInterval(check, POLL_MS)
    window.addEventListener('project-deleted', onProjectDeleted)
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      window.removeEventListener('project-deleted', onProjectDeleted)
    }
  }, [])

  if (active.length === 0) return null

  // Most recently started generation first (API already orders by updatedAt desc).
  const running = [...active].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )

  // Dismissal is keyed to the exact set of running generations, so the banner
  // re-appears whenever a new run starts or one finishes — not just when the
  // single "top" project changes.
  const key = running.map((p) => p.id).join(',')
  if (dismissedKey === key) return null

  const label = running.length === 1 ? 'Generating prompts for' : `Generating ${running.length} projects:`

  return (
    <div className="sticky top-0 z-30 flex h-9 items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 text-xs font-medium text-amber-800">
      {/* pulsing dot */}
      <span className="inline-flex h-2 w-2 shrink-0 animate-pulse-dot rounded-full bg-amber-500" />

      <span className="flex min-w-0 items-center gap-1.5 truncate">
        <span className="shrink-0">⚡ {label}</span>
        {running.map((p, i) => (
          <span key={p.id} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <span aria-hidden className="shrink-0 text-amber-400">·</span>}
            <Link
              href={`/project/${p.id}/generating?jobId=${p.id}`}
              className="truncate font-semibold underline underline-offset-2 hover:text-amber-900"
            >
              {p.name}
            </Link>
          </span>
        ))}
      </span>

      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissedKey(key)}
        className="absolute right-3 text-amber-500 hover:text-amber-800"
      >
        ✕
      </button>
    </div>
  )
}
