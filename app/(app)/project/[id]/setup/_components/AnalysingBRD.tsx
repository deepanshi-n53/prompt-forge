'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Shown on the setup screen while the BRD is still being parsed
// (project.status === 'PROCESSING'). The setup wizard is a server component that
// reads the extracted decisions ONCE on load, so rendering it before parse
// finishes would show an all-blank "Unknown" state. Instead we poll the project
// status and, the moment parsing completes (status leaves PROCESSING/UPDATING),
// call router.refresh() to re-run the server component — which then renders the
// wizard with the populated decisions. No manual refresh needed.
const POLL_INTERVAL_MS = 2_500

export function AnalysingBRD({ projectId }: { projectId: string }) {
  const router = useRouter()
  // Guard so we only trigger a single refresh once parsing is done.
  const refreshed = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      if (cancelled || refreshed.current) return
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { project?: { status?: string } }
        const status = data.project?.status
        // Anything other than the in-flight parse states means parse is done
        // (PARSED / ERROR / READY) — re-render the server component to show the
        // wizard (or the error/retry state it renders for ERROR).
        if (status && status !== 'PROCESSING' && status !== 'UPDATING') {
          refreshed.current = true
          router.refresh()
        }
      } catch {
        /* transient network error — next tick retries */
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [projectId, router])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-zinc-200 border-t-indigo-500" />
      <h2 className="mt-5 text-lg font-bold text-zinc-900">Analysing your BRD…</h2>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">
        Extracting your architecture decisions. This usually takes a few seconds —
        we&rsquo;ll load your setup automatically when it&rsquo;s ready.
      </p>
    </div>
  )
}
