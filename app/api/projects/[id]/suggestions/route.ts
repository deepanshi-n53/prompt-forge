import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { getSuggestionsForArchetype } from '@/lib/ai/suggestion-engine'
import type { ParsedBRD } from '@/types/brd'

type Context = { params: Promise<{ id: string }> }

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
        where:   { isActive: true },
        orderBy: { version: 'desc' },
        take:    1,
        select:  { parsedContent: true },
      },
      decisions: { select: { decisions: true } },
    },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const archetype  = project.archetype ?? 'Generic'
  const parsedBRD  = (project.brds[0]?.parsedContent ?? {}) as unknown as ParsedBRD
  const decisions  = (project.decisions?.decisions ?? {}) as Record<string, unknown>

  // Combine BRD feature names and explicitly-added suggestion IDs for filtering
  const brdFeatureNames = parsedBRD.coreFeatures?.map((f) => f.name.toLowerCase()) ?? []
  const addedIds        = Array.isArray(decisions.addedSuggestions)
    ? (decisions.addedSuggestions as string[])
    : []

  const suggestions = getSuggestionsForArchetype(archetype, [...brdFeatureNames, ...addedIds])

  return NextResponse.json({ suggestions, archetype, addedIds })
}
