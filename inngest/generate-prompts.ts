import { inngest } from '@/inngest/client'
import { db } from '@/lib/db/prisma'
import { generateSection } from '@/lib/ai/prompt-generator'
import { getTemplatesForTrack } from '@/lib/ai/section-templates'
import { sendPromptsReadyEmail } from '@/lib/email'
import { setJobState } from '@/lib/jobs/redis'
import { Prisma, ProjectStatus, Track, PromptStatus } from '@prisma/client'
import type { ParsedBRD } from '@/types/brd'
import type { DecisionGraph, SectionDecision } from '@/types/decision'

interface BRDAnsweredPayload {
  projectId:       string
  brdId:           string
  decisionGraphId: string
  track:           string
  userAnswers:     Record<string, string>
}

const BATCH_SIZE = 3

export const generatePromptsJob = inngest.createFunction(
  {
    id:       'generate-prompts',
    retries:  3,
    timeouts: { finish: '10m' },
    triggers: [{ event: 'brd/answered' }],
    onFailure: async ({ event }) => {
      const { projectId } = (
        event.data as { event: { data: BRDAnsweredPayload } }
      ).event.data
      await Promise.all([
        db.project.update({
          where: { id: projectId },
          data:  { status: ProjectStatus.ERROR },
        }),
        setJobState(projectId, {
          status:  'failed',
          percent: 0,
          step:    'error',
          message: 'Generation failed. Please try again.',
          error:   'An unexpected error occurred during prompt generation.',
        }),
      ])
    },
  },
  async ({ event, step }) => {
    const { projectId, brdId, track: trackRaw, userAnswers } =
      event.data as BRDAnsweredPayload

    const track = trackRaw === 'FAST' ? 'FAST' : 'FULL'

    const { decisionGraph, parsedBRD, brdVersion, ownerEmail, ownerName, projectName } =
      await step.run('load-decisions', async () => {
        const [graphRecord, brdRecord, project] = await Promise.all([
          db.decisionGraph.findUnique({ where: { projectId } }),
          db.bRD.findUnique({
            where:  { id: brdId },
            select: { parsedContent: true, version: true },
          }),
          db.project.findUnique({
            where:  { id: projectId },
            select: { name: true, owner: { select: { email: true, name: true } } },
          }),
        ])

        const sections = (graphRecord?.decisions ?? {}) as unknown as Record<string, SectionDecision>
        const graph: DecisionGraph = {
          projectId,
          version:   graphRecord?.version ?? 1,
          sections,
          updatedAt: graphRecord?.updatedAt?.toISOString() ?? new Date().toISOString(),
        }

        await setJobState(projectId, {
          status:  'running',
          percent: 15,
          step:    'load-decisions',
          message: 'Loading project data...',
        })

        return {
          decisionGraph: graph,
          parsedBRD:     (brdRecord?.parsedContent ?? {}) as unknown as ParsedBRD,
          brdVersion:    brdRecord?.version ?? 1,
          ownerEmail:    project?.owner?.email ?? '',
          ownerName:     project?.owner?.name  ?? '',
          projectName:   project?.name         ?? '',
        }
      })

    const templates = await step.run('select-sections', async () => {
      // Layer 1 (universal) + Layer 2A (web) for standard generation.
      // Layer 2B and Layer 3 are run separately per platform/app-type.
      const selected = getTemplatesForTrack(track).filter(
        (t) => t.layer === 'L1' || t.layer === 'L2A',
      )

      await setJobState(projectId, {
        status:  'running',
        percent: 20,
        step:    'select-sections',
        message: `Planning ${selected.length} architecture sections...`,
      })

      return selected
    })

    const totalBatches = Math.ceil(templates.length / BATCH_SIZE)

    for (let i = 0; i < templates.length; i += BATCH_SIZE) {
      const batch      = templates.slice(i, i + BATCH_SIZE)
      const batchIndex = i / BATCH_SIZE
      const batchPct   = 20 + Math.round(((batchIndex + 1) / totalBatches) * 65)

      await Promise.all(
        batch.map((tmpl) =>
          step.run(`generate-${tmpl.num}`, async () => {
            const result = await generateSection(
              tmpl.num,
              tmpl.prompt,
              parsedBRD,
              decisionGraph,
              userAnswers,
            )

            await db.generatedPrompt.upsert({
              where: {
                projectId_sectionNum_brdVersion: {
                  projectId,
                  sectionNum: tmpl.num,
                  brdVersion,
                },
              },
              create: {
                projectId,
                sectionNum:  tmpl.num,
                sectionName: tmpl.name,
                layer:       tmpl.layer,
                track:       track as Track,
                content:     result.content,
                confidence:  result.confidence,
                assumptions: result.assumptions as unknown as Prisma.InputJsonValue,
                status:      PromptStatus.GENERATED,
                brdVersion,
              },
              update: {
                content:     result.content,
                confidence:  result.confidence,
                assumptions: result.assumptions as unknown as Prisma.InputJsonValue,
                status:      PromptStatus.GENERATED,
              },
            })

            return { sectionNum: tmpl.num, confidence: result.confidence }
          }),
        ),
      )

      const completedSections = Math.min(i + BATCH_SIZE, templates.length)
      await setJobState(projectId, {
        status:  'running',
        percent: batchPct,
        step:    `generate-${batch[0].num}`,
        message: `Generated ${completedSections} of ${templates.length} sections...`,
      })
    }

    await step.run('update-project', async () => {
      await db.project.update({
        where: { id: projectId },
        data:  { status: ProjectStatus.READY },
      })
      await setJobState(projectId, {
        status:  'running',
        percent: 95,
        step:    'update-project',
        message: 'Finalising...',
      })
    })

    await step.run('notify-user', async () => {
      if (ownerEmail) {
        await sendPromptsReadyEmail(
          ownerEmail, ownerName, projectName, templates.length, projectId,
        )
      }

      await inngest.send({
        name: 'prompts/generated',
        data: { projectId, sectionCount: templates.length, track },
      })

      await setJobState(projectId, {
        status:  'complete',
        percent: 100,
        step:    'done',
        message: 'All prompts are ready!',
        result:  { projectId, sectionCount: templates.length },
      })
    })

    return { projectId, sectionsGenerated: templates.length, track }
  },
)
