import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { inngest } from '@/inngest/client'
import { ChangeEventStatus } from '@prisma/client'

type Context = { params: Promise<{ id: string }> }

// POST /api/changes/{changeEventId}/apply — confirm and trigger delta generation
export async function POST(_request: NextRequest, { params }: Context) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: changeEventId } = await params

  const changeEvent = await db.changeEvent.findUnique({
    where:  { id: changeEventId },
    select: { id: true, projectId: true, status: true, project: { select: { ownerId: true } } },
  })

  if (!changeEvent) {
    return NextResponse.json({ error: 'Change event not found' }, { status: 404 })
  }

  // Only the project owner can apply changes
  if (changeEvent.project.ownerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (changeEvent.status !== ChangeEventStatus.PENDING) {
    return NextResponse.json(
      { error: `Change event is already ${changeEvent.status.toLowerCase()}` },
      { status: 409 },
    )
  }

  // Fire the delta generation job
  const { ids } = await inngest.send({
    name: 'changes/apply-requested',
    data: {
      projectId:     changeEvent.projectId,
      changeEventId: changeEvent.id,
    },
  })

  return NextResponse.json(
    { jobId: changeEvent.projectId, inngestId: ids[0] },
    { status: 202 },
  )
}
