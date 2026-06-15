import { inngest } from '@/inngest/client'
import { db } from '@/lib/db/prisma'
import { extractTextFromStorage } from '@/lib/ai/text-extractor'
import { parseBRDWithAI } from '@/lib/ai/brd-parser'
import { detectArchetype } from '@/lib/ai/archetype-detector'
import { setJobState } from '@/lib/jobs/redis'
import type { BRDHealthReport, ParsedBRD } from '@/types'
import { Prisma, BRDStatus, ProjectStatus } from '@prisma/client'

interface BRDUploadedPayload {
  brdId: string
  projectId: string
  storagePath: string
  mimeType: string
}

function buildHealthReport(parsed: ParsedBRD): BRDHealthReport {
  const dimensions = parsed.healthScores ?? []
  const total =
    dimensions.length > 0
      ? Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length)
      : 0
  const gaps = dimensions.flatMap((d) => d.gaps)
  const recommendations = gaps.slice(0, 10).map((g) => `Address gap: ${g}`)
  return { total, dimensions, gaps, recommendations }
}

export const parseBRDJob = inngest.createFunction(
  {
    id: 'parse-brd',
    retries: 3,
    timeouts: { finish: '5m' },
    triggers: [{ event: 'brd/uploaded' }],
    onFailure: async ({ event }) => {
      const { brdId, projectId } = (
        event.data as { event: { data: BRDUploadedPayload } }
      ).event.data
      await Promise.all([
        db.bRD.update({
          where: { id: brdId },
          data: { status: BRDStatus.FAILED },
        }),
        db.project.update({
          where: { id: projectId },
          data: { status: ProjectStatus.ERROR },
        }),
        setJobState(projectId, {
          status:  'failed',
          percent: 0,
          step:    'error',
          message: 'BRD parsing failed. Please try uploading again.',
          error:   'An unexpected error occurred while parsing your document.',
        }),
      ])
    },
  },
  async ({ event, step }) => {
    const { brdId, projectId, storagePath, mimeType } = event.data as BRDUploadedPayload

    // 1. Extract raw text from storage
    const rawText = await step.run('extract-text', async () => {
      const text = await extractTextFromStorage(storagePath, mimeType)
      await setJobState(projectId, {
        status:  'running',
        percent: 20,
        step:    'extract-text',
        message: 'Extracting document text…',
      })
      return text
    })

    // 2. Parse with Claude AI
    const parsedBRD = await step.run('parse-with-ai', async () => {
      const result = await parseBRDWithAI(rawText)
      await setJobState(projectId, {
        status:  'running',
        percent: 55,
        step:    'parse-with-ai',
        message: 'Analysing product requirements…',
      })
      return result
    })

    // 3. Calculate health score
    const healthReport = await step.run('health-score', async () => {
      const report = buildHealthReport(parsedBRD)
      await setJobState(projectId, {
        status:  'running',
        percent: 72,
        step:    'health-score',
        message: 'Scoring BRD quality…',
      })
      return report
    })

    // 4. Detect archetype
    const { archetype, confidence } = await step.run('detect-archetype', async () => {
      const result = await detectArchetype(parsedBRD)
      await setJobState(projectId, {
        status:  'running',
        percent: 88,
        step:    'detect-archetype',
        message: 'Detecting product archetype…',
      })
      return result
    })

    // 5. Persist all parsed data and mark BRD as parsed
    await step.run('save-status', async () => {
      await db.bRD.update({
        where: { id: brdId },
        data: {
          status: BRDStatus.PARSED,
          parsedContent: parsedBRD as unknown as Prisma.InputJsonValue,
          healthScore: healthReport.total,
          healthDetail: healthReport as unknown as Prisma.InputJsonValue,
        },
      })
      await db.project.update({
        where: { id: projectId },
        data: {
          archetype,
          archetypeConfidence: confidence,
          status: ProjectStatus.PARSED,
        },
      })

      await setJobState(projectId, {
        status:  'complete',
        percent: 100,
        step:    'done',
        message: 'BRD parsed successfully!',
        result:  { archetype, healthScore: healthReport.total },
      })
    })

    // 6. Trigger next stage — prompt generation
    await step.run('emit-parsed', async () => {
      await inngest.send({
        name: 'brd/parsed',
        data: {
          brdId,
          projectId,
          archetype,
          confidence,
          healthScore: healthReport.total,
        },
      })
    })

    return { brdId, projectId, archetype, healthScore: healthReport.total }
  },
)
