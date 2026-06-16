import { type NextRequest, NextResponse } from 'next/server'
import { Track, Prisma } from '@prisma/client'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { inngest } from '@/inngest/client'
import { buildDecisionGraph, trackFromTimeline } from '@/lib/ai/decision-builder'
import { answersSchema } from '@/lib/validations'
import type { ParsedBRD } from '@/types/brd'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Context) {
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
      decisions: true,
      brds: {
        where: { isActive: true },
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
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

  const parsed = answersSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join('; ') }, { status: 422 })
  }

  const userAnswers = parsed.data
  const activeBrd = project.brds[0] ?? null
  const parsedBRD = (activeBrd?.parsedContent ?? {}) as unknown as ParsedBRD

  // Build the merged decision graph
  const { sections, track } = buildDecisionGraph(parsedBRD, userAnswers)

  // Upsert DecisionGraph
  const decisionGraph = await db.decisionGraph.upsert({
    where: { projectId: id },
    create: {
      projectId: id,
      decisions: sections as unknown as Prisma.InputJsonValue,
      version: 1,
    },
    update: {
      decisions: sections as unknown as Prisma.InputJsonValue,
      version: { increment: 1 },
    },
  })

  // Determine track from Q3 answer and update project
  const newTrack = userAnswers.q3 ? trackFromTimeline(userAnswers.q3) : track
  await db.project.update({
    where: { id },
    data: {
      track: newTrack as Track,
      status: 'PROCESSING',
    },
  })

  // Fire the generate-prompts pipeline (non-blocking — log errors but don't fail the request)
  try {
    await inngest.send({
      name: 'brd/answered',
      data: {
        projectId: id,
        brdId: activeBrd?.id ?? '',
        decisionGraphId: decisionGraph.id,
        track: newTrack,
        userAnswers,
      },
    })
  } catch (err) {
    console.error('[answers] inngest.send failed — user navigated to /generating, job may not start', err)
  }

  return NextResponse.json({ jobId: id, track: newTrack })
}
