'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { trackClientEvent } from '@/lib/analytics'
import { buildContextBlock } from '@/lib/export/context-builder'
import { PromptExporter } from '@/components/prompts/PromptExporter'
import type { ProjectMeta } from '@/lib/export/context-builder'
import type { SectionDecision, Assumption } from '@/types/decision'
import type { ParsedBRD } from '@/types/brd'

// ── Public types (used by page.tsx) ──────────────────────────────────────────

export interface PromptSummary {
  id:              string
  sectionNum:      string
  sectionName:     string
  layer:           string
  status:          string
  confidence:      number | null
  assumptionCount: number
  brdVersion:      number
  updatedAt:       string | Date
}

export interface PromptLayer {
  layer:   string
  prompts: PromptSummary[]
}

export interface FullPrompt extends PromptSummary {
  content:     string
  assumptions: Assumption[]
}

interface PromptBrowserProps {
  projectId:        string
  projectMeta:      ProjectMeta
  layers:           PromptLayer[]
  track:            string
  decisionSections: Record<string, SectionDecision>
  parsedBRD:        ParsedBRD
}

// ── Layer labels / order ──────────────────────────────────────────────────────

const LAYER_LABELS: Record<string, string> = {
  foundation:     'Foundation',
  features:       'Features',
  services:       'Services',
  security:       'Security',
  infrastructure: 'Infrastructure',
}

const LAYER_ORDER = ['foundation', 'features', 'services', 'security', 'infrastructure']

// ── Micro components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'GENERATED'
      ? 'bg-green-50 text-green-700 border-green-200'
      : status === 'OUTDATED'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-zinc-100 text-zinc-500 border-zinc-200'
  const label =
    status === 'GENERATED' ? 'Ready' : status === 'OUTDATED' ? 'Outdated' : status
  return (
    <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  )
}

function ConfidenceDot({ confidence }: { confidence: number | null }) {
  const pct   = confidence ?? 0
  const color = pct >= 0.85 ? 'bg-green-400' : pct >= 0.6 ? 'bg-amber-400' : 'bg-red-400'
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />
}

// ── Section order guide ───────────────────────────────────────────────────────

const ORDER_GUIDE: Record<string, { week: number; sections: string[]; focus: string }[]> = {
  FAST: [
    { week: 1, sections: ['01', '07', '06', '08', '09'], focus: 'Foundation & Auth' },
    { week: 2, sections: ['02', '03', '04', '13', '10'], focus: 'Architecture & Data' },
    { week: 3, sections: ['12', '16', '17', '18', '20', '28'], focus: 'Services & Deploy' },
  ],
  FULL: [
    { week: 1, sections: ['01', '05', '07', '06', '08'], focus: 'Foundation & Auth' },
    { week: 2, sections: ['14', '15', '02', '03', '04'], focus: 'Architecture & Jobs' },
    { week: 3, sections: ['09', '10', '11', '12', '13'], focus: 'Core Features' },
    { week: 4, sections: ['16', '17', '18', '19', '20'], focus: 'Services & Security' },
    { week: 5, sections: ['21', '22', '24', '28'], focus: 'Testing & Deploy' },
  ],
}

function SectionOrderGuide({ track }: { track: string }) {
  const guide = ORDER_GUIDE[track] ?? ORDER_GUIDE.FULL
  return (
    <div className="border-t border-zinc-100 px-4 py-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
        Run Order — {track} Track
      </p>
      {guide.map((week) => (
        <div key={week.week}>
          <p className="mb-1.5 text-xs font-medium text-zinc-600">
            Wk {week.week} · {week.focus}
          </p>
          <div className="flex flex-wrap gap-1">
            {week.sections.map((n) => (
              <span
                key={n}
                className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500"
              >
                §{n}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PromptBrowser({
  projectId,
  projectMeta,
  layers,
  track,
  decisionSections,
  parsedBRD,
}: PromptBrowserProps) {
  const [selected,      setSelected]      = useState<string | null>(null)
  const [loadedPrompts, setLoadedPrompts] = useState<Record<string, FullPrompt>>({})
  const [loading,       setLoading]       = useState(false)
  const [copied,        setCopied]        = useState(false)
  const [exporterOpen,  setExporterOpen]  = useState(false)
  const [showGuide,     setShowGuide]     = useState(false)

  const activePrompt = selected ? loadedPrompts[selected] : null

  // Build context block once (memoized — inputs are stable server props)
  const contextBlock = useMemo(
    () => buildContextBlock(projectMeta, decisionSections, parsedBRD),
    [projectMeta, decisionSections, parsedBRD],
  )

  const sortedLayers = [...layers].sort(
    (a, b) => LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer),
  )

  const allSummaries = sortedLayers.flatMap((l) => l.prompts)
  const totalCount   = allSummaries.length

  async function selectSection(sectionNum: string) {
    setSelected(sectionNum)
    if (loadedPrompts[sectionNum]) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/prompts/${projectId}/${sectionNum}`)
      const data = (await res.json()) as FullPrompt
      setLoadedPrompts((prev) => ({ ...prev, [sectionNum]: data }))
    } finally {
      setLoading(false)
    }
  }

  async function copyRaw() {
    if (!activePrompt) return
    await navigator.clipboard.writeText(activePrompt.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    trackClientEvent('prompt_exported', {
      projectId,
      sectionNum: activePrompt.sectionNum,
      format:     'copy',
      agent:      'raw',
    })
  }

  async function fetchAllSections(): Promise<FullPrompt[]> {
    const results: FullPrompt[] = []
    for (const s of allSummaries) {
      if (loadedPrompts[s.sectionNum]) {
        results.push(loadedPrompts[s.sectionNum])
      } else {
        const res  = await fetch(`/api/prompts/${projectId}/${s.sectionNum}`)
        const data = (await res.json()) as FullPrompt
        setLoadedPrompts((prev) => ({ ...prev, [data.sectionNum]: data }))
        results.push(data)
      }
    }
    return results
  }

  return (
    <>
      <div className="flex h-full overflow-hidden">
        {/* ── left sidebar ─────────────────────────────────────────────── */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white overflow-y-auto">
          {/* sidebar header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {totalCount} sections
            </span>
            <button
              onClick={() => setShowGuide((v) => !v)}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                showGuide ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100',
              )}
            >
              {showGuide ? 'List' : 'Guide'}
            </button>
          </div>

          {showGuide ? (
            <SectionOrderGuide track={track} />
          ) : (
            <nav className="flex-1 py-2">
              {sortedLayers.map(({ layer, prompts }) => (
                <div key={layer} className="mb-1">
                  <div className="px-4 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                      {LAYER_LABELS[layer] ?? layer}
                    </span>
                  </div>
                  {prompts.map((p) => (
                    <button
                      key={p.sectionNum}
                      type="button"
                      onClick={() => selectSection(p.sectionNum)}
                      className={cn(
                        'flex w-full items-center gap-2 px-4 py-2 text-left text-xs transition-colors',
                        selected === p.sectionNum
                          ? 'bg-zinc-900 text-white'
                          : 'text-zinc-700 hover:bg-zinc-50',
                      )}
                    >
                      <ConfidenceDot confidence={p.confidence} />
                      <span className="flex-1 truncate font-medium">
                        §{p.sectionNum} {p.sectionName}
                      </span>
                      {selected !== p.sectionNum && (
                        <StatusBadge status={p.status} />
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          )}
        </aside>

        {/* ── right content pane ───────────────────────────────────────── */}
        <main className="flex flex-1 flex-col overflow-hidden bg-zinc-50">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <p className="text-sm font-medium text-zinc-700">Select a section to view</p>
              <p className="mt-1 text-xs text-zinc-400">
                {totalCount} architecture sections ready to export
              </p>
            </div>
          ) : loading ? (
            <div className="flex flex-1 items-center justify-center">
              <span className="text-sm text-zinc-400">Loading…</span>
            </div>
          ) : activePrompt ? (
            <>
              {/* content header */}
              <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-zinc-900">
                    §{activePrompt.sectionNum} — {activePrompt.sectionName}
                  </h2>
                  <div className="mt-0.5 flex items-center gap-2">
                    <StatusBadge status={activePrompt.status} />
                    {activePrompt.confidence != null && (
                      <span className="text-xs text-zinc-400">
                        {Math.round(activePrompt.confidence * 100)}% confidence
                      </span>
                    )}
                    {activePrompt.assumptionCount > 0 && (
                      <span className="text-xs text-amber-600">
                        {activePrompt.assumptionCount} assumption{activePrompt.assumptionCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-4 flex items-center gap-2">
                  {/* Raw copy */}
                  <button
                    onClick={copyRaw}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      copied
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                    )}
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                  {/* Export for agent */}
                  <button
                    onClick={() => setExporterOpen(true)}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
                  >
                    Export for agent →
                  </button>
                </div>
              </div>

              {/* content body */}
              <div className="flex-1 overflow-y-auto p-6">
                <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-zinc-800">
                  {activePrompt.content}
                </pre>

                {/* assumptions */}
                {activePrompt.assumptions.length > 0 && (
                  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700">
                      {activePrompt.assumptions.length} Assumption{activePrompt.assumptions.length !== 1 ? 's' : ''} Made
                    </p>
                    <ul className="space-y-2">
                      {activePrompt.assumptions.map((a, i) => (
                        <li key={i} className="text-xs text-amber-800">
                          <span className="font-semibold">{a.field}:</span>{' '}
                          assumed <span className="font-medium">{a.value}</span>
                          {a.reason ? ` — ${a.reason}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </main>
      </div>

      {/* ── PromptExporter modal ─────────────────────────────────────── */}
      {activePrompt && (
        <PromptExporter
          open={exporterOpen}
          onClose={() => setExporterOpen(false)}
          projectId={projectId}
          project={projectMeta}
          parsedBRD={parsedBRD}
          contextBlock={contextBlock}
          sectionNum={activePrompt.sectionNum}
          sectionName={activePrompt.sectionName}
          content={activePrompt.content}
          allSections={Object.values(loadedPrompts)}
          loadedCount={Object.keys(loadedPrompts).length}
          onFetchAll={fetchAllSections}
          track={track}
        />
      )}
    </>
  )
}
