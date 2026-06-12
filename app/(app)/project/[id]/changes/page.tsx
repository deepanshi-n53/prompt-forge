import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { ChangeManagement } from './_components/ChangeManagement'
import type { ChangeAnalysis } from '@/types/decision'

export default async function ChangesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireAuth()
  const { id } = await params

  const project = await db.project.findFirst({
    where:  { id, ownerId: user.id },
    select: { id: true, name: true, status: true, track: true },
  })
  if (!project) notFound()

  const rawEvents = await db.changeEvent.findMany({
    where:   { projectId: id },
    orderBy: { createdAt: 'desc' },
    take:    20,
  })

  const events = rawEvents.map((e) => ({
    id:             e.id,
    projectId:      e.projectId,
    oldBrdId:       e.oldBrdId,
    newBrdId:       e.newBrdId,
    status:         e.status as string,
    changeAnalysis: (e.changeAnalysis ?? {}) as unknown as ChangeAnalysis,
    appliedAt:      e.appliedAt?.toISOString() ?? null,
    createdAt:      e.createdAt.toISOString(),
  }))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href={`/project/${id}`} className="text-sm text-zinc-400 hover:text-zinc-600">
            ← {project.name}
          </Link>
          <span className="text-zinc-200">/</span>
          <span className="text-sm font-medium text-zinc-800">Changes</span>
        </div>
        <span className="text-xs text-zinc-400">
          {events.length} change event{events.length !== 1 ? 's' : ''}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <ChangeManagement
          projectId={id}
          projectName={project.name}
          events={events}
        />
      </div>
    </div>
  )
}
