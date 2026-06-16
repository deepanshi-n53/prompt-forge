'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { PauseQuestion } from '@/types/api'

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
  const [selected,    setSelected]    = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')

  async function submit(value: string) {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/pause-answer`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ field: pauseQuestion.field, answer: value }),
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

  async function skipWithDefault() {
    await submit(pauseQuestion.defaultValue)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
        {/* header */}
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">⏸</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              One quick question · §{pauseQuestion.sectionNum}
            </span>
          </div>
          <h2 className="text-lg font-bold text-zinc-900">{pauseQuestion.question}</h2>
          {pauseQuestion.subtitle && (
            <p className="mt-1 text-sm text-zinc-500">{pauseQuestion.subtitle}</p>
          )}
        </div>

        {/* options */}
        <div className="mb-5 space-y-2.5">
          {pauseQuestion.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={submitting}
              onClick={() => setSelected(opt.value)}
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-left transition-all',
                'hover:border-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900',
                selected === opt.value
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-800',
                submitting && 'cursor-not-allowed opacity-60',
              )}
            >
              <span className="block font-medium leading-snug">{opt.label}</span>
              <span className={cn('mt-0.5 block text-xs', selected === opt.value ? 'text-zinc-300' : 'text-zinc-400')}>
                {opt.description}
              </span>
            </button>
          ))}
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {/* actions */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={skipWithDefault}
            className="text-sm text-zinc-400 hover:text-zinc-600 disabled:cursor-not-allowed"
          >
            Skip — use AI default
          </button>

          <button
            type="button"
            disabled={!selected || submitting}
            onClick={() => void submit(selected)}
            className={cn(
              'rounded-lg px-5 py-2 text-sm font-semibold transition-colors',
              selected && !submitting
                ? 'bg-zinc-900 text-white hover:bg-zinc-700'
                : 'cursor-not-allowed bg-zinc-100 text-zinc-400',
            )}
          >
            {submitting ? 'Resuming generation…' : 'Answer and continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}
