'use client'

import { useEffect, useState } from 'react'
import type { BRDHealthReport, HealthDimension } from '@/types'

// ── helpers ──────────────────────────────────────────────────────────────────

const RADIUS = 50
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function scoreColor(score: number) {
  if (score <= 40) return { stroke: '#ef4444', text: 'text-red-500', bg: 'bg-red-500', label: 'Needs work' }
  if (score <= 70) return { stroke: '#f59e0b', text: 'text-amber-500', bg: 'bg-amber-500', label: 'Good start' }
  return { stroke: '#22c55e', text: 'text-green-500', bg: 'bg-green-500', label: 'Strong BRD' }
}

// ── circular dial ─────────────────────────────────────────────────────────────

function Dial({ score }: { score: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let start: number | null = null
    const duration = 900

    function tick(ts: number) {
      if (!start) start = ts
      const pct = Math.min((ts - start) / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - pct, 3)
      setDisplay(Math.round(eased * score))
      if (pct < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [score])

  const offset = CIRCUMFERENCE * (1 - display / 100)
  const { stroke, text, label } = scoreColor(score)

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="160" height="160" viewBox="0 0 120 120" className="-rotate-90">
        {/* track */}
        <circle
          cx="60" cy="60" r={RADIUS}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="10"
        />
        {/* progress */}
        <circle
          cx="60" cy="60" r={RADIUS}
          fill="none"
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={CIRCUMFERENCE * (1 - display / 100)}
          style={{ transition: 'stroke-dashoffset 0.05s linear' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center" style={{ marginTop: -8 }}>
        <span className={`text-4xl font-bold tabular-nums ${text}`}>{display}</span>
        <span className="text-xs text-zinc-400 uppercase tracking-wide">/100</span>
      </div>
      <span className={`text-sm font-semibold ${text}`}>{label}</span>
    </div>
  )
}

// ── dimension bar ─────────────────────────────────────────────────────────────

function DimensionBar({ dimension }: { dimension: HealthDimension }) {
  const [width, setWidth] = useState(0)
  const { bg, text } = scoreColor(dimension.score)

  useEffect(() => {
    const t = setTimeout(() => setWidth(dimension.score), 100)
    return () => clearTimeout(t)
  }, [dimension.score])

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-700">{dimension.name}</span>
        <span className={`font-semibold tabular-nums ${text}`}>{dimension.score}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${bg} transition-all duration-700 ease-out`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

// ── recommendation card ───────────────────────────────────────────────────────

function RecommendationCard({ text }: { text: string }) {
  // split "Add X (Y%): reason" → title + reason
  const colonIdx = text.indexOf(':')
  const title = colonIdx > -1 ? text.slice(0, colonIdx) : text
  const reason = colonIdx > -1 ? text.slice(colonIdx + 1).trim() : ''

  return (
    <div className="flex gap-3 rounded-lg border border-amber-100 bg-amber-50 p-3">
      <span className="mt-0.5 text-amber-500 shrink-0">⚠</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-800">{title}</p>
        {reason && <p className="text-xs text-zinc-500 mt-0.5">{reason}</p>}
      </div>
    </div>
  )
}

// ── main export ───────────────────────────────────────────────────────────────

interface HealthScoreProps {
  report: BRDHealthReport
}

export function HealthScore({ report }: HealthScoreProps) {
  return (
    <div className="space-y-8">
      {/* overall score */}
      <div className="flex flex-col items-center">
        <div className="relative">
          <Dial score={report.total} />
        </div>
        <p className="mt-4 text-sm text-zinc-500 text-center max-w-xs">
          Based on 8 dimensions of BRD completeness
        </p>
      </div>

      {/* dimension breakdown */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">
          Dimension breakdown
        </h3>
        {report.dimensions.map((d) => (
          <DimensionBar key={d.name} dimension={d} />
        ))}
      </div>

      {/* recommendations */}
      {report.recommendations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">
            Recommendations ({report.recommendations.length})
          </h3>
          {report.recommendations.map((rec, i) => (
            <RecommendationCard key={i} text={rec} />
          ))}
        </div>
      )}

      {report.recommendations.length === 0 && (
        <div className="rounded-lg border border-green-100 bg-green-50 p-4 text-center">
          <p className="text-sm font-medium text-green-700">
            Your BRD covers all key dimensions.
          </p>
        </div>
      )}
    </div>
  )
}
