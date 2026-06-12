import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { Wizard } from './_components/Wizard'

export default async function SetupPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireAuth()
  const { id } = await params

  const project = await db.project.findFirst({
    where: { id, ownerId: user.id },
  })

  if (!project) notFound()

  // Already generated — skip straight to prompts
  if (project.status === 'READY') redirect(`/project/${id}/prompts`)

  return <Wizard projectId={id} projectName={project.name} />
}
