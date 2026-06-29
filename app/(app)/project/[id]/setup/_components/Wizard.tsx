'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { InsightGroup, GapQuestion } from '@/lib/ai/gap-analyzer'

// ── Confidence dot ────────────────────────────────────────────────────────────
// green ≥ 0.9 (explicit) · amber 0.5–0.89 (inferred) · grey < 0.5 (unknown)

function ConfidenceDot({ confidence }: { confidence: number }) {
  const color =
    confidence >= 0.9 ? 'bg-green-500' : confidence >= 0.5 ? 'bg-amber-400' : 'bg-zinc-300'
  return <span className={cn('mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full', color)} />
}

// ── BRD Insights summary screen ───────────────────────────────────────────────

function InsightsSummary({
  insightGroups,
  gapCount,
  confirmed,
  inferred,
  unknown,
  submitting,
  onContinue,
}: {
  insightGroups: InsightGroup[]
  gapCount:   number
  confirmed:  number
  inferred:   number
  unknown:    number
  submitting: boolean
  onContinue: () => void
}) {
  return (
    <div className="w-full max-w-2xl">
      <div className="mb-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-0.5 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          What I understood from your BRD
        </h2>
        <p className="mb-5 text-xs text-zinc-400">
          Extracted automatically from your document — review below
          {gapCount === 0
            ? '. Everything needed is set!'
            : `, then answer ${gapCount} question${gapCount !== 1 ? 's' : ''} to fill the gaps.`}
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          {insightGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                {group.title}
              </p>
              <div className="space-y-1.5">
                {group.insights.map((insight) => {
                  const isUnknown = insight.value === 'Unknown' || insight.confidence < 0.5
                  return (
                    <div key={insight.field} className="flex items-start gap-2">
                      <ConfidenceDot confidence={insight.confidence} />
                      <div className="min-w-0">
                        <span className="text-xs text-zinc-500">{insight.label}: </span>
                        <span className={cn(
                          'text-xs font-medium',
                          isUnknown ? 'italic text-zinc-400' : 'text-zinc-800',
                        )}>
                          {insight.value}
                        </span>
                      </div>
                    </div>
                  )
                })}
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
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {gapCount === 0
            ? 'Your BRD is detailed! Ready to generate.'
            : `${gapCount} quick question${gapCount !== 1 ? 's' : ''} left →`}
        </p>
        <button
          type="button"
          onClick={onContinue}
          disabled={submitting}
          className={cn(
            'rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors',
            submitting ? 'cursor-not-allowed bg-zinc-400' : 'bg-zinc-900 hover:bg-zinc-700',
          )}
        >
          {submitting ? 'Saving…' : gapCount === 0 ? 'Generate prompts →' : 'Answer questions →'}
        </button>
      </div>
    </div>
  )
}

// ── Single gap question ───────────────────────────────────────────────────────

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: GapQuestion
  value:    string
  onChange: (value: string) => void
}) {
  // boolean → Yes / No toggle
  if (question.inputType === 'boolean') {
    return (
      <div className="flex gap-2">
        {[{ v: 'true', label: 'Yes' }, { v: 'false', label: 'No' }].map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            className={cn(
              'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
              value === opt.v
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )
  }

  // select / multiselect → option buttons. The clean enum `value` is stored; the
  // descriptive `label` is shown (the parser only accepts exact enum values).
  if ((question.inputType === 'select' || question.inputType === 'multiselect') && question.options) {
    const multi = question.inputType === 'multiselect'
    const selected = value.split(',').map((s) => s.trim()).filter(Boolean)
    const isSelected = (val: string) => (multi ? selected.includes(val) : value === val)

    function pick(val: string) {
      if (!multi) { onChange(val); return }
      const next = selected.includes(val)
        ? selected.filter((s) => s !== val)
        : [...selected, val]
      onChange(next.join(','))
    }

    return (
      <div className="flex flex-wrap gap-2">
        {question.options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => pick(opt.value)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
              isSelected(opt.value)
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )
  }

  // text
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.aiGuess ?? 'Type your answer…'}
      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
    />
  )
}

// ── Grouped questions screen ──────────────────────────────────────────────────

function QuestionsForm({
  gapQuestions,
  answers,
  onChange,
  onBack,
  onSubmit,
  submitting,
  error,
}: {
  gapQuestions: GapQuestion[]
  answers:    Record<string, string>
  onChange:   (field: string, value: string) => void
  onBack:     () => void
  onSubmit:   () => void
  submitting: boolean
  error:      string
}) {
  // Preserve priority order while collapsing into section groups.
  const grouped = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, GapQuestion[]>()
    for (const q of gapQuestions) {
      if (!map.has(q.group)) { map.set(q.group, []); order.push(q.group) }
      map.get(q.group)!.push(q)
    }
    return order.map((group) => ({ group, questions: map.get(group)! }))
  }, [gapQuestions])

  return (
    <div className="w-full max-w-xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">A few gaps to fill</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your BRD didn’t cover these — answer what you can, skip the rest and we’ll use sensible defaults.
        </p>
      </div>

      <div className="space-y-8">
        {grouped.map(({ group, questions }) => (
          <div key={group}>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              {questions.length} question{questions.length !== 1 ? 's' : ''} · {group}
            </p>
            <div className="space-y-5">
              {questions.map((q) => (
                <div key={q.field} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-zinc-900">{q.question}</p>
                  {q.aiGuess && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] text-amber-700">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                      I inferred: <strong>{q.aiGuess}</strong>
                      {q.preFilledAnswer && <span className="text-amber-500"> — confirm or change</span>}
                    </div>
                  )}
                  {q.fromPreviousAnswer && q.preFilledAnswer && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] text-indigo-700">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400" />
                      From your previous answers: <strong>{q.preFilledAnswer}</strong>
                      <span className="text-indigo-500"> — confirm or change</span>
                    </div>
                  )}
                  <div className="mt-3">
                    <QuestionField
                      question={q}
                      value={answers[q.field] ?? ''}
                      onChange={(v) => onChange(q.field, v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-5 text-sm text-red-600">{error}</p>}

      <div className="mt-8 flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-sm text-zinc-500 hover:text-zinc-700">
          ← Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className={cn(
            'rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors',
            submitting ? 'cursor-not-allowed bg-zinc-400' : 'bg-zinc-900 hover:bg-zinc-700',
          )}
        >
          {submitting ? 'Saving…' : 'Generate prompts →'}
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
  confirmed:     number
  inferred:      number
  unknown:       number
}

export function Wizard({
  projectId,
  projectName,
  insightGroups,
  gapQuestions,
  confirmed,
  inferred,
  unknown,
}: WizardProps) {
  const router = useRouter()

  const [phase, setPhase]           = useState<'summary' | 'questions'>('summary')
  // Seed answers with the parser's inferred values so 0.5–0.7 questions arrive
  // pre-selected — the user just confirms (clicks through) or changes them.
  const [answers, setAnswers]       = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const q of gapQuestions) {
      if (q.preFilledAnswer != null && q.preFilledAnswer !== '') init[q.field] = q.preFilledAnswer
    }
    return init
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  const gapCount = gapQuestions.length

  function setAnswer(field: string, value: string) {
    setAnswers((prev) => ({ ...prev, [field]: value }))
  }

  async function submit() {
    setSubmitting(true)
    setError('')

    // Only send fields the user actually answered — blanks keep their inferred value.
    const payload: Record<string, string> = {}
    for (const [field, value] of Object.entries(answers)) {
      if (value != null && value.trim() !== '') payload[field] = value
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
          gapCount={gapCount}
          confirmed={confirmed}
          inferred={inferred}
          unknown={unknown}
          submitting={submitting}
          onContinue={() => {
            if (gapCount === 0) void submit()
            else setPhase('questions')
          }}
        />
      ) : (
        <QuestionsForm
          gapQuestions={gapQuestions}
          answers={answers}
          onChange={setAnswer}
          onBack={() => setPhase('summary')}
          onSubmit={submit}
          submitting={submitting}
          error={error}
        />
      )}
    </div>
  )
}
