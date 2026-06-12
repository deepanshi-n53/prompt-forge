'use client'

import { useEffect, useRef, useState } from 'react'
import type { JobProgress } from '@/types/api'

const MAX_SSE_RETRIES  = 3
const POLL_INTERVAL_MS = 2_000

const INITIAL: JobProgress = {
  status:  'pending',
  percent: 0,
  step:    'setup',
  message: 'Connecting…',
}

export function useJobProgress(jobId: string | null): JobProgress {
  const [progress, setProgress] = useState<JobProgress>(INITIAL)

  // Use a ref so the latest value is accessible inside closures without
  // needing to re-run the effect when progress changes.
  const progressRef = useRef<JobProgress>(INITIAL)

  function apply(next: JobProgress) {
    progressRef.current = next
    setProgress(next)
  }

  useEffect(() => {
    if (!jobId) return

    let done        = false
    let sseRetries  = 0
    let es:          EventSource | null = null
    let pollTimer:   ReturnType<typeof setInterval> | null = null
    let retryTimer:  ReturnType<typeof setTimeout> | null  = null

    function teardown() {
      done = true
      es?.close()
      es = null
      if (pollTimer)  clearInterval(pollTimer)
      if (retryTimer) clearTimeout(retryTimer)
      pollTimer  = null
      retryTimer = null
    }

    // ── Polling fallback ───────────────────────────────────────────────────────

    function startPolling() {
      if (done) return

      async function poll() {
        if (done) {
          if (pollTimer) clearInterval(pollTimer)
          return
        }
        try {
          const res = await fetch(`/api/jobs/${jobId}`)
          if (!res.ok) return
          const { state } = (await res.json()) as { state: JobProgress | null }
          if (state) {
            apply(state)
            if (state.status === 'complete' || state.status === 'failed') {
              teardown()
            }
          }
        } catch { /* network hiccup — keep polling */ }
      }

      poll()
      pollTimer = setInterval(poll, POLL_INTERVAL_MS)
    }

    // ── SSE connection ─────────────────────────────────────────────────────────

    function connectSSE() {
      if (done) return

      es = new EventSource(`/api/jobs/${jobId}/stream`)

      es.onmessage = (event) => {
        if (done) { es?.close(); return }
        try {
          const data = JSON.parse(event.data) as JobProgress
          apply(data)
          if (data.status === 'complete' || data.status === 'failed') {
            teardown()
          }
        } catch { /* malformed frame — ignore */ }
      }

      es.onerror = () => {
        es?.close()
        es = null
        if (done) return

        sseRetries++
        if (sseRetries < MAX_SSE_RETRIES) {
          // Exponential back-off: 1 s, 2 s, 4 s
          const delay = Math.pow(2, sseRetries - 1) * 1_000
          retryTimer = setTimeout(connectSSE, delay)
        } else {
          // SSE exhausted — fall back to polling
          startPolling()
        }
      }
    }

    connectSSE()
    return teardown
  }, [jobId])

  return progress
}
