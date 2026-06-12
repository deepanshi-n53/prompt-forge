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

const STATUS_STYLES: Record<string, string> = {
  PROCESSING: 'bg-blue-50 text-blue-600 border-blue-200',
  PARSED:     'bg-violet-50 text-violet-600 border-violet-200',
  READY:      'bg-green-50 text-green-600 border-green-200',
  ERROR:      'bg-red-50 text-red-600 border-red-200',
  UPDATING:   'bg-amber-50 text-amber-600 border-amber-200',
}

const STATUS_LABELS: Record<string, string> = {
  PROCESSING: 'Processing',
  PARSED:     'Parsed',
  READY:      'Ready',
  ERROR:      'Error',
  UPDATING:   'Updating',
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
  const statusStyle = STATUS_STYLES[project.status] ?? STATUS_STYLES.PROCESSING
  const statusLabel = STATUS_LABELS[project.status] ?? project.status

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
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyle}`}>
              {statusLabel}
            </span>
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

      {/* actions */}
      <div className="mt-4 flex items-center gap-2">
        <Link
          href={`/project/${project.id}`}
          className={cn(buttonVariants({ size: 'sm' }), 'flex-1 text-center')}
        >
          Open
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
