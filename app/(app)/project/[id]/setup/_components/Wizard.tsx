'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

// ── question definitions ──────────────────────────────────────────────────────

interface Option {
  value: string
  label: string
  description: string
}

interface Question {
  id: 'q1' | 'q2' | 'q3' | 'q4' | 'q5'
  title: string
  subtitle: string
  defaultValue: string
  multiSelect: boolean
  options: Option[]
}

const QUESTIONS: Question[] = [
  {
    id: 'q1',
    title: 'How does your product make money?',
    subtitle: 'Shapes §17 billing architecture',
    defaultValue: 'Monthly subscription',
    multiSelect: false,
    options: [
      { value: 'Per-transaction fee %',  label: 'Per-transaction fee',    description: 'Charge a % on each transaction processed' },
      { value: 'Monthly subscription',   label: 'Monthly subscription',   description: 'Recurring billing, cancel any time' },
      { value: 'Annual subscription',    label: 'Annual subscription',    description: 'Yearly billing with upfront discount' },
      { value: 'Freemium',               label: 'Freemium',               description: 'Free tier with paid upgrades' },
      { value: 'Not yet decided',        label: 'Not yet decided',        description: "We'll use a sensible default for now" },
    ],
  },
  {
    id: 'q2',
    title: 'Where are you launching first?',
    subtitle: 'Shapes §20 compliance (GDPR if EU) and CDN regions',
    defaultValue: 'Single country',
    multiSelect: false,
    options: [
      { value: 'Single city/region',       label: 'Single city / region',      description: 'Launch in one metro area or region' },
      { value: 'Single country',           label: 'Single country',             description: 'One country only at launch' },
      { value: 'Multiple countries',       label: 'Multiple countries',         description: 'Several countries from day 1' },
      { value: 'Global from day 1',        label: 'Global from day 1',          description: 'No geographic restriction at launch' },
    ],
  },
  {
    id: 'q3',
    title: 'When do you need to launch?',
    subtitle: 'Under 4 weeks → Fast Track (essentials only). Otherwise → Full Track (all 55 prompts)',
    defaultValue: '3-6 months',
    multiSelect: false,
    options: [
      { value: 'Under 4 weeks',   label: 'Under 4 weeks',   description: 'Fast Track — stripped-down essentials' },
      { value: '1-2 months',      label: '1–2 months',      description: 'Full Track, compressed scope' },
      { value: '3-6 months',      label: '3–6 months',      description: 'Full Track, comfortable timeline' },
      { value: '6+ months',       label: '6+ months',       description: 'Full Track, plenty of runway' },
    ],
  },
  {
    id: 'q4',
    title: 'Does your app handle sensitive data?',
    subtitle: 'Shapes §18 security level and §20 compliance tier — select all that apply',
    defaultValue: 'None',
    multiSelect: true,
    options: [
      { value: 'Health/medical',       label: 'Health / medical records',   description: 'Patient data, diagnostics, prescriptions' },
      { value: 'Financial records',    label: 'Financial records',          description: 'Bank accounts, transactions, tax data' },
      { value: 'Children under 13',    label: 'Children under 13',          description: 'Data from users who may be minors' },
      { value: 'Location tracking',    label: 'Precise location tracking',  description: 'Real-time or stored GPS/location data' },
      { value: 'None',                 label: 'None of the above',          description: "Standard sensitivity — no special requirements" },
    ],
  },
  {
    id: 'q5',
    title: 'How many users in year one?',
    subtitle: 'Shapes §03 NFRs and infrastructure sizing',
    defaultValue: '1,000-10,000',
    multiSelect: false,
    options: [
      { value: 'Under 1,000',       label: 'Under 1,000',        description: 'Early access / niche product' },
      { value: '1,000-10,000',      label: '1,000 – 10,000',     description: 'Small but growing user base' },
      { value: '10,000-100,000',    label: '10,000 – 100,000',   description: 'Growth-stage product' },
      { value: '100,000+',          label: '100,000+',           description: 'Scale from launch' },
      { value: 'No idea',           label: 'No idea',            description: "We'll default to mid-tier infra" },
    ],
  },
]

// ── wizard component ──────────────────────────────────────────────────────────

interface WizardProps {
  projectId: string
  projectName: string
}

export function Wizard({ projectId, projectName }: WizardProps) {
  const router = useRouter()
  const [step, setStep]         = useState(0)
  const [answers, setAnswers]   = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')

  const q         = QUESTIONS[step]
  const current   = answers[q.id] ?? ''
  const totalSteps = QUESTIONS.length

  function isSelected(value: string) {
    if (!q.multiSelect) return current === value
    return current.split(',').filter(Boolean).includes(value)
  }

  function toggle(value: string) {
    if (!q.multiSelect) {
      setAnswers((prev) => ({ ...prev, [q.id]: value }))
      return
    }
    // Multi-select
    const arr = current.split(',').filter(Boolean)
    if (value === 'None') {
      setAnswers((prev) => ({ ...prev, [q.id]: 'None' }))
      return
    }
    const next = arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr.filter((v) => v !== 'None'), value]
    setAnswers((prev) => ({ ...prev, [q.id]: next.join(',') }))
  }

  function canAdvance() {
    return current !== ''
  }

  function skip() {
    setAnswers((prev) => ({ ...prev, [q.id]: q.defaultValue }))
    advance()
  }

  function advance() {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1)
    } else {
      submit()
    }
  }

  async function submit() {
    setSubmitting(true)
    setError('')

    const payload: Record<string, string> = {}
    for (const question of QUESTIONS) {
      payload[question.id] = answers[question.id] ?? question.defaultValue
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = (await res.json()) as { jobId?: string; error?: string }

      if (!res.ok) {
        setError(data.error ?? 'Failed to save answers.')
        setSubmitting(false)
        return
      }

      router.push(`/project/${projectId}/generating?jobId=${data.jobId ?? projectId}`)
    } catch {
      setError('Network error — please try again.')
      setSubmitting(false)
    }
  }

  const isLast = step === totalSteps - 1

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        {/* project name */}
        <p className="mb-6 text-center text-sm text-zinc-400">{projectName}</p>

        {/* progress bar */}
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
            <span>Question {step + 1} of {totalSteps}</span>
            <span>{Math.round(((step + 1) / totalSteps) * 100)}% complete</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-100">
            <div
              className="h-1.5 rounded-full bg-zinc-900 transition-all duration-500"
              style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* question */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-zinc-900">{q.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{q.subtitle}</p>
        </div>

        {/* options */}
        <div className="mb-6 space-y-2.5">
          {q.options.map((opt) => {
            const selected = isSelected(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className={cn(
                  'w-full rounded-xl border px-4 py-3.5 text-left transition-all',
                  'hover:border-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900',
                  selected
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-800',
                )}
              >
                <span className="block font-medium leading-snug">{opt.label}</span>
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
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="text-sm text-zinc-500 hover:text-zinc-700"
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={skip}
              className="text-sm text-zinc-400 hover:text-zinc-600"
            >
              Skip (use default)
            </button>
          </div>

          <button
            type="button"
            onClick={advance}
            disabled={!canAdvance() || submitting}
            className={cn(
              'rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors',
              canAdvance() && !submitting
                ? 'bg-zinc-900 text-white hover:bg-zinc-700'
                : 'cursor-not-allowed bg-zinc-100 text-zinc-400',
            )}
          >
            {submitting ? 'Saving…' : isLast ? 'Generate prompts →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
