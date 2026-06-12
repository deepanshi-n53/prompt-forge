'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useJobProgress } from '@/hooks/useJobProgress'
import { JobProgressBar } from '@/components/shared/JobProgressBar'
import type { ChangeAnalysis, SectionImpact } from '@/types/decision'

// ── Serialisable event shape ──────────────────────────────────────────────────

export interface ChangeEventData {
  id:             string
  projectId:      string
  oldBrdId:       string
  newBrdId:       string
  status:         string // 'PENDING' | 'APPLIED' | 'DISMISSED'
  changeAnalysis: ChangeAnalysis
  appliedAt:      string | null
  createdAt:      string
}

interface Props {
  projectId:   string
  projectName: string
  events:      ChangeEventData[]
}

// ── Impact level badge ────────────────────────────────────────────────────────

function ImpactBadge({ level }: { level: SectionImpact['impactLevel'] }) {
  const cls =
    level === 'BREAKING'
      ? 'bg-red-50 text-red-700 border-red-200'
      : level === 'REVIEW'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-green-50 text-green-700 border-green-200'
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {level}
    </span>
  )
}

// ── Impact analysis panel ─────────────────────────────────────────────────────

function ImpactPanel({
  analysis,
  onApply,
  applying,
}: {
  analysis:  ChangeAnalysis
  onApply:   () => void
  applying:  boolean
}) {
  const [showSafe, setShowSafe] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const breaking = analysis.impactedSections.filter((s) => s.impactLevel === 'BREAKING')
  const review   = analysis.impactedSections.filter((s) => s.impactLevel === 'REVIEW')
  const safe     = analysis.impactedSections.filter((s) => s.impactLevel === 'SAFE')

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-semibold text-zinc-900">What changed</h3>
        <p className="text-sm text-zinc-600">{analysis.summary}</p>
        {analysis.changedAreas.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {analysis.changedAreas.map((area) => (
              <span
                key={area}
                className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600"
              >
                {area}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* BREAKING sections */}
      {breaking.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-red-600">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            {breaking.length} Breaking — must regenerate
          </h4>
          {breaking.map((s) => (
            <SectionRow key={s.sectionNum} section={s} />
          ))}
        </div>
      )}

      {/* REVIEW sections */}
      {review.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-600">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            {review.length} Review — check after applying
          </h4>
          {review.map((s) => (
            <SectionRow key={s.sectionNum} section={s} />
          ))}
        </div>
      )}

      {/* SAFE sections (collapsed) */}
      {safe.length > 0 && (
        <div>
          <button
            onClick={() => setShowSafe((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
            {safe.length} Safe — no changes needed
            <span className="ml-1">{showSafe ? '▲' : '▼'}</span>
          </button>
          {showSafe && (
            <div className="mt-2 space-y-2">
              {safe.map((s) => (
                <SectionRow key={s.sectionNum} section={s} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Apply button */}
      <div className="border-t border-zinc-100 pt-4">
        {!confirmed ? (
          <button
            onClick={() => setConfirmed(true)}
            disabled={applying || breaking.length === 0}
            className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Generate Delta Prompts
            {breaking.length > 0 && (
              <span className="ml-2 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
                {breaking.length} section{breaking.length !== 1 ? 's' : ''}
              </span>
            )}
          </button>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-sm font-medium text-amber-800">
              Regenerate {breaking.length} breaking section{breaking.length !== 1 ? 's' : ''}?
            </p>
            <p className="text-xs text-amber-700">
              This will replace the current content for those sections. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onApply}
                disabled={applying}
                className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
              >
                {applying ? 'Applying…' : 'Confirm & apply'}
              </button>
              <button
                onClick={() => setConfirmed(false)}
                className="rounded-lg border border-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionRow({ section }: { section: SectionImpact }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3.5 py-3">
      <span className="shrink-0 rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600">
        §{section.sectionNum}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-800">{section.sectionName}</span>
          <ImpactBadge level={section.impactLevel} />
        </div>
        {section.reason && (
          <p className="mt-0.5 text-xs text-zinc-500">{section.reason}</p>
        )}
      </div>
    </div>
  )
}

// ── History card ──────────────────────────────────────────────────────────────

function HistoryCard({ event }: { event: ChangeEventData }) {
  const analysis = event.changeAnalysis
  const hasAnalysis = Boolean(analysis?.summary)

  const breaking = (analysis?.impactedSections ?? []).filter(
    (s) => s.impactLevel === 'BREAKING',
  ).length
  const review = (analysis?.impactedSections ?? []).filter(
    (s) => s.impactLevel === 'REVIEW',
  ).length

  const statusCls =
    event.status === 'APPLIED'
      ? 'bg-green-50 text-green-700 border-green-200'
      : event.status === 'DISMISSED'
        ? 'bg-zinc-100 text-zinc-500 border-zinc-200'
        : 'bg-amber-50 text-amber-700 border-amber-200'

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {hasAnalysis ? (
            <p className="text-sm text-zinc-700">{analysis.summary}</p>
          ) : (
            <p className="text-sm text-zinc-400 italic">Analysis in progress…</p>
          )}
          {hasAnalysis && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {breaking > 0 && (
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600">
                  {breaking} breaking
                </span>
              )}
              {review > 0 && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
                  {review} review
                </span>
              )}
              {analysis.changedAreas?.map((a) => (
                <span key={a} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusCls}`}>
            {event.status}
          </span>
          <span className="text-[11px] text-zinc-400">
            {new Date(event.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Upload button ─────────────────────────────────────────────────────────────

function UploadSection({
  projectId,
  onUploading,
  onUploadDone,
  onError,
}: {
  projectId:    string
  onUploading:  () => void
  onUploadDone: () => void
  onError:      (msg: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    onUploading()
    try {
      const form = new FormData()
      form.append('file',      file)
      form.append('projectId', projectId)

      const res = await fetch('/api/changes/detect', { method: 'POST', body: form })
      if (!res.ok) {
        const { error } = (await res.json()) as { error: string }
        onError(error ?? 'Upload failed')
        return
      }
      onUploadDone()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 py-14 text-center">
      <p className="mb-1 text-sm font-medium text-zinc-700">Upload an updated BRD</p>
      <p className="mb-4 text-xs text-zinc-400">
        PromptForge will analyse what changed and only regenerate affected sections.
      </p>
      <button
        onClick={() => inputRef.current?.click()}
        className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
      >
        Choose updated BRD
      </button>
      <p className="mt-3 text-xs text-zinc-400">PDF, DOCX, or TXT · max 50 MB</p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Mode = 'idle' | 'detecting' | 'applying'

export function ChangeManagement({ projectId, projectName: _projectName, events }: Props) {
  const router  = useRouter()
  const [mode,    setMode]    = useState<Mode>('idle')
  const [applying, setApplying] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // Determine if there is a pending event with analysis ready to review
  const pendingEvent = events.find((e) => e.status === 'PENDING')
  const hasAnalysis  = Boolean(pendingEvent?.changeAnalysis?.summary)

  // Whether to track SSE: during detection or applying
  const trackJobId = mode === 'detecting' || applying ? projectId : null
  const progress   = useJobProgress(trackJobId)

  // React to job completion
  const prevStatusRef = useRef<string>('')
  useEffect(() => {
    if (progress.status === prevStatusRef.current) return
    prevStatusRef.current = progress.status

    if (progress.status === 'complete') {
      setMode('idle')
      setApplying(false)
      setError(null)
      router.refresh()
    }
    if (progress.status === 'failed') {
      setMode('idle')
      setApplying(false)
      setError(progress.error ?? 'An error occurred. Please try again.')
    }
  }, [progress.status, progress.error, router])

  async function handleApply(changeEventId: string) {
    setApplying(true)
    setError(null)
    try {
      const res = await fetch(`/api/changes/${changeEventId}/apply`, { method: 'POST' })
      if (!res.ok) {
        const { error: msg } = (await res.json()) as { error: string }
        setError(msg ?? 'Failed to start delta generation')
        setApplying(false)
      }
      // On success: SSE via useJobProgress(projectId) tracks progress
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start delta generation')
      setApplying(false)
    }
  }

  const pastEvents = events.filter((e) => e.status !== 'PENDING')

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-8">
      {/* error banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-red-500 hover:text-red-700">
            ✕
          </button>
        </div>
      )}

      {/* ── Detecting in progress ─────────────────────────────────────── */}
      {mode === 'detecting' && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-900">Analysing changes…</h2>
          <JobProgressBar progress={progress} />
        </section>
      )}

      {/* ── Applying delta prompts ────────────────────────────────────── */}
      {applying && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-900">Regenerating sections…</h2>
          <JobProgressBar progress={progress} />
        </section>
      )}

      {/* ── Pending analysis ready ────────────────────────────────────── */}
      {pendingEvent && hasAnalysis && !applying && mode !== 'detecting' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Impact Analysis</h2>
            {pendingEvent.changeAnalysis.isBreaking && (
              <span className="rounded-full border border-red-200 bg-red-50 px-3 py-0.5 text-xs font-semibold text-red-700">
                Breaking changes
              </span>
            )}
          </div>
          <ImpactPanel
            analysis={pendingEvent.changeAnalysis}
            onApply={() => handleApply(pendingEvent.id)}
            applying={applying}
          />
        </section>
      )}

      {/* ── Upload new BRD (idle, no pending) ────────────────────────── */}
      {!pendingEvent && mode === 'idle' && !applying && (
        <section>
          <h2 className="mb-4 text-base font-semibold text-zinc-900">Upload Updated BRD</h2>
          <UploadSection
            projectId={projectId}
            onUploading={() => {
              setError(null)
              setMode('detecting')
            }}
            onUploadDone={() => {
              // SSE takes over from here
            }}
            onError={(msg) => {
              setMode('idle')
              setError(msg)
            }}
          />
        </section>
      )}

      {/* ── Change history ────────────────────────────────────────────── */}
      {pastEvents.length > 0 && (
        <section>
          <h2 className={cn(
            'mb-3 text-base font-semibold text-zinc-900',
            !pendingEvent && mode === 'idle' ? 'mt-2' : '',
          )}>
            Change history
          </h2>
          <div className="space-y-3">
            {pastEvents.map((e) => (
              <HistoryCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {events.length === 0 && mode === 'idle' && (
        <p className="text-center text-sm text-zinc-400">
          No change history yet. Upload an updated BRD above to begin tracking changes.
        </p>
      )}
    </div>
  )
}
