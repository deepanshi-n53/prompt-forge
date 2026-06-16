'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useJobProgress } from '@/hooks/useJobProgress'
import { cn } from '@/lib/utils'

const SLOW_THRESHOLD_MS = 30_000

// ── Animated SVG ring ─────────────────────────────────────────────────────────

function Ring({ percent, size = 96 }: { percent: number; size?: number }) {
  const r    = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const color =
    percent === 100 ? '#22c55e'
    : percent > 60  ? '#3b82f6'
    : '#6366f1'

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - percent / 100)}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
        />
      </svg>
      <span className="absolute text-base font-bold tabular-nums" style={{ color }}>
        {percent}%
      </span>
    </div>
  )
}

// ── Section skeleton tiles ────────────────────────────────────────────────────

const PREVIEW_SECTIONS = [
  '§01 Foundation',
  '§05 Architecture',
  '§06 Auth',
  '§07 Database',
  '§08 API Design',
  '§14 UI/UX',
  '§17 Data Integrity',
  '§18 Security',
]

function SectionSkeletons({ percent }: { percent: number }) {
  const completed = Math.floor((percent / 100) * PREVIEW_SECTIONS.length)

  return (
    <div className="w-full space-y-1.5">
      {PREVIEW_SECTIONS.map((label, i) => {
        const done   = i < completed
        const active = i === completed && percent < 100

        return (
          <div
            key={label}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-all duration-500',
              done   ? 'bg-green-50'
              : active ? 'bg-blue-50'
              : 'bg-zinc-50',
            )}
          >
            {/* section badge */}
            <span
              className={cn(
                'w-16 shrink-0 rounded font-mono text-[10px] font-bold text-center py-0.5',
                done   ? 'bg-green-100 text-green-700'
                : active ? 'bg-blue-100 text-blue-700'
                : 'bg-zinc-100 text-zinc-400',
              )}
            >
              {label.split(' ')[0]}
            </span>

            {/* fill bar */}
            <div className="flex-1 overflow-hidden rounded-full bg-zinc-100 h-1.5">
              {done && (
                <div className="h-full w-full rounded-full bg-green-400 transition-all duration-500" />
              )}
              {active && (
                <div className="h-full rounded-full bg-blue-400 animate-pulse" style={{ width: '65%' }} />
              )}
            </div>

            {/* label */}
            <span
              className={cn(
                'hidden sm:block w-32 truncate text-right text-[10px]',
                done   ? 'text-green-600'
                : active ? 'text-blue-500 animate-pulse'
                : 'text-zinc-300',
              )}
            >
              {label.split(' ').slice(1).join(' ')}
            </span>

            {/* done tick */}
            {done && (
              <span className="shrink-0 text-green-500 text-xs">✓</span>
            )}
          </div>
        )
      })}

      {percent > 0 && percent < 100 && (
        <p className="text-center text-[10px] text-zinc-400 pt-1">
          +{57 - PREVIEW_SECTIONS.length} more sections being generated
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface GeneratingViewProps {
  projectId:    string
  jobId:        string
  isOnboarding?: boolean
}

export function GeneratingView({ projectId, jobId, isOnboarding = false }: GeneratingViewProps) {
  const router      = useRouter()
  const progress    = useJobProgress(jobId)
  const [slow, setSlow]         = useState(false)
  const [dbStatus, setDbStatus] = useState<'ready' | 'error' | null>(null)
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // DB fallback poll — works even if Redis/SSE is not configured
  // Polls project status directly; if READY → redirect, if ERROR → show error
  useEffect(() => {
    // Redis is working — no need for DB poll
    if (progress.status === 'complete' || progress.status === 'failed') return

    let cancelled = false

    async function poll() {
      if (cancelled) return
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok || cancelled) return
        const data = await res.json() as { project?: { status: string } }
        const status = data.project?.status
        if (status === 'READY') setDbStatus('ready')
        else if (status === 'ERROR') setDbStatus('error')
      } catch { /* ignore network errors */ }
    }

    poll()
    const interval = setInterval(poll, 5_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [progress.status, projectId])

  // Redirect on completion (from Redis or DB fallback)
  useEffect(() => {
    if (progress.status === 'complete' || dbStatus === 'ready') {
      const dest = isOnboarding
        ? `/project/${projectId}/prompts?onboarding=1`
        : `/project/${projectId}/prompts`
      const t = setTimeout(() => router.push(dest), 1200)
      return () => clearTimeout(t)
    }
  }, [progress.status, dbStatus, projectId, isOnboarding, router])

  // Start slow-timer when generation begins, cancel on completion/failure
  useEffect(() => {
    if (progress.status === 'running' && !slow) {
      slowTimer.current = setTimeout(() => setSlow(true), SLOW_THRESHOLD_MS)
    }
    if (progress.status === 'complete' || progress.status === 'failed') {
      if (slowTimer.current) clearTimeout(slowTimer.current)
    }
    return () => { if (slowTimer.current) clearTimeout(slowTimer.current) }
  }, [progress.status, slow])

  const isFailed   = progress.status === 'failed'  || dbStatus === 'error'
  const isComplete = progress.status === 'complete' || dbStatus === 'ready'
  // When DB says ready but Redis has no data, show 100%
  const displayPercent = dbStatus === 'ready' ? 100 : progress.percent

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6 text-center">

        {/* ring + status */}
        <div className="flex flex-col items-center gap-3">
          {isFailed ? (
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-red-100 bg-red-50 text-3xl">
              ✕
            </div>
          ) : (
            <Ring percent={displayPercent} />
          )}

          <div className="space-y-1">
            <h2
              className={cn(
                'text-xl font-bold',
                isFailed   ? 'text-red-700'
                : isComplete ? 'text-green-700'
                : 'text-zinc-900',
              )}
            >
              {isFailed   ? 'Generation failed'
              : isComplete ? 'Architecture ready!'
              : 'Generating your architecture…'}
            </h2>
            <p className="text-sm text-zinc-500">{progress.message}</p>
          </div>
        </div>

        {/* progress bar */}
        {!isFailed && (
          <div className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className={cn(
                  'h-2 rounded-full transition-all duration-700',
                  isComplete ? 'bg-green-500' : 'bg-indigo-500',
                )}
                style={{ width: `${displayPercent}%` }}
              />
            </div>
            {progress.step && progress.step !== 'done' && progress.step !== 'setup' && (
              <p className="text-right text-[10px] text-zinc-400">{progress.step}</p>
            )}
          </div>
        )}

        {/* section skeletons — visible while generating */}
        {!isFailed && !isComplete && (
          <SectionSkeletons percent={displayPercent} />
        )}

        {/* error state */}
        {isFailed && (
          <div className="space-y-3">
            {progress.error && (
              <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
                {progress.error}
              </p>
            )}
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => router.push(`/project/${projectId}/setup`)}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                ← Back to setup
              </button>
              <button
                type="button"
                onClick={() => router.push(`/project/${projectId}`)}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                View project
              </button>
            </div>
          </div>
        )}

        {!isFailed && !isComplete && (
          slow ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center">
              <p className="text-sm font-medium text-amber-800">
                Taking longer than expected
              </p>
              <p className="mt-0.5 text-xs text-amber-600">
                Usually ready in 90 seconds. You can close this tab — your prompts will be saved.
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-400">
              This takes 30–90 seconds. You can close this tab — your prompts will be ready when you return.
            </p>
          )
        )}
      </div>
    </div>
  )
}
