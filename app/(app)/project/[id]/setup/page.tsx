import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { buildWizardSetup } from '@/lib/ai/gap-analyzer'
import { Wizard } from './_components/Wizard'
import type { ParsedBRD } from '@/types/brd'

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

  const parsedBRD = (project.brds[0]?.parsedContent ?? null) as ParsedBRD | null
  const wizardSetup = buildWizardSetup(parsedBRD)

  return (
    <Wizard
      projectId={id}
      projectName={project.name}
      insightGroups={wizardSetup.insightGroups}
      gapQuestions={wizardSetup.gapQuestions}
      filledAnswers={wizardSetup.filledAnswers}
      confirmed={wizardSetup.confirmed}
      inferred={wizardSetup.inferred}
      unknown={wizardSetup.unknown}
    />
  )
}
