'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { PauseQuestion, PauseSubQuestion } from '@/types/api'

interface GenerationPauseModalProps {
  projectId:     string
  pauseQuestion: PauseQuestion
  onAnswered:    () => void
}

export function GenerationPauseModal({
  projectId,
  pauseQuestion,
  onAnswered,
}: GenerationPauseModalProps) {
  const isMulti = !!pauseQuestion.questions && pauseQuestion.questions.length > 0

  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  // ── POST helpers ──────────────────────────────────────────────────────────
  async function send(payload: Record<string, unknown>) {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/pause-answer`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ field: pauseQuestion.field, ...payload }),
      })
      if (!res.ok) {
        setError('Failed to submit — please try again.')
        setSubmitting(false)
        return
      }
      onAnswered()
    } catch {
      setError('Network error — please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      {/* Not dismissable — there is no backdrop click handler; a decision is required. */}
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
        {/* header */}
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">⏸</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Paused at §{pauseQuestion.sectionNum}
              {pauseQuestion.sectionName ? ` — ${pauseQuestion.sectionName}` : ''}
            </span>
          </div>
          <h2 className="text-lg font-bold text-zinc-900">{pauseQuestion.question}</h2>
          {pauseQuestion.subtitle && (
            <p className="mt-1 text-sm text-zinc-500">{pauseQuestion.subtitle}</p>
          )}
        </div>

        {isMulti ? (
          <MultiQuestionBody
            questions={pauseQuestion.questions!}
            submitting={submitting}
            error={error}
            onSubmit={(answers) => void send({ answers })}
          />
        ) : (
          <SingleQuestionBody
            pauseQuestion={pauseQuestion}
            submitting={submitting}
            error={error}
            onSubmit={(answer) => void send({ answer })}
          />
        )}
      </div>
    </div>
  )
}

// ── Single-field pause ────────────────────────────────────────────────────────

function SingleQuestionBody({
  pauseQuestion,
  submitting,
  error,
  onSubmit,
}: {
  pauseQuestion: PauseQuestion
  submitting:    boolean
  error:         string
  onSubmit:      (answer: string) => void
}) {
  const inputType = pauseQuestion.inputType ?? 'select'

  const [selected, setSelected] = useState('')
  const [multi,    setMulti]    = useState<string[]>([])
  const [text,     setText]     = useState('')

  const answerValue =
    inputType === 'multiselect' ? multi.join(',')
    : inputType === 'text'      ? text.trim()
    : selected

  const hasAnswer = answerValue.length > 0

  function toggleMulti(value: string) {
    setMulti((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  return (
    <>
      {inputType === 'text' && (
        <div className="mb-5">
          <input
            type="text"
            value={text}
            disabled={submitting}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer…"
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-800 focus:border-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:opacity-60"
          />
        </div>
      )}

      {inputType !== 'text' && (
        <div className="mb-5 space-y-2.5">
          {pauseQuestion.options.map((opt) => {
            const active =
              inputType === 'multiselect' ? multi.includes(opt.value) : selected === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                disabled={submitting}
                onClick={() =>
                  inputType === 'multiselect' ? toggleMulti(opt.value) : setSelected(opt.value)
                }
                className={cn(
                  'w-full rounded-xl border px-4 py-3 text-left transition-all',
                  'hover:border-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900',
                  active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-800',
                  submitting && 'cursor-not-allowed opacity-60',
                )}
              >
                <span className="flex items-center gap-2 font-medium leading-snug">
                  {inputType === 'multiselect' && (
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]',
                        active ? 'border-white bg-white text-zinc-900' : 'border-zinc-300',
                      )}
                    >
                      {active ? '✓' : ''}
                    </span>
                  )}
                  {opt.label}
                </span>
                {opt.description && (
                  <span className={cn('mt-0.5 block text-xs', active ? 'text-zinc-300' : 'text-zinc-400')}>
                    {opt.description}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={submitting}
          onClick={() => onSubmit(pauseQuestion.defaultValue)}
          className="text-sm text-zinc-400 hover:text-zinc-600 disabled:cursor-not-allowed"
        >
          Skip — use AI default
        </button>

        <button
          type="button"
          disabled={!hasAnswer || submitting}
          onClick={() => onSubmit(answerValue)}
          className={cn(
            'rounded-lg px-5 py-2 text-sm font-semibold transition-colors',
            hasAnswer && !submitting
              ? 'bg-zinc-900 text-white hover:bg-zinc-700'
              : 'cursor-not-allowed bg-zinc-100 text-zinc-400',
          )}
        >
          {submitting ? 'Resuming generation…' : 'Continue generation →'}
        </button>
      </div>
    </>
  )
}

// ── Multi-question pause (e.g. §20 compliance) ────────────────────────────────

function MultiQuestionBody({
  questions,
  submitting,
  error,
  onSubmit,
}: {
  questions:  PauseSubQuestion[]
  submitting: boolean
  error:      string
  onSubmit:   (answers: Record<string, string>) => void
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})

  function set(field: string, value: string) {
    setAnswers((prev) => ({ ...prev, [field]: value }))
  }

  const allAnswered = questions.every((q) => (answers[q.field] ?? '').trim().length > 0)

  // Skip fills every field with its AI default so generation never stalls.
  function skip() {
    const defaults: Record<string, string> = {}
    for (const q of questions) defaults[q.field] = q.defaultValue
    onSubmit(defaults)
  }

  return (
    <>
      <div className="mb-5 space-y-5">
        {questions.map((q) => (
          <div key={q.field}>
            <p className="mb-2 text-sm font-medium text-zinc-800">{q.question}</p>

            {q.inputType === 'text' ? (
              <input
                type="text"
                value={answers[q.field] ?? ''}
                disabled={submitting}
                onChange={(e) => set(q.field, e.target.value)}
                placeholder="Type your answer…"
                className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-800 focus:border-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:opacity-60"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const active = answers[q.field] === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={submitting}
                      onClick={() => set(q.field, opt.value)}
                      title={opt.description || undefined}
                      className={cn(
                        'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                        'hover:border-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900',
                        active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-800',
                        submitting && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={submitting}
          onClick={skip}
          className="text-sm text-zinc-400 hover:text-zinc-600 disabled:cursor-not-allowed"
        >
          Skip — use AI defaults
        </button>

        <button
          type="button"
          disabled={!allAnswered || submitting}
          onClick={() => onSubmit(answers)}
          className={cn(
            'rounded-lg px-5 py-2 text-sm font-semibold transition-colors',
            allAnswered && !submitting
              ? 'bg-zinc-900 text-white hover:bg-zinc-700'
              : 'cursor-not-allowed bg-zinc-100 text-zinc-400',
          )}
        >
          {submitting ? 'Resuming generation…' : 'Continue generation →'}
        </button>
      </div>
    </>
  )
}
