'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

// ── types ─────────────────────────────────────────────────────────────────────

export interface ProjectSummary {
  id: string
  name: string
  description: string | null
  status: string
  archetype: string | null
  archetypeConfidence: number | null
  track: string
  updatedAt: string | Date
  promptCount: number
  latestBrd: { id: string; healthScore: number | null; status: string } | null
}

// ── mini health dial ──────────────────────────────────────────────────────────

function MiniDial({ score }: { score: number }) {
  const r = 16
  const circ = 2 * Math.PI * r
  const color = score <= 40 ? '#ef4444' : score <= 70 ? '#f59e0b' : '#22c55e'

  return (
    <div className="relative flex items-center justify-center" style={{ width: 44, height: 44 }}>
      <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx="22" cy="22" r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - score / 100)}
        />
      </svg>
      <span
        className="absolute text-xs font-bold tabular-nums"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  )
}

// ── status badge ──────────────────────────────────────────────────────────────

interface StatusMeta {
  dot:   string
  text:  (p: ProjectSummary) => string
  pulse: boolean
  href:  (id: string) => string
}

// One entry per ProjectStatus. NOTE: the Prisma `ProjectStatus` enum currently has
// no `PARSING` member — PROCESSING covers both "analysing the BRD" and "generating
// prompts". PARSING is kept here for forward-compatibility only; it is never emitted
// today, so a freshly-uploaded project shows "Generating…" while it is being parsed.
const STATUS_META: Record<string, StatusMeta> = {
  PROCESSING: { dot: 'bg-amber-500', pulse: true,  text: () => 'Generating…',                                                   href: (id) => `/project/${id}/generating?jobId=${id}` },
  PARSING:    { dot: 'bg-amber-500', pulse: true,  text: () => 'Analysing BRD…',                                                href: (id) => `/project/${id}` },
  UPDATING:   { dot: 'bg-amber-500', pulse: true,  text: () => 'Updating…',                                                     href: (id) => `/project/${id}/generating?jobId=${id}` },
  READY:      { dot: 'bg-green-500', pulse: false, text: (p) => `${p.promptCount} section${p.promptCount !== 1 ? 's' : ''} ready`, href: (id) => `/project/${id}/prompts` },
  PARSED:     { dot: 'bg-blue-500',  pulse: false, text: () => 'Ready to setup',                                                href: (id) => `/project/${id}/setup` },
  ERROR:      { dot: 'bg-red-500',   pulse: false, text: () => 'Generation failed',                                            href: (id) => `/project/${id}/setup` },
}

function metaFor(project: ProjectSummary): StatusMeta {
  return STATUS_META[project.status] ?? STATUS_META.PROCESSING
}

function StatusIndicator({ project }: { project: ProjectSummary }) {
  const meta = metaFor(project)
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600">
      <span
        className={cn('inline-flex h-2 w-2 rounded-full', meta.dot, meta.pulse && 'animate-pulse-dot')}
      />
      {meta.text(project)}
    </span>
  )
}

// ── card ──────────────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: ProjectSummary
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const healthScore = project.latestBrd?.healthScore ?? null
  const meta         = metaFor(project)
  const primaryHref  = meta.href(project.id)
  const primaryLabel =
    project.status === 'PROCESSING' || project.status === 'UPDATING' ? 'View progress'
    : project.status === 'READY' ? 'Open prompts'
    : project.status === 'ERROR' ? 'Retry'
    : project.status === 'PARSED' ? 'Start setup'
    : 'Open'

  const updatedAt = new Date(project.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      if (res.ok) {
        setDialogOpen(false)
        router.refresh()
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="group relative flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      {/* whole-card link — status-aware destination. Sits behind interactive
          children (actions row is z-10), so Delete/buttons still work. */}
      <Link
        href={primaryHref}
        aria-label={`Open ${project.name}`}
        className="absolute inset-0 z-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
      />

      {/* header */}
      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusIndicator project={project} />
            {project.archetype && (
              <Badge variant="outline" className="capitalize">
                {project.archetype.replace(/-/g, ' ')}
              </Badge>
            )}
          </div>
          <h3 className="mt-2 truncate text-base font-semibold text-zinc-900">{project.name}</h3>
          {project.description && (
            <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{project.description}</p>
          )}
        </div>

        {healthScore !== null && <MiniDial score={healthScore} />}
      </div>

      {/* meta */}
      <div className="mt-4 flex items-center gap-4 text-xs text-zinc-400">
        <span>{project.promptCount} prompt{project.promptCount !== 1 ? 's' : ''}</span>
        <span>Updated {updatedAt}</span>
      </div>

      {/* actions — above the whole-card overlay link so they stay clickable */}
      <div className="relative z-10 mt-4 flex items-center gap-2">
        <Link
          href={primaryHref}
          className={cn(buttonVariants({ size: 'sm' }), 'flex-1 text-center')}
        >
          {primaryLabel}
        </Link>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" />
            }
          >
            Delete
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete project?</DialogTitle>
              <DialogDescription>
                This will permanently delete <strong>{project.name}</strong> and all associated
                BRDs, prompts, and decisions. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
