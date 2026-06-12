import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import type { ChangeAnalysis } from '@/types/decision'

type Context = { params: Promise<{ id: string }> }

// GET /api/changes/{projectId} — list ChangeEvents for a project
export async function GET(_request: NextRequest, { params }: Context) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  // Verify ownership
  const project = await db.project.findFirst({
    where:  { id: projectId, ownerId: user.id },
    select: { id: true },
  })
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const events = await db.changeEvent.findMany({
    where:   { projectId },
    orderBy: { createdAt: 'desc' },
    take:    20,
  })

  return NextResponse.json({
    events: events.map((e) => ({
      id:             e.id,
      projectId:      e.projectId,
      oldBrdId:       e.oldBrdId,
      newBrdId:       e.newBrdId,
      status:         e.status,
      changeAnalysis: (e.changeAnalysis ?? {}) as unknown as ChangeAnalysis,
      deltaPrompts:   e.deltaPrompts,
      appliedAt:      e.appliedAt?.toISOString() ?? null,
      createdAt:      e.createdAt.toISOString(),
    })),
  })
}
