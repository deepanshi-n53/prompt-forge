import { type NextRequest, NextResponse } from 'next/server'
import { PromptStatus } from '@prisma/client'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { inngest } from '@/inngest/client'
import { logger } from '@/lib/logger'

type Context = { params: Promise<{ id: string }> }

// POST /api/projects/[id]/cancel
// Stops a stuck / unwanted generation: flips the project to ERROR, clears the
// half-generated prompts so a retry starts clean, and best-effort cancels the
// running Inngest job via the `generation/cancel` event (matched by projectId in
// generate-prompts' `cancelOn`). If Inngest can't be reached the DB is still
// ERROR, so the user always has an escape route.
export async function POST(_req: NextRequest, { params }: Context) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // 1. Verify ownership.
  const project = await db.project.findFirst({ where: { id, ownerId: user.id } })
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // 2. Mark the project as errored so the UI can offer a retry.
  await db.project.update({
    where: { id },
    data:  { status: 'ERROR' },
  })

  // 3. Drop the prompts generated so far so a retry isn't half-filled.
  await db.generatedPrompt.deleteMany({
    where: { projectId: id, status: PromptStatus.GENERATED },
  })

  // 4. Best-effort cancel of the live Inngest run. generate-prompts listens for
  //    this event in its `cancelOn`; if the SDK send fails we still return ok.
  try {
    await inngest.send({
      name: 'generation/cancel',
      data: { projectId: id },
    })
  } catch (err) {
    logger.error({ projectId: id, err }, 'cancel: inngest.send failed — DB already ERROR')
  }

  return NextResponse.json({
    success: true,
    message: 'Generation cancelled. You can retry from setup.',
  })
}
