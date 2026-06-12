import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { GeneratingView } from './_components/GeneratingView'

export default async function GeneratingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ jobId?: string; onboarding?: string }>
}) {
  const user = await requireAuth()
  const { id }    = await params
  const { jobId, onboarding } = await searchParams

  const project = await db.project.findFirst({
    where: { id, ownerId: user.id },
    select: { id: true, status: true },
  })

  if (!project) notFound()

  // Already done — skip the loading screen
  if (project.status === 'READY') {
    redirect(`/project/${id}/prompts${onboarding === '1' ? '?onboarding=1' : ''}`)
  }

  return (
    <GeneratingView
      projectId={id}
      jobId={jobId ?? id}
      isOnboarding={onboarding === '1'}
    />
  )
}
