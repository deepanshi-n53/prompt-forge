import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import type { Assumption } from '@/types/decision'

type Context = { params: Promise<{ projectId: string; sectionNum: string }> }

export async function GET(_request: NextRequest, { params }: Context) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { projectId, sectionNum } = await params

  // Verify ownership
  const project = await db.project.findFirst({
    where:  { id: projectId, ownerId: user.id },
    select: { id: true },
  })
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Get the latest version for this section
  const prompt = await db.generatedPrompt.findFirst({
    where:   { projectId, sectionNum },
    orderBy: { brdVersion: 'desc' },
  })

  if (!prompt) {
    return NextResponse.json({ error: 'Section not found' }, { status: 404 })
  }

  return NextResponse.json({
    id:          prompt.id,
    projectId:   prompt.projectId,
    sectionNum:  prompt.sectionNum,
    sectionName: prompt.sectionName,
    layer:       prompt.layer,
    track:       prompt.track,
    content:     prompt.content,
    status:      prompt.status,
    confidence:  prompt.confidence,
    assumptions: (prompt.assumptions ?? []) as unknown as Assumption[],
    brdVersion:  prompt.brdVersion,
    createdAt:   prompt.createdAt,
    updatedAt:   prompt.updatedAt,
  })
}
