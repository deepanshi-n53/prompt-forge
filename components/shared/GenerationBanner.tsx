'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface ProjectRow {
  id:        string
  name:      string
  status:    string
  updatedAt: string
}

const POLL_MS = 10_000

const sortByRecent = (rows: ProjectRow[]) =>
  [...rows].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

// Sticky cross-app banner. Surfaces two states the user otherwise misses:
//  • PARSED  → "Action needed: answer setup questions" (the blocking step that
//              starts generation) — shown with priority, since the user MUST act.
//  • PROCESSING → "Generating prompts for …" (live progress).
// Polls /api/projects every 10s; auto-clears when nothing needs attention.
export function GenerationBanner() {
  const [running, setRunning] = useState<ProjectRow[]>([]) // PROCESSING
  const [pending, setPending] = useState<ProjectRow[]>([]) // PARSED — needs setup answers
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)

  // Browser-notification bookkeeping: which projects we've already pinged (so a
  // poll doesn't re-fire every 10s) and whether we've asked for permission once.
  const notifiedRef     = useRef<Set<string>>(new Set())
  const permRequestedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    // Fire a desktop notification for newly-pending projects — this is what pulls
    // a user who tabbed away back to the blocking setup step. Best-effort: no-ops
    // when the API is unavailable or permission is denied (the banner still shows).
    // Clicking it focuses the tab and jumps straight to that project's setup page.
    function notifyPending(rows: ProjectRow[]) {
      if (typeof window === 'undefined' || !('Notification' in window)) return

      // Re-arm projects that left the pending set, so a later re-upload pings again.
      const ids = new Set(rows.map((p) => p.id))
      for (const id of notifiedRef.current) if (!ids.has(id)) notifiedRef.current.delete(id)

      const fresh = rows.filter((p) => !notifiedRef.current.has(p.id))
      if (fresh.length === 0) return

      const fire = () => {
        if (Notification.permission !== 'granted') return
        for (const p of fresh) {
          notifiedRef.current.add(p.id)
          const n = new Notification('Setup needed to start generating', {
            body: `“${p.name}” is parsed — answer a few setup questions to generate its prompts.`,
            tag:  `setup-${p.id}`,
          })
          n.onclick = () => {
            window.focus()
            window.location.href = `/project/${p.id}/setup`
            n.close()
          }
        }
      }

      if (Notification.permission === 'granted') {
        fire()
      } else if (Notification.permission === 'default' && !permRequestedRef.current) {
        permRequestedRef.current = true
        Notification.requestPermission().then(fire).catch(() => {})
      }
    }

    async function check() {
      try {
        const [proc, parsed] = await Promise.all([
          fetch('/api/projects?status=PROCESSING', { cache: 'no-store' }),
          fetch('/api/projects?status=PARSED',     { cache: 'no-store' }),
        ])
        if (cancelled) return
        const procData   = proc.ok   ? ((await proc.json())   as { projects?: ProjectRow[] }) : {}
        const parsedData = parsed.ok ? ((await parsed.json()) as { projects?: ProjectRow[] }) : {}
        if (!cancelled) {
          const pendingRows = parsedData.projects ?? []
          setRunning(procData.projects ?? [])
          setPending(pendingRows)
          notifyPending(pendingRows)
        }
      } catch {
        /* network hiccup — keep last known state */
      }
    }

    function onProjectDeleted() { check() }

    check()
    timer = setInterval(check, POLL_MS)
    window.addEventListener('project-deleted', onProjectDeleted)
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      window.removeEventListener('project-deleted', onProjectDeleted)
    }
  }, [])

  // Action-needed (awaiting setup answers) wins — it's the step users miss.
  const action = sortByRecent(pending)
  if (action.length > 0) {
    const key = `action:${action.map((p) => p.id).join(',')}`
    if (dismissedKey !== key) {
      return (
        <Banner
          tone="indigo"
          icon="👉"
          label={action.length === 1
            ? 'Action needed — answer setup questions to start generating:'
            : `Action needed — ${action.length} projects awaiting setup:`}
          items={action}
          hrefFor={(id) => `/project/${id}/setup`}
          onDismiss={() => setDismissedKey(key)}
        />
      )
    }
  }

  const run = sortByRecent(running)
  if (run.length > 0) {
    const key = `run:${run.map((p) => p.id).join(',')}`
    if (dismissedKey !== key) {
      return (
        <Banner
          tone="amber"
          icon="⚡"
          label={run.length === 1 ? 'Generating prompts for' : `Generating ${run.length} projects:`}
          items={run}
          hrefFor={(id) => `/project/${id}/generating?jobId=${id}`}
          onDismiss={() => setDismissedKey(key)}
        />
      )
    }
  }

  return null
}

function Banner({
  tone, icon, label, items, hrefFor, onDismiss,
}: {
  tone:      'amber' | 'indigo'
  icon:      string
  label:     string
  items:     ProjectRow[]
  hrefFor:   (id: string) => string
  onDismiss: () => void
}) {
  const cls = tone === 'indigo'
    ? { bar: 'border-indigo-200 bg-indigo-50 text-indigo-800', dot: 'bg-indigo-500', sep: 'text-indigo-400', x: 'text-indigo-400 hover:text-indigo-800', link: 'hover:text-indigo-900' }
    : { bar: 'border-amber-200 bg-amber-50 text-amber-800',    dot: 'bg-amber-500',  sep: 'text-amber-400',  x: 'text-amber-400 hover:text-amber-800',    link: 'hover:text-amber-900' }

  return (
    <div className={`sticky top-0 z-30 flex h-9 items-center justify-center gap-2 border-b px-4 text-xs font-medium ${cls.bar}`}>
      <span className={`inline-flex h-2 w-2 shrink-0 animate-pulse-dot rounded-full ${cls.dot}`} />
      <span className="flex min-w-0 items-center gap-1.5 truncate">
        <span className="shrink-0">{icon} {label}</span>
        {items.map((p, i) => (
          <span key={p.id} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <span aria-hidden className={`shrink-0 ${cls.sep}`}>·</span>}
            <Link href={hrefFor(p.id)} className={`truncate font-semibold underline underline-offset-2 ${cls.link}`}>
              {p.name}
            </Link>
          </span>
        ))}
      </span>
      <button type="button" aria-label="Dismiss" onClick={onDismiss} className={`absolute right-3 ${cls.x}`}>
        ✕
      </button>
    </div>
  )
}
