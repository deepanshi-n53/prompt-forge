import { type NextRequest, NextResponse } from 'next/server'
import { Prisma, PromptStatus } from '@prisma/client'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { inngest } from '@/inngest/client'
import { getSuggestionsForArchetype } from '@/lib/ai/suggestion-engine'
import { logger } from '@/lib/logger'

type Context = { params: Promise<{ id: string; suggestionId: string }> }

export async function POST(_request: NextRequest, { params }: Context) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId, suggestionId } = await params

  const project = await db.project.findFirst({
    where:   { id: projectId, ownerId: user.id },
    include: { decisions: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Find suggestion (pass empty filter to see all for this archetype)
  const allForArchetype = getSuggestionsForArchetype(project.archetype ?? '', [])
  const suggestion = allForArchetype.find((s) => s.id === suggestionId)
  if (!suggestion) {
    return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
  }

  const existingDecisions = (project.decisions?.decisions ?? {}) as Record<string, unknown>
  const addedIds = Array.isArray(existingDecisions.addedSuggestions)
    ? (existingDecisions.addedSuggestions as string[])
    : []

  if (addedIds.includes(suggestionId)) {
    return NextResponse.json({ error: 'Already added' }, { status: 409 })
  }

  const updatedDecisions: Record<string, unknown> = {
    ...existingDecisions,
    addedSuggestions: [...addedIds, suggestionId],
  }

  // Persist suggestion to DecisionGraph
  await db.decisionGraph.upsert({
    where:  { projectId },
    create: {
      projectId,
      decisions: updatedDecisions as unknown as Prisma.InputJsonValue,
      version:   1,
    },
    update: {
      decisions: updatedDecisions as unknown as Prisma.InputJsonValue,
      version:   { increment: 1 },
    },
  })

  // Mark affected generated prompts as OUTDATED so the UI signals they need refresh
  if (suggestion.sections.length > 0) {
    await db.generatedPrompt.updateMany({
      where: { projectId, sectionNum: { in: suggestion.sections } },
      data:  { status: PromptStatus.OUTDATED },
    })
  }

  logger.info(
    { userId: user.id, projectId, suggestionId, sections: suggestion.sections, action: 'suggestion.added' },
    'Suggestion added to architecture',
  )

  // Signal downstream — a handler can re-generate affected sections
  await inngest.send({
    name: 'suggestion/added',
    data: { projectId, suggestionId, affectedSections: suggestion.sections },
  })

  return NextResponse.json({ ok: true, suggestion })
}
