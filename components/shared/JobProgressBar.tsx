'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { JobProgress } from '@/types/api'

// ── Elapsed timer ─────────────────────────────────────────────────────────────

function useElapsed(running: boolean): number {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(0)

  useEffect(() => {
    if (!running) return
    startRef.current = Date.now()
    const t = setInterval(() => setElapsed(Date.now() - startRef.current), 1_000)
    return () => clearInterval(t)
  }, [running])

  return elapsed
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1_000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn(className)}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn(className)}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6"  y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export interface JobProgressBarProps {
  progress:  JobProgress
  className?: string
  onRetry?:  () => void
}

export function JobProgressBar({ progress, className, onRetry }: JobProgressBarProps) {
  const isRunning  = progress.status === 'running' || progress.status === 'pending'
  const isComplete = progress.status === 'complete'
  const isFailed   = progress.status === 'failed'

  const elapsed = useElapsed(isRunning)

  return (
    <div className={cn('w-full space-y-3', className)}>
      {/* Status row */}
      <div className="flex items-center gap-2.5">
        {isRunning  && <Spinner   className="h-4 w-4 shrink-0 text-indigo-500" />}
        {isComplete && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100">
            <CheckIcon className="h-3 w-3 text-green-600" />
          </span>
        )}
        {isFailed   && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
            <XIcon className="h-3 w-3 text-red-600" />
          </span>
        )}

        <span className={cn(
          'flex-1 text-sm font-medium',
          isComplete ? 'text-green-700'
          : isFailed  ? 'text-red-700'
          : 'text-zinc-700',
        )}>
          {progress.message}
        </span>

        {isRunning && elapsed > 0 && (
          <span className="shrink-0 text-xs tabular-nums text-zinc-400">
            {formatElapsed(elapsed)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {!isFailed && (
        <div className="space-y-1">
          <div
            role="progressbar"
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full overflow-hidden rounded-full bg-zinc-100"
          >
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700 ease-out',
                isComplete ? 'bg-green-500' : 'bg-indigo-500',
              )}
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          {progress.step && progress.step !== 'setup' && progress.step !== 'done' && (
            <p className="text-right text-xs text-zinc-400">{progress.step}</p>
          )}
        </div>
      )}

      {/* Error details + retry */}
      {isFailed && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 space-y-2">
          {progress.error && (
            <p className="text-sm text-red-700">{progress.error}</p>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 transition-colors"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  )
}
