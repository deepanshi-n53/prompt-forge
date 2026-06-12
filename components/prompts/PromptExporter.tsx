'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { trackClientEvent } from '@/lib/analytics'
import { buildUiContextBlock } from '@/lib/export/context-builder'
import type { FullPrompt } from '@/app/(app)/project/[id]/prompts/_components/PromptBrowser'
import type { ProjectMeta } from '@/lib/export/context-builder'
import type { ParsedBRD } from '@/types/brd'

// ── Agent tab definitions ─────────────────────────────────────────────────────

type AgentId = 'claude-code' | 'cursor' | 'lovable'

interface AgentDef {
  id:          AgentId
  label:       string
  description: string
  uiOnly:      boolean
}

const AGENTS: AgentDef[] = [
  { id: 'claude-code', label: 'Claude Code', description: 'CLI / VS Code',   uiOnly: false },
  { id: 'cursor',      label: 'Cursor',      description: 'IDE context',      uiOnly: false },
  { id: 'lovable',     label: 'Lovable / Bolt', description: 'UI only',      uiOnly: true  },
]

// ── Section order guide data ──────────────────────────────────────────────────

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

// ── Format helpers ────────────────────────────────────────────────────────────

function formatForClaude(
  projectName: string,
  sectionNum: string,
  sectionName: string,
  contextBlock: string,
  content: string,
): string {
  return `# PromptForge — ${projectName}
# Section §${sectionNum} — ${sectionName}

${contextBlock}

---

${content}`
}

function formatForCursor(
  projectName: string,
  sectionNum: string,
  sectionName: string,
  contextBlock: string,
  content: string,
): string {
  return `@codebase @prisma/schema.prisma

I'm building ${projectName}. Implement Section §${sectionNum} — ${sectionName}.

${contextBlock}

---

${content}

Follow existing patterns in @app/api/`
}

function formatForLovable(
  projectName: string,
  sectionNum: string,
  sectionName: string,
  uiContextBlock: string,
  content: string,
): string {
  return `I'm building ${projectName}.

${uiContextBlock}

---

${content}

> Note: Use for UI components and pages only. Use Claude Code for all backend sections.`
}

function buildAllMarkdown(
  projectName: string,
  sections: FullPrompt[],
  contextBlock: string,
): string {
  const header = `# PromptForge Architecture — ${projectName}\n\n${contextBlock}\n\n---\n\n`
  const body   = sections
    .map((s) => `# §${s.sectionNum} — ${s.sectionName}\n\n${s.content}`)
    .join('\n\n---\n\n')
  return header + body
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CopyButton({
  text,
  projectId,
  sectionNum,
  agent,
}: {
  text:       string
  projectId:  string
  sectionNum: string
  agent:      AgentId
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    trackClientEvent('prompt_exported', {
      projectId,
      sectionNum,
      format: 'copy',
      agent,
    })
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
        copied
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
      )}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function OrderGuide({ track }: { track: string }) {
  const guide = ORDER_GUIDE[track] ?? ORDER_GUIDE.FULL
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Run sections in this order for best results ({track} track).
      </p>
      {guide.map((week) => (
        <div key={week.week}>
          <p className="mb-1 text-xs font-semibold text-zinc-700">
            Week {week.week} — {week.focus}
          </p>
          <div className="flex flex-wrap gap-1">
            {week.sections.map((n) => (
              <span
                key={n}
                className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600"
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

// ── Main export modal ─────────────────────────────────────────────────────────

export interface PromptExporterProps {
  open:           boolean
  onClose:        () => void
  projectId:      string
  project:        ProjectMeta
  parsedBRD:      ParsedBRD
  contextBlock:   string
  sectionNum:     string
  sectionName:    string
  content:        string
  allSections:    FullPrompt[]
  onFetchAll:     () => Promise<FullPrompt[]>
  track:          string
}

export function PromptExporter({
  open,
  onClose,
  projectId,
  project,
  parsedBRD,
  contextBlock,
  sectionNum,
  sectionName,
  content,
  allSections,
  onFetchAll,
  track,
}: PromptExporterProps) {
  const [activeAgent,   setActiveAgent]   = useState<AgentId>('claude-code')
  const [showGuide,     setShowGuide]     = useState(false)
  const [fetchingAll,   setFetchingAll]   = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  if (!open) return null

  const uiContextBlock = buildUiContextBlock(project, parsedBRD)

  const formatted: Record<AgentId, string> = {
    'claude-code': formatForClaude(project.name, sectionNum, sectionName, contextBlock, content),
    'cursor':      formatForCursor(project.name, sectionNum, sectionName, contextBlock, content),
    'lovable':     formatForLovable(project.name, sectionNum, sectionName, uiContextBlock, content),
  }

  const activeText = formatted[activeAgent]
  const charCount  = activeText.length

  async function handleExportAll() {
    setFetchingAll(true)
    try {
      const sections = allSections.length > 0 ? allSections : await onFetchAll()
      const md = buildAllMarkdown(project.name, sections, contextBlock)
      downloadText(md, `${project.name.toLowerCase().replace(/\s+/g, '-')}-architecture.md`)
      trackClientEvent('prompt_exported', {
        projectId,
        sectionNum: 'all',
        format:     'download',
        agent:      'markdown',
      })
    } finally {
      setFetchingAll(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden"
           style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        {/* header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              Export §{sectionNum} — {sectionName}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">{project.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-lg leading-none">×</button>
        </div>

        {/* agent tabs */}
        <div className="flex border-b border-zinc-100 px-5">
          {AGENTS.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setActiveAgent(agent.id)}
              className={cn(
                'mr-4 border-b-2 pb-3 pt-3 text-xs font-medium transition-colors',
                activeAgent === agent.id
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-transparent text-zinc-400 hover:text-zinc-600',
              )}
            >
              {agent.label}
              <span className="ml-1 text-zinc-400 font-normal">{agent.description}</span>
            </button>
          ))}
        </div>

        {/* ui-only notice */}
        {AGENTS.find((a) => a.id === activeAgent)?.uiOnly && (
          <div className="bg-amber-50 px-5 py-2 text-xs text-amber-700">
            Use for UI components and pages only. Use Claude Code for backend sections.
          </div>
        )}

        {/* textarea */}
        <div className="relative flex-1 overflow-hidden p-5" style={{ minHeight: 0 }}>
          <textarea
            ref={textareaRef}
            readOnly
            value={activeText}
            className="h-full w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-[12px] leading-relaxed text-zinc-800 focus:outline-none"
            style={{ minHeight: '240px', maxHeight: '360px' }}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              {charCount.toLocaleString()} characters
            </span>
            <CopyButton
              text={activeText}
              projectId={projectId}
              sectionNum={sectionNum}
              agent={activeAgent}
            />
          </div>
        </div>

        {/* footer actions */}
        <div className="border-t border-zinc-100 px-5 py-3 space-y-3">
          {/* export all + guide toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportAll}
              disabled={fetchingAll}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
            >
              {fetchingAll ? 'Fetching…' : `Export All Sections ↓`}
            </button>
            <button
              onClick={() => setShowGuide((v) => !v)}
              className="text-xs text-zinc-400 hover:text-zinc-600"
            >
              {showGuide ? 'Hide guide' : 'Show run order →'}
            </button>
          </div>

          {/* section order guide */}
          {showGuide && (
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Section Run Order — {track} Track
              </p>
              <OrderGuide track={track} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
