import { type NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getJobState } from '@/lib/jobs/redis'

export const dynamic = 'force-dynamic'
export const runtime  = 'nodejs'

const POLL_INTERVAL_MS  = 1_000
const PING_INTERVAL_MS  = 15_000
const MAX_DURATION_MS   = 5 * 60 * 1_000 // 5 minutes

type Context = { params: Promise<{ jobId: string }> }

export async function GET(request: NextRequest, { params }: Context) {
  const { userId } = await auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { jobId }  = await params
  const lastIdHdr  = request.headers.get('last-event-id')
  let lastSentAt   = lastIdHdr ? parseInt(lastIdHdr, 10) : 0

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false

      function close() {
        if (closed) return
        closed = true
        try { controller.close() } catch { /* already closed */ }
        cleanup()
      }

      function enqueue(chunk: string) {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          close()
        }
      }

      // ── Timers ──────────────────────────────────────────────────────────────

      const maxTimer  = setTimeout(close, MAX_DURATION_MS)
      const pingTimer = setInterval(() => enqueue(': ping\n\n'), PING_INTERVAL_MS)
      let   pollTimer: ReturnType<typeof setInterval> | null = null

      function cleanup() {
        clearTimeout(maxTimer)
        clearInterval(pingTimer)
        if (pollTimer) clearInterval(pollTimer)
      }

      // Client disconnect
      request.signal.addEventListener('abort', close)

      // ── Immediate initial state ──────────────────────────────────────────────

      async function sendCurrentState(): Promise<boolean> {
        try {
          const state = await getJobState(jobId)
          if (!state) return false

          if (state.updatedAt > lastSentAt) {
            lastSentAt = state.updatedAt
            const payload = JSON.stringify({
              status:  state.status,
              percent: state.percent,
              message: state.message,
              step:    state.step,
              ...(state.result !== undefined ? { result: state.result } : {}),
              ...(state.error  !== undefined ? { error:  state.error  } : {}),
            })
            enqueue(`id: ${state.updatedAt}\ndata: ${payload}\n\n`)
          }

          if (state.status === 'complete' || state.status === 'failed') {
            cleanup()
            setTimeout(close, 200) // short delay so the final frame is flushed
            return true
          }
        } catch { /* Redis hiccup — stay open */ }
        return false
      }

      // Send state immediately on connect (handles Last-Event-ID replay)
      const alreadyDone = await sendCurrentState()
      if (alreadyDone || closed) return

      // ── Polling loop ─────────────────────────────────────────────────────────

      pollTimer = setInterval(async () => {
        if (closed) {
          if (pollTimer) clearInterval(pollTimer)
          return
        }
        const done = await sendCurrentState()
        if (done && pollTimer) clearInterval(pollTimer)
      }, POLL_INTERVAL_MS)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx proxy buffering
    },
  })
}
