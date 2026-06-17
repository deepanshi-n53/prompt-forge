import { type NextRequest, NextResponse } from 'next/server'
import { Prisma, Track } from '@prisma/client'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { inngest } from '@/inngest/client'
import { decisionsToWizardAnswers } from '@/lib/ai/decision-builder'
import { emptyDecisions, normalizeDecisions } from '@/lib/ai/brd-parser'
import { applyArchitectureDefaults } from '@/lib/ai/architecture-defaults'
import { logger } from '@/lib/logger'

type Context = { params: Promise<{ id: string }> }

// POST /api/projects/[id]/retry
// Re-runs prompt generation for a project that failed or was cancelled, WITHOUT
// re-parsing the BRD or re-asking the setup questions. It re-fires `brd/answered`
// from the decisions already persisted on the active BRD + DecisionGraph, so the
// cascade picks up exactly where setup left off and the generating page reaches
// READY normally. (Distinct from /reanalyse, which re-parses from scratch.)
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
    include: {
      decisions: true,
      brds: {
        where:   { isActive: true },
        orderBy: { version: 'desc' },
        take:    1,
      },
    },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const activeBrd      = project.brds[0] ?? null
  const decisionGraph  = project.decisions
  if (!activeBrd || !decisionGraph) {
    return NextResponse.json(
      { error: 'No analysed BRD to retry. Re-run setup first.' },
      { status: 400 },
    )
  }

  // Reconstruct the same brd/answered payload the setup wizard produced, from the
  // merged decisions already stored on the BRD — then fill every blank field with
  // a default so a retry NEVER stalls on the same missing decision again.
  const parsedContent = (activeBrd.parsedContent ?? {}) as Record<string, unknown>
  const baseDecisions = parsedContent.architectureDecisions
    ? normalizeDecisions(parsedContent.architectureDecisions as Record<string, unknown>)
    : emptyDecisions()
  const decisions = applyArchitectureDefaults(baseDecisions)

  const wizardAnswers = decisionsToWizardAnswers(decisions)
  const track = (decisions.track ?? project.track) as Track

  // Persist the defaulted decisions back onto the BRD so setup + generation both
  // see the same complete set, and wipe any partially-generated prompts so the
  // cascade starts fresh rather than mixing old + new output.
  await db.bRD.update({
    where: { id: activeBrd.id },
    data:  {
      parsedContent: {
        ...parsedContent,
        architectureDecisions: decisions as unknown as Prisma.InputJsonValue,
      } as unknown as Prisma.InputJsonValue,
    },
  })
  await db.generatedPrompt.deleteMany({ where: { projectId: id } })

  await db.project.update({
    where: { id },
    data:  { status: 'PROCESSING', track },
  })

  try {
    await inngest.send({
      name: 'brd/answered',
      data: {
        projectId:       id,
        brdId:           activeBrd.id,
        decisionGraphId: decisionGraph.id,
        track,
        userAnswers:     wizardAnswers,
      },
    })
  } catch (err) {
    logger.error({ projectId: id, err }, 'retry: inngest.send failed')
    return NextResponse.json({ error: 'Could not start generation. Try again.' }, { status: 502 })
  }

  return NextResponse.json({ jobId: id, track })
}
