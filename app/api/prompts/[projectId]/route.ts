import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'

type Context = { params: Promise<{ projectId: string }> }

export async function GET(_request: NextRequest, { params }: Context) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { projectId } = await params

  // Verify ownership
  const project = await db.project.findFirst({
    where: { id: projectId, ownerId: user.id },
    select: { id: true, track: true, status: true, updatedAt: true },
  })
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // `projectId` is the correct foreign-key column on GeneratedPrompt (see schema —
  // `model GeneratedPrompt { projectId String … }`), so this is the right filter.
  const prompts = await db.generatedPrompt.findMany({
    where:   { projectId },
    orderBy: [{ sectionNum: 'asc' }],
    select: {
      id:          true,
      sectionNum:  true,
      sectionName: true,
      layer:       true,
      track:       true,
      status:      true,
      confidence:  true,
      assumptions: true,
      brdVersion:  true,
      updatedAt:   true,
    },
  })

  console.log(
    `[prompts:${projectId}] status=${project.status} rows=${prompts.length}`,
    prompts.map((p) => p.sectionNum),
  )

  // Generation says it finished but no prompts exist — surface a clear error
  // instead of silently rendering an empty page.
  if (prompts.length === 0 && project.status === 'READY') {
    return NextResponse.json(
      {
        projectId,
        projectStatus: project.status,
        projectTrack:  project.track,
        totalCount:    0,
        layers:        [],
        error:         'Generation completed but no prompts were saved. Please regenerate from setup.',
      },
      { status: 200 },
    )
  }

  // Group by layer (sections within a layer keep their sectionNum order)
  const byLayer: Record<string, typeof prompts> = {}
  for (const p of prompts) {
    if (!byLayer[p.layer]) byLayer[p.layer] = []
    byLayer[p.layer].push(p)
  }

  // Shape each prompt for the list view
  const layers = Object.entries(byLayer).map(([layer, items]) => ({
    layer,
    prompts: items.map((p) => ({
      id:              p.id,
      sectionNum:      p.sectionNum,
      sectionName:     p.sectionName,
      layer:           p.layer,
      track:           p.track,
      status:          p.status,
      confidence:      p.confidence,
      assumptionCount: Array.isArray(p.assumptions) ? p.assumptions.length : 0,
      brdVersion:      p.brdVersion,
      updatedAt:       p.updatedAt,
    })),
  }))

  return NextResponse.json({
    projectId,
    projectStatus: project.status,
    projectTrack:  project.track,
    totalCount:    prompts.length,
    lastUpdatedAt: project.updatedAt,
    layers,
  })
}
