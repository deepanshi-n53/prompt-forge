import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { inngest } from '@/inngest/client'
import { clearJobState } from '@/lib/jobs/redis'
import { logger } from '@/lib/logger'

type Context = { params: Promise<{ id: string }> }

// POST /api/projects/[id]/cancel
// Backs a stuck / unwanted generation out to setup WITHOUT destroying work:
//   • status → PARSED so the project lands back on the setup wizard (not ERROR)
//   • the Redis job state is cleared so a stale `paused`/`running` snapshot can't
//     re-surface a pause modal after the user leaves
//   • the DecisionGraph is KEPT (the user reviews/edits decisions on setup)
//   • already-generated prompts are KEPT (a retry overwrites them in place)
//   • best-effort cancels the live Inngest run via `generation/cancel` (matched
//     by projectId in generate-prompts' `cancelOn`)
// The client redirects to /project/[id]/setup using `redirectTo`.
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

  // 2. Send the user back to setup — PARSED, not ERROR. The decisions and any
  //    prompts generated so far are left intact for review / retry.
  await db.project.update({
    where: { id },
    data:  { status: 'PARSED' },
  })

  // 3. Clear the job state so a reconnect can't re-show the (abandoned) pause.
  await clearJobState(id)

  // 4. Best-effort cancel of the live Inngest run. generate-prompts listens for
  //    this event in its `cancelOn`; if the SDK send fails we still return ok.
  try {
    await inngest.send({
      name: 'generation/cancel',
      data: { projectId: id },
    })
  } catch (err) {
    logger.error({ projectId: id, err }, 'cancel: inngest.send failed — status already PARSED')
  }

  return NextResponse.json({
    success:    true,
    redirectTo: `/project/${id}/setup`,
  })
}
