'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BRDUploader } from './BRDUploader'

// ── Step indicator ────────────────────────────────────────────────────────────

const FLOW_STEPS = [
  { label: 'Upload BRD' },
  { label: 'Answer 5 questions' },
  { label: 'Get prompts' },
]

function FlowIndicator({ active }: { active: 0 | 1 | 2 }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {FLOW_STEPS.map(({ label }, i) => {
        const done   = i < active
        const isActive = i === active
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  done     ? 'bg-green-500 text-white'
                  : isActive ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : 'bg-zinc-100 text-zinc-400',
                ].join(' ')}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                className={[
                  'text-[11px] font-medium whitespace-nowrap',
                  isActive ? 'text-blue-700' : done ? 'text-green-600' : 'text-zinc-400',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
            {i < FLOW_STEPS.length - 1 && (
              <div
                className={[
                  'mb-5 mx-3 h-px w-10 shrink-0 transition-colors',
                  done ? 'bg-green-300' : 'bg-zinc-200',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ProjectEmptyStateProps {
  projectId:     string
  projectStatus: string
}

export function ProjectEmptyState({ projectId, projectStatus }: ProjectEmptyStateProps) {
  const router   = useRouter()
  const [show, setShow] = useState(false)

  const isProcessing = projectStatus === 'PROCESSING'

  function onProcessing(jobId: string) {
    router.push(`/project/${projectId}/generating?jobId=${jobId}`)
  }

  return (
    <div className="space-y-8">
      {/* flow step indicator — step 1 (Upload BRD) is active */}
      <FlowIndicator active={isProcessing ? 1 : 0} />

      {/* upload area */}
      {isProcessing ? (
        <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50 p-8 text-center">
          <p className="text-sm font-medium text-blue-700 animate-pulse">
            Analysing your BRD…
          </p>
          <p className="mt-1 text-xs text-blue-500">
            This usually takes 20–40 seconds.
          </p>
        </div>
      ) : show ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-700">
            Drag &amp; drop your BRD or browse:
          </p>
          <BRDUploader projectId={projectId} onProcessing={onProcessing} />
          <button
            type="button"
            className="text-xs text-zinc-400 underline underline-offset-4 hover:text-zinc-600"
            onClick={() => setShow(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
            <svg className="size-6 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-zinc-900">Upload your BRD</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              PDF, Word, or plain text · max 50 MB
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            onClick={() => setShow(true)}
          >
            Upload BRD
          </button>
        </div>
      )}
    </div>
  )
}
