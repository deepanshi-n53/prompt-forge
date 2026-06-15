import { inngest } from '@/inngest/client'
import { db } from '@/lib/db/prisma'
import { generateSection } from '@/lib/ai/prompt-generator'
import { SECTION_TEMPLATES } from '@/lib/ai/section-templates'
import { setJobState } from '@/lib/jobs/redis'
import { Prisma, ChangeEventStatus, Track, PromptStatus } from '@prisma/client'
import type { ParsedBRD } from '@/types/brd'
import type { DecisionGraph, SectionDecision, ChangeAnalysis } from '@/types/decision'

interface ApplyRequestedPayload {
  projectId:     string
  changeEventId: string
}

const BATCH_SIZE = 3

export const generateDeltaJob = inngest.createFunction(
  {
    id:       'generate-delta-prompts',
    retries:  3,
    timeouts: { finish: '10m' },
    triggers: [{ event: 'changes/apply-requested' }],
    onFailure: async ({ event }) => {
      const { projectId } = (
        event.data as { event: { data: ApplyRequestedPayload } }
      ).event.data
      await setJobState(projectId, {
        status:  'failed',
        percent: 0,
        step:    'error',
        message: 'Delta generation failed. Please try again.',
        error:   'Unable to regenerate affected sections.',
      })
    },
  },
  async ({ event, step }) => {
    const { projectId, changeEventId } = event.data as ApplyRequestedPayload

    // ── Step 1: load impacted sections ──────────────────────────────────────
    const { analysis, parsedBRD, decisions, brdVersion, projectTrack } =
      await step.run('load-impacted', async () => {
        const [changeEvent, graphRecord, activeBrd, project] = await Promise.all([
          db.changeEvent.findUnique({ where: { id: changeEventId } }),
          db.decisionGraph.findUnique({ where: { projectId } }),
          db.bRD.findFirst({
            where:   { projectId, isActive: true },
            orderBy: { version: 'desc' },
            select:  { id: true, parsedContent: true, version: true },
          }),
          db.project.findUnique({
            where:  { id: projectId },
            select: { track: true },
          }),
        ])

        const sections = (graphRecord?.decisions ?? {}) as unknown as Record<
          string,
          SectionDecision
        >
        const graph: DecisionGraph = {
          projectId,
          version:   graphRecord?.version ?? 1,
          sections,
          updatedAt: graphRecord?.updatedAt?.toISOString() ?? new Date().toISOString(),
        }

        await setJobState(projectId, {
          status:  'running',
          percent: 8,
          step:    'load-impacted',
          message: 'Loading impact analysis…',
        })

        return {
          analysis:     (changeEvent?.changeAnalysis ?? {}) as unknown as ChangeAnalysis,
          parsedBRD:    (activeBrd?.parsedContent ?? {}) as unknown as ParsedBRD,
          decisions:    graph,
          brdVersion:   activeBrd?.version ?? 1,
          projectTrack: project?.track ?? Track.FULL,
        }
      })

    // Only regenerate BREAKING sections
    const breakingSections = (analysis.impactedSections ?? []).filter(
      (s) => s.impactLevel === 'BREAKING',
    )
    const sectionNums = breakingSections.map((s) => s.sectionNum)
    const totalCount  = sectionNums.length

    // ── No breaking sections — just mark applied ────────────────────────────
    if (totalCount === 0) {
      await step.run('mark-applied-empty', async () => {
        await db.changeEvent.update({
          where: { id: changeEventId },
          data:  { status: ChangeEventStatus.APPLIED, appliedAt: new Date() },
        })
        await setJobState(projectId, {
          status:  'complete',
          percent: 100,
          step:    'done',
          message: 'No sections required regeneration. Changes applied.',
          result:  { changeEventId, regenerated: 0 },
        })
      })
      return { changeEventId, regenerated: 0 }
    }

    // ── Step 2: mark existing BREAKING prompts as OUTDATED ──────────────────
    await step.run('mark-outdated', async () => {
      await db.generatedPrompt.updateMany({
        where: { projectId, sectionNum: { in: sectionNums } },
        data:  { status: PromptStatus.OUTDATED },
      })

      await setJobState(projectId, {
        status:  'running',
        percent: 18,
        step:    'mark-outdated',
        message: `Flagging ${totalCount} outdated section${totalCount !== 1 ? 's' : ''}…`,
      })
    })

    // ── Step 3: regenerate BREAKING sections (batches of 3) ─────────────────
    const totalBatches = Math.ceil(totalCount / BATCH_SIZE)

    for (let i = 0; i < sectionNums.length; i += BATCH_SIZE) {
      const batchNums  = sectionNums.slice(i, i + BATCH_SIZE)
      const batchIndex = i / BATCH_SIZE
      // Progress arc: 18% → 85%
      const batchPct   = 18 + Math.round(((batchIndex + 1) / totalBatches) * 67)

      await Promise.all(
        batchNums.map((sectionNum) =>
          step.run(`regen-${sectionNum}`, async () => {
            const template = SECTION_TEMPLATES[sectionNum]
            if (!template) return { sectionNum, skipped: true }

            const result = await generateSection(
              sectionNum,
              '',   // sourced from SECTION_TEMPLATES internally
              parsedBRD,
              decisions,
              {}, // user answers already encoded in decisions
            )

            await db.generatedPrompt.upsert({
              where: {
                projectId_sectionNum_brdVersion: {
                  projectId,
                  sectionNum,
                  brdVersion,
                },
              },
              create: {
                projectId,
                sectionNum,
                sectionName: template.name,
                layer:       template.layer,
                track:       projectTrack,
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

            return { sectionNum, confidence: result.confidence }
          }),
        ),
      )

      const completed = Math.min(i + BATCH_SIZE, sectionNums.length)
      await setJobState(projectId, {
        status:  'running',
        percent: batchPct,
        step:    `regen-batch-${batchIndex + 1}`,
        message: `Regenerated ${completed} of ${totalCount} sections…`,
      })
    }

    // ── Step 4: update ChangeEvent + bump DecisionGraph version ────────────
    await step.run('update-change-event', async () => {
      await Promise.all([
        db.changeEvent.update({
          where: { id: changeEventId },
          data: {
            status:      ChangeEventStatus.APPLIED,
            appliedAt:   new Date(),
            deltaPrompts: {
              sectionNums,
              count: sectionNums.length,
            } as unknown as Prisma.InputJsonValue,
          },
        }),
        db.decisionGraph.update({
          where: { projectId },
          data:  { version: { increment: 1 } },
        }),
      ])

      await setJobState(projectId, {
        status:  'running',
        percent: 96,
        step:    'update-change-event',
        message: 'Finalising…',
      })
    })

    // ── Step 5: notify done ─────────────────────────────────────────────────
    await step.run('notify-done', async () => {
      await Promise.all([
        inngest.send({
          name: 'changes/applied',
          data: { projectId, changeEventId, regenerated: sectionNums.length },
        }),
        setJobState(projectId, {
          status:  'complete',
          percent: 100,
          step:    'done',
          message: `${sectionNums.length} section${sectionNums.length !== 1 ? 's' : ''} updated successfully!`,
          result:  { changeEventId, regenerated: sectionNums.length },
        }),
      ])
    })

    return { changeEventId, regenerated: sectionNums.length }
  },
)
