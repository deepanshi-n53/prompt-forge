import { inngest } from '@/inngest/client'
import { db } from '@/lib/db/prisma'
import { generateSection } from '@/lib/ai/prompt-generator'
import { getTemplatesForTrack } from '@/lib/ai/section-templates'
import type { SectionTemplate } from '@/lib/ai/section-templates'
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

// Cascade order — foundational decisions first so later sections can reference them
const CASCADE_ORDER = [
  '01','05','06','07','08','02','03','04',
  '09','10','11','12','13','14','15',
  '16','17','18','19','20','21','22',
  '23','24','25','26','27','28','29',
  '30','31','32',
  'W1','W2','W3','W4','W5','W6','W7','W8',
  'M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12',
  '3A','3B','3C','3D','3E',
]

const ARCHETYPE_TO_L3: Record<string, string> = {
  marketplace:    '3A',
  ecommerce:      '3A',
  'consumer-app': '3B',
  'ai-tool':      '3C',
  'b2b-saas':     '3D',
}

function selectSections(
  allTemplates: SectionTemplate[],
  parsedBRD:    ParsedBRD,
  track:        'FAST' | 'FULL',
): string[] {
  const platform  = parsedBRD.platform  ?? 'web'
  const archetype = parsedBRD.archetype ?? ''

  // L1 — always included
  let selected = allTemplates.filter(t => t.layer === 'L1').map(t => t.num)

  // L2A (web)
  if (platform === 'web' || platform === 'both') {
    selected = [...selected, ...allTemplates.filter(t => t.layer === 'L2A').map(t => t.num)]
  }

  // L2B (mobile)
  if (platform === 'mobile' || platform === 'both') {
    selected = [...selected, ...allTemplates.filter(t => t.layer === 'L2B').map(t => t.num)]
  }

  // L3 — app-type specific
  const l3Num = ARCHETYPE_TO_L3[archetype]
  if (l3Num && allTemplates.find(t => t.num === l3Num)) {
    selected.push(l3Num)
  }

  // Remove FULL_ONLY sections when on Fast track
  if (track === 'FAST') {
    selected = selected.filter(num => {
      const t = allTemplates.find(t => t.num === num)
      return t?.track !== 'FULL'
    })
  }

  // Return in cascade order (foundational first)
  return CASCADE_ORDER.filter(num => selected.includes(num))
}

export const generatePromptsJob = inngest.createFunction(
  {
    id:       'generate-prompts',
    retries:  3,
    timeouts: { finish: '15m' },
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

    // ── Step 1: Load project data ─────────────────────────────────────────────

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
          percent: 10,
          step:    'load-decisions',
          message: 'Loading project data…',
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

    // ── Step 2: Select sections in cascade order ──────────────────────────────

    const orderedNums = await step.run('select-sections', async () => {
      const allTemplates = getTemplatesForTrack(track)
      const selected     = selectSections(allTemplates, parsedBRD, track)

      await setJobState(projectId, {
        status:  'running',
        percent: 15,
        step:    'select-sections',
        message: `Planning ${selected.length} architecture sections in cascade order…`,
      })

      return selected
    })

    // ── Step 3: Cascade generation — sequential, each section gets locked decisions ─

    // Seed locked decisions from BRD + user answers
    const lockedDecisions: Record<string, string> = {
      productPurpose:    parsedBRD.productPurpose    ?? '',
      archetype:         parsedBRD.archetype         ?? '',
      platform:          parsedBRD.platform          ?? 'web',
      monetizationModel: parsedBRD.monetizationModel ?? '',
      billingModel:      userAnswers.q1 ?? 'Monthly subscription',
      launchRegion:      userAnswers.q2 ?? 'Single country',
      timeline:          userAnswers.q3 ?? '3-6 months',
      sensitiveData:     userAnswers.q4 ?? 'None',
      userScale:         userAnswers.q5 ?? '1,000-10,000',
      track,
    }

    const allTemplates     = getTemplatesForTrack(track)
    const totalSections    = orderedNums.length
    let   completedCount   = 0

    for (const sectionNum of orderedNums) {
      const tmpl = allTemplates.find(t => t.num === sectionNum)
      if (!tmpl) continue

      await step.run(`generate-${sectionNum}`, async () => {
        const result = await generateSection(
          sectionNum,
          tmpl.template,
          parsedBRD,
          decisionGraph,
          userAnswers,
          lockedDecisions,
        )

        // Merge new decisions into cascade context for subsequent sections
        if (result.decisions && Object.keys(result.decisions).length > 0) {
          Object.assign(lockedDecisions, result.decisions)
        }

        await db.generatedPrompt.upsert({
          where: {
            projectId_sectionNum_brdVersion: { projectId, sectionNum, brdVersion },
          },
          create: {
            projectId,
            sectionNum,
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

        completedCount++
        const pct = 15 + Math.round((completedCount / totalSections) * 75)
        await setJobState(projectId, {
          status:  'running',
          percent: pct,
          step:    `generate-${sectionNum}`,
          message: `§${sectionNum} complete (${completedCount}/${totalSections})…`,
        })

        return { sectionNum, confidence: result.confidence }
      })
    }

    // ── Step 4: Mark project READY ────────────────────────────────────────────

    await step.run('update-project', async () => {
      await db.project.update({
        where: { id: projectId },
        data:  { status: ProjectStatus.READY },
      })
      await setJobState(projectId, {
        status:  'running',
        percent: 95,
        step:    'update-project',
        message: 'Finalising…',
      })
    })

    // ── Step 5: Notify user ───────────────────────────────────────────────────

    await step.run('notify-user', async () => {
      if (ownerEmail) {
        await sendPromptsReadyEmail(ownerEmail, ownerName, projectName, orderedNums.length, projectId)
      }

      await inngest.send({
        name: 'prompts/generated',
        data: { projectId, sectionCount: orderedNums.length, track },
      })

      await setJobState(projectId, {
        status:  'complete',
        percent: 100,
        step:    'done',
        message: 'All prompts are ready!',
        result:  { projectId, sectionCount: orderedNums.length },
      })
    })

    return { projectId, sectionsGenerated: orderedNums.length, track }
  },
)
