'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { InsightGroup, GapQuestion } from '@/lib/ai/gap-analyzer'

// ── Confidence dot ────────────────────────────────────────────────────────────

function ConfidenceDot({ level }: { level: 'HIGH' | 'MEDIUM' | 'UNKNOWN' }) {
  if (level === 'HIGH')    return <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-green-500" />
  if (level === 'MEDIUM')  return <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-amber-400" />
  return <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-zinc-300" />
}

// ── BRD Insights summary screen ───────────────────────────────────────────────

function InsightsSummary({
  insightGroups,
  gapCount,
  confirmed,
  inferred,
  unknown,
  onContinue,
}: {
  insightGroups: InsightGroup[]
  gapCount:  number
  confirmed: number
  inferred:  number
  unknown:   number
  onContinue: () => void
}) {
  return (
    <div className="w-full max-w-2xl">
      <div className="mb-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-0.5 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          What I understood from your BRD
        </h2>
        <p className="mb-5 text-xs text-zinc-400">
          Extracted automatically from your document — review below, then answer{' '}
          {gapCount === 0 ? 'no questions — everything is set!' : `${gapCount} question${gapCount !== 1 ? 's' : ''} to complete your setup`}
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          {insightGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                {group.title}
              </p>
              <div className="space-y-1.5">
                {group.insights.map((insight) => (
                  <div key={insight.label} className="flex items-start gap-2">
                    <ConfidenceDot level={insight.confidence} />
                    <div className="min-w-0">
                      <span className="text-xs text-zinc-500">{insight.label}: </span>
                      <span className={cn(
                        'text-xs font-medium',
                        insight.confidence === 'UNKNOWN' ? 'italic text-zinc-400' : 'text-zinc-800',
                      )}>
                        {insight.value}
                      </span>
                      {insight.reason && insight.confidence === 'MEDIUM' && (
                        <span className="ml-1 text-[10px] text-zinc-400">({insight.reason})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Legend + summary */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
          <div className="flex gap-3 text-[10px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              {confirmed} confirmed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              {inferred} inferred
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-zinc-300" />
              {unknown} unknown
            </span>
          </div>
          {gapCount > 0 && (
            <p className="text-[10px] text-zinc-400">
              {gapCount} gap{gapCount !== 1 ? 's' : ''} need{gapCount === 1 ? 's' : ''} your input
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {gapCount === 0
            ? 'Everything is set — ready to generate your architecture!'
            : `${gapCount} quick question${gapCount !== 1 ? 's' : ''} left →`}
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
        >
          {gapCount === 0 ? 'Generate prompts →' : 'Review gaps and generate →'}
        </button>
      </div>
    </div>
  )
}

// ── Single question screen ────────────────────────────────────────────────────

function QuestionScreen({
  question,
  current,
  step,
  totalSteps,
  onToggle,
  onNext,
  onBack,
  onSkip,
  isLast,
  submitting,
  error,
}: {
  question:    GapQuestion
  current:     string
  step:        number
  totalSteps:  number
  onToggle:    (value: string) => void
  onNext:      () => void
  onBack:      () => void
  onSkip:      () => void
  isLast:      boolean
  submitting:  boolean
  error:       string
}) {
  function isSelected(value: string) {
    if (!question.multiSelect) return current === value
    return current.split(',').filter(Boolean).includes(value)
  }

  const canAdvance = current !== ''

  return (
    <div className="w-full max-w-xl">
      {/* progress */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
          <span>Question {step} of {totalSteps}</span>
          <span>{Math.round((step / totalSteps) * 100)}% complete</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-100">
          <div
            className="h-1.5 rounded-full bg-zinc-900 transition-all duration-500"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* question */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-zinc-900">{question.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{question.subtitle}</p>

        {question.inferredValue && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            AI inferred: <strong>{question.inferredValue}</strong>
            {question.inferredReason && (
              <span className="ml-0.5 text-amber-500">— {question.inferredReason}</span>
            )}
          </div>
        )}
      </div>

      {/* options */}
      <div className="mb-6 space-y-2.5">
        {question.options.map((opt) => {
          const selected   = isSelected(opt.value)
          const isInferred = opt.value === question.inferredValue
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              className={cn(
                'w-full rounded-xl border px-4 py-3.5 text-left transition-all',
                'hover:border-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900',
                selected
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-800',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="block font-medium leading-snug">{opt.label}</span>
                {isInferred && !selected && (
                  <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                    AI pick
                  </span>
                )}
              </div>
              <span className={cn('mt-0.5 block text-xs', selected ? 'text-zinc-300' : 'text-zinc-400')}>
                {opt.description}
              </span>
            </button>
          )
        })}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button type="button" onClick={onBack} className="text-sm text-zinc-500 hover:text-zinc-700">
              ← Back
            </button>
          )}
          <button type="button" onClick={onSkip} className="text-sm text-zinc-400 hover:text-zinc-600">
            Skip (use {question.inferredValue ? 'AI pick' : 'default'})
          </button>
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={!canAdvance || submitting}
          className={cn(
            'rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors',
            canAdvance && !submitting
              ? 'bg-zinc-900 text-white hover:bg-zinc-700'
              : 'cursor-not-allowed bg-zinc-100 text-zinc-400',
          )}
        >
          {submitting ? 'Saving…' : isLast ? 'Generate prompts →' : 'Next →'}
        </button>
      </div>
    </div>
  )
}

// ── Wizard ────────────────────────────────────────────────────────────────────

interface WizardProps {
  projectId:     string
  projectName:   string
  insightGroups: InsightGroup[]
  gapQuestions:  GapQuestion[]
  filledAnswers: Record<string, string>
  confirmed:     number
  inferred:      number
  unknown:       number
}

export function Wizard({
  projectId,
  projectName,
  insightGroups,
  gapQuestions,
  filledAnswers,
  confirmed,
  inferred,
  unknown,
}: WizardProps) {
  const router = useRouter()

  const [phase, setPhase]           = useState<'summary' | 'questions'>('summary')
  const [questionIdx, setQIdx]      = useState(0)
  const [answers, setAnswers]       = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  const totalQuestions = gapQuestions.length
  const currentQ       = gapQuestions[questionIdx]
  const currentAnswer  = answers[currentQ?.id ?? ''] ?? ''

  function toggle(value: string) {
    if (!currentQ) return
    if (!currentQ.multiSelect) {
      setAnswers((prev) => ({ ...prev, [currentQ.id]: value }))
      return
    }
    const arr = currentAnswer.split(',').filter(Boolean)
    if (value === 'None') {
      setAnswers((prev) => ({ ...prev, [currentQ.id]: 'None' }))
      return
    }
    const next = arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr.filter((v) => v !== 'None'), value]
    setAnswers((prev) => ({ ...prev, [currentQ.id]: next.join(',') }))
  }

  function skip() {
    if (!currentQ) return
    const fallback = currentQ.inferredValue ?? currentQ.defaultValue
    setAnswers((prev) => ({ ...prev, [currentQ.id]: fallback }))
    advance()
  }

  function advance() {
    if (questionIdx < totalQuestions - 1) {
      setQIdx((i) => i + 1)
    } else {
      void submit()
    }
  }

  async function submit() {
    setSubmitting(true)
    setError('')

    // Merge: BRD-filled answers (background) + user answers (explicit choices win)
    const payload: Record<string, string> = { ...filledAnswers }
    for (const q of gapQuestions) {
      payload[q.id] = answers[q.id] ?? q.inferredValue ?? q.defaultValue
    }

    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 15_000)

    try {
      const res = await fetch(`/api/projects/${projectId}/answers`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  controller.signal,
      })
      clearTimeout(timeout)

      let data: { jobId?: string; error?: unknown } = {}
      try { data = await res.json() } catch { /* non-JSON — ignore */ }

      if (!res.ok) {
        const msg = typeof data.error === 'string'
          ? data.error
          : `Server error (${res.status}) — please try again.`
        setError(msg)
        setSubmitting(false)
        return
      }

      router.push(`/project/${projectId}/generating?jobId=${(data.jobId as string | undefined) ?? projectId}`)
    } catch (err) {
      clearTimeout(timeout)
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      setError(isTimeout
        ? 'Request timed out — please try again.'
        : 'Network error — please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <p className="mb-6 text-center text-sm text-zinc-400">{projectName}</p>

      {phase === 'summary' ? (
        <InsightsSummary
          insightGroups={insightGroups}
          gapCount={totalQuestions}
          confirmed={confirmed}
          inferred={inferred}
          unknown={unknown}
          onContinue={() => {
            if (totalQuestions === 0) {
              void submit()
            } else {
              setPhase('questions')
            }
          }}
        />
      ) : currentQ ? (
        <QuestionScreen
          question={currentQ}
          current={currentAnswer}
          step={questionIdx + 1}
          totalSteps={totalQuestions}
          onToggle={toggle}
          onNext={advance}
          onBack={() => {
            if (questionIdx === 0) setPhase('summary')
            else setQIdx((i) => i - 1)
          }}
          onSkip={skip}
          isLast={questionIdx === totalQuestions - 1}
          submitting={submitting}
          error={error}
        />
      ) : null}
    </div>
  )
}
