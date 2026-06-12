'use client'

import { useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'

const CHECKLIST = [
  'BRD uploaded',
  'Architecture analyzed',
  'Prompts generated',
]

export function FirstPromptsSuccess() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="mx-6 mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
      <div className="flex items-start gap-3">
        {/* icon */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100">
          <CheckCircle2 className="size-5 text-green-600" />
        </div>

        {/* content */}
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="font-semibold text-green-900">Your first prompts are ready!</p>
            <p className="mt-0.5 text-sm text-green-700">
              55 architecture sections have been filled from your BRD.
            </p>
          </div>

          {/* checklist */}
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-center gap-1.5 text-xs font-medium text-green-700">
                <CheckCircle2 className="size-3.5 text-green-500" />
                {item}
              </li>
            ))}
          </ul>

          {/* next step */}
          <div className="rounded-lg border border-green-200 bg-white/60 px-3 py-2">
            <p className="text-xs font-semibold text-green-900">
              Next step:
            </p>
            <p className="mt-0.5 text-xs text-green-700">
              Click <strong>§01 — Product & Business Foundation</strong> below, then paste it into{' '}
              <span className="font-mono font-semibold">Claude Code</span> to start building.
            </p>
          </div>
        </div>

        {/* dismiss */}
        <button
          type="button"
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-green-500 hover:bg-green-100 hover:text-green-700 transition-colors"
          onClick={() => setDismissed(true)}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
