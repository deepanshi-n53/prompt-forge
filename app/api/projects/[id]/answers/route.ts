import { type NextRequest, NextResponse } from 'next/server'
import { Track, Prisma } from '@prisma/client'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { inngest } from '@/inngest/client'
import { buildDecisionGraph, decisionsToWizardAnswers } from '@/lib/ai/decision-builder'
import { applyAnswersToDecisions, decisionsToParsedBRD, emptyDecisions, normalizeDecisions } from '@/lib/ai/brd-parser'
import { answersSchema } from '@/lib/validations'

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

  // Field-keyed gap answers (e.g. { multiTenant: 'true', paymentProvider: 'Stripe' }).
  const userAnswers = parsed.data as Record<string, string | undefined>
  const activeBrd = project.brds[0] ?? null

  // 1. Load the rich decision set the parser extracted (embedded in parsedContent).
  const parsedContent = (activeBrd?.parsedContent ?? {}) as Record<string, unknown>
  const baseDecisions = parsedContent.architectureDecisions
    ? normalizeDecisions(parsedContent.architectureDecisions as Record<string, unknown>)
    : emptyDecisions()

  // 2. Merge user answers in at full confidence.
  const mergedDecisions = applyAnswersToDecisions(baseDecisions, userAnswers)

  // 3. Persist the merged decisions back onto the BRD (legacy view + rich view),
  //    so both the generation pipeline and the setup screen reflect the answers.
  const legacyBRD = decisionsToParsedBRD(mergedDecisions)
  if (activeBrd) {
    await db.bRD.update({
      where: { id: activeBrd.id },
      data: {
        parsedContent: {
          ...legacyBRD,
          architectureDecisions: mergedDecisions,
        } as unknown as Prisma.InputJsonValue,
      },
    })
  }

  // 4. Derive the legacy q1–q10 answers + section decision graph the generator needs.
  const wizardAnswers = decisionsToWizardAnswers(mergedDecisions)
  const { sections, track } = buildDecisionGraph(legacyBRD, wizardAnswers)
  const newTrack = mergedDecisions.track ?? track

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

  await db.project.update({
    where: { id },
    data: {
      track: newTrack as Track,
      status: 'PROCESSING',
    },
  })

  // 5. Fire the generation pipeline (non-blocking — log but don't fail the request).
  try {
    await inngest.send({
      name: 'brd/answered',
      data: {
        projectId: id,
        brdId: activeBrd?.id ?? '',
        decisionGraphId: decisionGraph.id,
        track: newTrack,
        userAnswers: wizardAnswers,
      },
    })
  } catch (err) {
    console.error('[answers] inngest.send failed — user navigated to /generating, job may not start', err)
  }

  return NextResponse.json({ jobId: id, track: newTrack })
}
