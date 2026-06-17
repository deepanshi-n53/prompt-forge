'use client'

import { useEffect, useRef, useState } from 'react'
import type { JobProgress } from '@/types/api'

const MAX_SSE_RETRIES  = 3
const POLL_INTERVAL_MS = 3_000

// A job frame carries an updatedAt (epoch ms) used to order frames arriving from
// two channels — SSE and the safety poll — so a stale frame never clobbers a
// fresher one.
type JobFrame = JobProgress & { updatedAt?: number }

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
  // Latest applied frame timestamp — guards against an out-of-order frame from
  // whichever channel (SSE or poll) lands second with older data.
  const lastAtRef = useRef<number>(0)

  useEffect(() => {
    if (!jobId) return

    let done       = false
    let sseRetries = 0
    let es:         EventSource | null = null
    let pollTimer:  ReturnType<typeof setInterval> | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null  = null

    function teardown() {
      done = true
      es?.close()
      es = null
      if (pollTimer)  clearInterval(pollTimer)
      if (retryTimer) clearTimeout(retryTimer)
      pollTimer  = null
      retryTimer = null
    }

    // Apply a frame only if it is newer than the last one we showed. Frames
    // without an updatedAt (shouldn't happen) are always applied.
    function applyIfNewer(next: JobFrame, source: 'sse' | 'poll') {
      const at = next.updatedAt
      if (at != null && at <= lastAtRef.current) return
      if (at != null) lastAtRef.current = at

      if (next.status === 'paused' && next.pauseQuestion) {
        console.log('[PAUSE] Modal triggered by:', source, '— field:', next.pauseQuestion.field)
      }

      progressRef.current = next
      setProgress(next)

      if (next.status === 'complete' || next.status === 'failed') teardown()
    }

    // ── Safety poll (always on, parallel to SSE) ─────────────────────────────
    // Railway/proxy can hold an SSE connection open while silently buffering
    // frames — no error fires, so an error-gated fallback would never run. This
    // unconditional poll guarantees the current state (incl. a `paused` frame
    // sitting in Redis) reaches the client within POLL_INTERVAL_MS regardless of
    // SSE health.
    async function poll() {
      if (done) return
      try {
        const res = await fetch(`/api/jobs/${jobId}`)
        if (!res.ok || done) return
        const { state } = (await res.json()) as { state: JobFrame | null }
        if (state && !done) applyIfNewer(state, 'poll')
      } catch { /* network hiccup — next tick retries */ }
    }

    // ── SSE connection ───────────────────────────────────────────────────────

    function connectSSE() {
      if (done) return

      es = new EventSource(`/api/jobs/${jobId}/stream`)

      es.onmessage = (event) => {
        if (done) { es?.close(); return }
        try {
          applyIfNewer(JSON.parse(event.data) as JobFrame, 'sse')
        } catch { /* malformed frame — ignore */ }
      }

      es.onerror = () => {
        es?.close()
        es = null
        if (done) return

        sseRetries++
        if (sseRetries < MAX_SSE_RETRIES) {
          // Exponential back-off: 1 s, 2 s, 4 s. The safety poll keeps the UI
          // live in the meantime, so a permanent SSE failure is non-fatal.
          const delay = Math.pow(2, sseRetries - 1) * 1_000
          retryTimer = setTimeout(connectSSE, delay)
        }
      }
    }

    // Seed immediately (before the SSE handshake) so a refresh mid-pause shows
    // the modal at once, then keep the safety poll running and open SSE.
    poll()
    pollTimer = setInterval(poll, POLL_INTERVAL_MS)
    connectSSE()

    return teardown
  }, [jobId])

  return progress
}
