'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useJobProgress } from '@/hooks/useJobProgress'
import { GenerationPauseModal } from '@/components/shared/GenerationPauseModal'
import { cn } from '@/lib/utils'

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
  const [dbStatus, setDbStatus] = useState<'ready' | 'error' | null>(null)

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

  // Track which pause question was answered (by field), NOT a one-shot boolean —
  // a single generation can pause multiple times (e.g. §06 MFA, §09 real-time,
  // §12 payments, §20 compliance), so we must re-show the modal per question.
  const [answeredField, setAnsweredField] = useState<string | null>(null)
  const currentPauseField = progress.pauseQuestion?.field ?? null

  const isPaused   = progress.status === 'paused'
    && !!progress.pauseQuestion
    && answeredField !== currentPauseField
  const isFailed   = progress.status === 'failed'  || dbStatus === 'error'
  const isComplete = progress.status === 'complete' || dbStatus === 'ready'
  // When DB says ready but Redis has no data, show 100%
  const displayPercent = dbStatus === 'ready' ? 100 : progress.percent

  // Honest ETA — parse the "(completed/total)" the generator embeds in its status
  // message, falling back to a coarse estimate. ~4s per remaining section.
  const sectionMatch      = progress.message?.match(/\((\d+)\s*\/\s*(\d+)\)/)
  const completedSections = sectionMatch ? parseInt(sectionMatch[1], 10) : 0
  const totalSections     = sectionMatch ? parseInt(sectionMatch[2], 10) : 0
  const remainingSections = Math.max(0, totalSections - completedSections)
  const estimatedMinutes  = Math.ceil((remainingSections * 4) / 60)

  const etaText =
    displayPercent >= 90                            ? 'Almost done…'
    : completedSections === 0 || totalSections === 0 ? 'Estimated 3–5 minutes — complex apps may take longer'
    : estimatedMinutes <= 1                          ? 'About 1 minute remaining'
    :                                                  `About ${estimatedMinutes} minutes remaining`

  // ── Stuck detection ──────────────────────────────────────────────────────────
  // Track the wall-clock time of the last forward progress (a section completing).
  // If nothing advances for 4 minutes while still generating, surface a warning
  // with an escape hatch — generation can silently stall on a slow AI response.
  const STUCK_AFTER_MS = 240_000
  const lastProgressAt = useRef<number>(Date.now())
  const lastCompleted  = useRef<number>(0)
  const [isStuck, setIsStuck] = useState(false)

  const isActive = !isComplete && !isFailed && !isPaused

  // Reset the stall timer whenever completedSections increases.
  useEffect(() => {
    if (completedSections > lastCompleted.current) {
      lastCompleted.current = completedSections
      lastProgressAt.current = Date.now()
      setIsStuck(false)
    }
  }, [completedSections])

  // Re-arm the timer when generation (re)starts so a finished/paused run never
  // shows the warning.
  useEffect(() => {
    if (isActive) lastProgressAt.current = Date.now()
    else setIsStuck(false)
  }, [isActive])

  // Poll every 30s — flip to stuck once we've gone STUCK_AFTER_MS without progress.
  useEffect(() => {
    if (!isActive) return
    const t = setInterval(() => {
      if (Date.now() - lastProgressAt.current > STUCK_AFTER_MS) setIsStuck(true)
    }, 30_000)
    return () => clearInterval(t)
  }, [isActive])

  // ── Cancel + retry escape route ──────────────────────────────────────────────
  const [cancelling, setCancelling] = useState(false)

  async function cancelAndRetry() {
    setCancelling(true)
    try {
      await fetch(`/api/projects/${projectId}/cancel`, { method: 'POST' })
    } catch { /* DB is set ERROR server-side regardless; still bail to setup */ }
    router.push(`/project/${projectId}/setup`)
  }

  function waitLonger() {
    lastProgressAt.current = Date.now()
    setIsStuck(false)
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      {/* Mid-generation pause modal */}
      {isPaused && progress.pauseQuestion && (
        <GenerationPauseModal
          key={progress.pauseQuestion.field}
          projectId={projectId}
          pauseQuestion={progress.pauseQuestion}
          onAnswered={() => setAnsweredField(progress.pauseQuestion!.field)}
        />
      )}

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
                : isPaused   ? 'text-amber-700'
                : 'text-zinc-900',
              )}
            >
              {isFailed   ? 'Generation failed'
              : isComplete ? 'Architecture ready!'
              : isPaused   ? 'Waiting for your answer…'
              : 'Generating your architecture…'}
            </h2>
            <p className="text-sm text-zinc-500">{progress.message}</p>
          </div>
        </div>

        {/* stuck warning — appears above the progress bar after a 4-min stall */}
        {isStuck && isActive && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
            <p className="text-sm font-semibold text-amber-800">
              ⚠ Generation seems stuck at {displayPercent}%
            </p>
            <p className="mt-1 text-xs text-amber-700">
              This sometimes happens with slow AI responses.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={waitLonger}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                Wait longer
              </button>
              <button
                type="button"
                onClick={cancelAndRetry}
                disabled={cancelling}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {cancelling ? 'Cancelling…' : 'Cancel and retry'}
              </button>
            </div>
          </div>
        )}

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
                Retry from setup →
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
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-600">{etaText}</p>
            <p className="text-xs text-zinc-400">
              Generation runs in the background. You can safely close this tab and return later.
            </p>
          </div>
        )}

        {/* Always-available escape route while generating — never strand the user. */}
        {isActive && (
          <button
            type="button"
            onClick={cancelAndRetry}
            disabled={cancelling}
            className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 disabled:opacity-60"
          >
            {cancelling ? 'Cancelling…' : 'Taking too long? Cancel and retry from setup →'}
          </button>
        )}
      </div>
    </div>
  )
}
