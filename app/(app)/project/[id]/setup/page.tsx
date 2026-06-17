import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { getSetupQuestions, buildInsights, summarizeConfidence } from '@/lib/ai/gap-analyzer'
import { emptyDecisions, normalizeDecisions } from '@/lib/ai/brd-parser'
import { Wizard } from './_components/Wizard'
import { RetryBanner } from './_components/RetryBanner'

export default async function SetupPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireAuth()
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
    },
  })

  if (!project) notFound()

  if (project.status === 'READY') redirect(`/project/${id}/prompts`)

  // The rich decision set lives inside parsedContent (embedded by the parser).
  // Fall back to an empty set for BRDs parsed before rich extraction existed.
  const parsedContent = (project.brds[0]?.parsedContent ?? {}) as Record<string, unknown>
  const decisions = parsedContent.architectureDecisions
    ? normalizeDecisions(parsedContent.architectureDecisions as Record<string, unknown>)
    : emptyDecisions()

  const insightGroups = buildInsights(decisions)
  const gapQuestions  = getSetupQuestions(decisions)
  const { confirmed, inferred, unknown } = summarizeConfidence(decisions)

  return (
    <>
      {project.status === 'ERROR' && <RetryBanner projectId={id} />}
      <Wizard
        projectId={id}
        projectName={project.name}
        insightGroups={insightGroups}
        gapQuestions={gapQuestions}
        confirmed={confirmed}
        inferred={inferred}
        unknown={unknown}
      />
    </>
  )
}
