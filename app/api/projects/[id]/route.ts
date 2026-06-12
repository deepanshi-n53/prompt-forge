import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { inngest } from '@/inngest/client'
import { updateProjectSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'

type Context = { params: Promise<{ id: string }> }

async function getOwnedProject(id: string, userId: string) {
  return db.project.findFirst({ where: { id, ownerId: userId } })
}

export async function GET(_request: NextRequest, { params }: Context) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const project = await db.project.findFirst({
    where: { id, ownerId: user.id },
    include: {
      brds: {
        orderBy: { version: 'desc' },
        select: {
          id:           true,
          version:      true,
          fileName:     true,
          fileSize:     true,
          mimeType:     true,
          status:       true,
          healthScore:  true,
          healthDetail: true,
          // parsedContent excluded — large internal JSON, not needed by the UI
          // rawText explicitly never returned — contains raw document text
          isActive:     true,
          uploadedAt:   true,
        },
      },
      decisions: true,
      prompts: {
        orderBy: { createdAt: 'desc' },
        select: {
          id:          true,
          sectionNum:  true,
          sectionName: true,
          layer:       true,
          track:       true,
          status:      true,
          confidence:  true,
          brdVersion:  true,
          createdAt:   true,
        },
      },
      changeEvents: {
        orderBy: { createdAt: 'desc' },
        take:    10,
      },
    },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  return NextResponse.json({ project })
}

export async function PATCH(request: NextRequest, { params }: Context) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const project = await getOwnedProject(id, user.id)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const updated = await db.project.update({
    where: { id },
    data:  parsed.data,
  })

  return NextResponse.json({ project: updated })
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const project = await getOwnedProject(id, user.id)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const brds = await db.bRD.findMany({
    where:  { projectId: id },
    select: { storagePath: true },
  })

  await db.project.delete({ where: { id } })

  logger.info({ userId: user.id, projectId: id, action: 'project.delete' }, 'Project deleted')

  if (brds.length > 0) {
    await inngest.send({
      name: 'project/deleted',
      data: {
        projectId:    id,
        storagePaths: brds.map((b) => b.storagePath).filter(Boolean),
      },
    })
  }

  return NextResponse.json({ ok: true })
}
