import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db/prisma'
import { inngest } from '@/inngest/client'

type Context = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Context) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const project = await db.project.findFirst({
    where: { id, ownerId: user.id },
    include: { brds: { where: { isActive: true }, take: 1 } },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const activeBrd = project.brds[0]
  if (!activeBrd) {
    return NextResponse.json({ error: 'No BRD found' }, { status: 400 })
  }

  await inngest.send({
    name: 'brd/uploaded',
    data: {
      brdId:       activeBrd.id,
      projectId:   project.id,
      storagePath: activeBrd.storagePath,
      mimeType:    activeBrd.mimeType,
    },
  })

  // Re-analyse re-parses the BRD (it re-fires brd/uploaded above), so the project
  // is PARSING — not PROCESSING, which is reserved for active generation.
  await db.project.update({
    where: { id },
    data:  { status: 'PARSING' },
  })

  return NextResponse.json({ success: true })
}
