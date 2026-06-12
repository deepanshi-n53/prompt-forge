'use client'

import { Button } from '@/components/ui/button'

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW'

export interface Assumption {
  field: string
  inferredValue: string
  confidence: Confidence
  reason: string
}

interface AssumptionCardProps extends Assumption {
  onChangeDecision?: (field: string) => void
}

const CONFIDENCE_STYLES: Record<Confidence, { badge: string; label: string }> = {
  HIGH: { badge: 'bg-green-100 text-green-700 border-green-200', label: 'High confidence' },
  MEDIUM: { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Medium confidence' },
  LOW: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Low confidence' },
}

export function AssumptionCard({
  field,
  inferredValue,
  confidence,
  reason,
  onChangeDecision,
}: AssumptionCardProps) {
  const { badge, label } = CONFIDENCE_STYLES[confidence]

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
      {/* header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{field}</p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-900 break-words">{inferredValue}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${badge}`}>
          {label}
        </span>
      </div>

      {/* reason */}
      <p className="text-xs text-zinc-500 leading-relaxed">{reason}</p>

      {/* action */}
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={() => onChangeDecision?.(field)}
      >
        Change this decision
      </Button>
    </div>
  )
}
