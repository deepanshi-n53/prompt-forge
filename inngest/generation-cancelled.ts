import { inngest } from '@/inngest/client'
import { db } from '@/lib/db/prisma'
import { getRunProject, setJobState } from '@/lib/jobs/redis'
import { logger } from '@/lib/logger'
import { ProjectStatus } from '@prisma/client'

// generate-prompts can be cancelled WITHOUT going through its onFailure handler:
// the finish timeout, an Inngest-side cancellation, or the cancelOn
// `generation/cancel` event all emit `inngest/function.cancelled` (not
// `function.failed`). Left unhandled, the project stays stuck on PROCESSING and
// the generating page spins forever.
//
// The cancelled event carries only function_id + run_id — no projectId — so we
// resolve the project via the run→project bridge generate-prompts writes at start
// (only generate-prompts writes a `genrun:` key, so a hit also confirms it's the
// right function). We flip the run to ERROR + a terminal job state the UI reads,
// but ONLY while it's still PROCESSING — never clobbering a user-initiated cancel
// (which intentionally moved the project to PARSED) or a finished run (READY).
export const generationCancelledJob = inngest.createFunction(
  {
    id:       'generation-cancelled-cleanup',
    triggers: [{ event: 'inngest/function.cancelled' }],
  },
  async ({ event, step }) => {
    const { run_id } = event.data as { run_id?: string }
    if (!run_id) return { skipped: 'no-run-id' }

    const projectId = await getRunProject(run_id)
    if (!projectId) return { skipped: 'not-a-generate-prompts-run' }

    return await step.run('mark-error-if-processing', async () => {
      const project = await db.project.findUnique({
        where:  { id: projectId },
        select: { status: true },
      })

      // Only a still-running generation should be flipped to ERROR.
      if (project?.status !== ProjectStatus.PROCESSING) {
        logger.info(
          { projectId, status: project?.status },
          'cancelled-cleanup: project not PROCESSING — skipping',
        )
        return { projectId, action: 'skipped', status: project?.status }
      }

      await db.project.update({
        where: { id: projectId },
        data:  { status: ProjectStatus.ERROR },
      })
      await setJobState(projectId, {
        status:  'failed',
        percent: 0,
        step:    'cancelled',
        message: 'Generation stopped.',
        error:   'Generation was stopped before it finished. Please retry.',
      })
      logger.warn({ projectId, run_id }, 'cancelled-cleanup: marked project ERROR after cancellation')

      return { projectId, action: 'marked-error' }
    })
  },
)
