import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db/prisma'
import { inngest } from '@/inngest/client'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Context) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify project ownership
  const project = await db.project.findFirst({
    where: { id, ownerId: user.id },
    select: { id: true },
  })
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { field, answer } = body as { field?: string; answer?: string }
  if (!field || !answer) {
    return NextResponse.json({ error: 'field and answer are required' }, { status: 422 })
  }

  // Send the event that resumes the paused Inngest function
  await inngest.send({
    name: 'brd/pause-answered',
    data: {
      projectId: id,
      field,
      answer,
    },
  })

  return NextResponse.json({ received: true })
}
