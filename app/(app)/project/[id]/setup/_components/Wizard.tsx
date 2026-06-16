'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { BRDInsight, GapQuestion } from '@/lib/ai/gap-analyzer'

// ── Confidence badge ──────────────────────────────────────────────────────────

function ConfidenceDot({ level }: { level: 'HIGH' | 'MEDIUM' | 'UNKNOWN' }) {
  if (level === 'HIGH')    return <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5" />
  if (level === 'MEDIUM')  return <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1.5" />
  return <span className="inline-block w-2 h-2 rounded-full bg-zinc-300 mr-1.5" />
}

// ── BRD Insights summary screen ───────────────────────────────────────────────

function InsightsSummary({
  insights,
  gapCount,
  onContinue,
}: {
  insights: BRDInsight[]
  gapCount: number
  onContinue: () => void
}) {
  return (
    <div className="w-full max-w-xl">
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          What I understood from your BRD
        </h2>
        <p className="mb-4 text-xs text-zinc-400">
          Extracted automatically — review below, then answer {gapCount} question{gapCount !== 1 ? 's' : ''} to complete your setup
        </p>
        <div className="space-y-2.5">
          {insights.map((insight) => (
            <div key={insight.label} className="flex items-start gap-2">
              <ConfidenceDot level={insight.confidence} />
              <div className="min-w-0">
                <span className="text-xs font-medium text-zinc-500">{insight.label}: </span>
                <span className={cn(
                  'text-xs',
                  insight.confidence === 'UNKNOWN' ? 'text-zinc-400 italic' : 'text-zinc-800 font-medium',
                )}>
                  {insight.value}
                </span>
                {insight.reason && insight.confidence !== 'HIGH' && (
                  <span className="ml-1.5 text-[10px] text-zinc-400">({insight.reason})</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3 border-t border-zinc-100 pt-3">
          <div className="flex gap-2 text-[10px] text-zinc-400">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Confirmed</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> Inferred</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-zinc-300" /> Unknown</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {gapCount === 0
            ? 'Everything is set — ready to generate!'
            : `${gapCount} quick question${gapCount !== 1 ? 's' : ''} to go →`}
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
        >
          {gapCount === 0 ? 'Generate prompts →' : 'Answer questions →'}
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

        {/* AI inference badge */}
        {question.inferredValue && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
            AI inferred: <strong>{question.inferredValue}</strong>
            {question.inferredReason && (
              <span className="text-amber-500 ml-0.5">— {question.inferredReason}</span>
            )}
          </div>
        )}
      </div>

      {/* options */}
      <div className="mb-6 space-y-2.5">
        {question.options.map((opt) => {
          const selected = isSelected(opt.value)
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
                  <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">AI</span>
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
  projectId:    string
  projectName:  string
  insights:     BRDInsight[]
  gapQuestions: GapQuestion[]
  filledAnswers: Record<string, string>
}

export function Wizard({ projectId, projectName, insights, gapQuestions, filledAnswers }: WizardProps) {
  const router = useRouter()

  // -1 = insights summary, 0..n-1 = question index
  const [phase, setPhase]         = useState<'summary' | 'questions'>('summary')
  const [questionIdx, setQIdx]    = useState(0)
  const [answers, setAnswers]     = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')

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

    // Build final payload: BRD-filled answers + user answers (user wins on conflict)
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
          insights={insights}
          gapCount={totalQuestions}
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
