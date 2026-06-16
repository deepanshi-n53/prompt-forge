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
      // From BRD
      productPurpose:    parsedBRD.productPurpose    ?? '',
      archetype:         parsedBRD.archetype         ?? '',
      platform:          parsedBRD.platform          ?? 'web',
      userTypes:         (parsedBRD.userTypes ?? []).slice(0, 5).join(', '),
      coreFeatures:      (parsedBRD.coreFeatures ?? []).filter(f => f.priority === 'MUST').slice(0, 6).map(f => f.name).join(', '),
      integrations:      (parsedBRD.integrationHints ?? []).join(', '),
      monetizationModel: parsedBRD.monetizationModel ?? '',
      // From user wizard answers
      billingModel:      userAnswers.q1 ?? 'Monthly subscription',
      launchRegion:      userAnswers.q2 ?? 'Single country',
      timeline:          userAnswers.q3 ?? '3-6 months',
      sensitiveData:     userAnswers.q4 ?? 'None',
      userScale:         userAnswers.q5 ?? '1,000-10,000',
      deploymentTarget:  userAnswers.q6 ?? 'Railway',
      multiTenant:       userAnswers.q7 ?? 'No',
      authMethod:        userAnswers.q8 ?? 'Email + social',
      dbPreference:      userAnswers.q9 ?? 'PostgreSQL',
      mfaPolicy:         userAnswers.q10 ?? 'Optional for users',
      track,
    }

    const allTemplates  = getTemplatesForTrack(track)
    const totalSections = orderedNums.length
    let   completedIdx  = 0

    for (const sectionNum of orderedNums) {
      const tmpl = allTemplates.find(t => t.num === sectionNum)
      if (!tmpl) continue

      // ── Mid-generation pause checkpoints ─────────────────────────────────────

      // Before §09 (Real-time): ask if not answered and not obvious from BRD
      if (sectionNum === '09' && !lockedDecisions['realtimeNeeded']) {
        await setJobState(projectId, {
          status:  'paused',
          percent: 15 + Math.round((completedIdx / totalSections) * 75),
          step:    'pause-realtime',
          message: 'One quick question before §09 Real-time…',
          pauseQuestion: {
            field:        'realtimeNeeded',
            sectionNum:   '09',
            question:     'Does your app need real-time updates?',
            subtitle:     'Shapes §09 Real-time & Live Data — websockets, SSE, or polling strategy',
            options: [
              { value: 'yes', label: 'Yes — live updates', description: 'Chat, notifications, live dashboards, real-time feeds' },
              { value: 'no',  label: 'No — standard refresh', description: 'Page reloads and periodic polling are fine' },
            ],
            defaultValue: 'no',
          },
        })

        const realtimeEvent = await step.waitForEvent('wait-realtime-answer', {
          event:   'brd/pause-answered',
          timeout: '5m',
          if:      `async.data.projectId == "${projectId}" && async.data.field == "realtimeNeeded"`,
        })
        lockedDecisions['realtimeNeeded'] = (realtimeEvent?.data as Record<string,string> | null)?.answer ?? 'no'
      }

      // Before §20 (Compliance): confirm sensitive data handling
      if (sectionNum === '20') {
        const alreadyKnown = lockedDecisions['sensitiveData'] !== 'None' && lockedDecisions['sensitiveData']
        if (!alreadyKnown || lockedDecisions['sensitiveData'] === 'Unknown') {
          await setJobState(projectId, {
            status:  'paused',
            percent: 15 + Math.round((completedIdx / totalSections) * 75),
            step:    'pause-compliance',
            message: 'One quick compliance question before §20…',
            pauseQuestion: {
              field:        'complianceConfirmed',
              sectionNum:   '20',
              question:     'Confirm: your app does NOT handle human health data, correct?',
              subtitle:     'This is critical — HIPAA compliance changes the entire §20 architecture',
              options: [
                { value: 'confirmed-no-health',    label: 'Correct — no health data',       description: 'Standard privacy rules apply — no HIPAA needed' },
                { value: 'actually-yes-health',    label: 'Wait — we do handle health data', description: 'Enable full HIPAA-compliant security architecture' },
              ],
              defaultValue: 'confirmed-no-health',
            },
          })

          const complianceEvent = await step.waitForEvent('wait-compliance-answer', {
            event:   'brd/pause-answered',
            timeout: '5m',
            if:      `async.data.projectId == "${projectId}" && async.data.field == "complianceConfirmed"`,
          })
          const complianceAnswer = (complianceEvent?.data as Record<string,string> | null)?.answer ?? 'confirmed-no-health'
          if (complianceAnswer === 'actually-yes-health') {
            lockedDecisions['sensitiveData']  = 'Health/medical'
            lockedDecisions['hipaaRequired']  = 'yes'
          }
          lockedDecisions['complianceConfirmed'] = 'yes'
        }
      }

      // Before §31 (i18n): ask about multi-language support
      if (sectionNum === '31' && !lockedDecisions['multiLanguage']) {
        await setJobState(projectId, {
          status:  'paused',
          percent: 15 + Math.round((completedIdx / totalSections) * 75),
          step:    'pause-i18n',
          message: 'One quick question before §31 Internationalisation…',
          pauseQuestion: {
            field:        'multiLanguage',
            sectionNum:   '31',
            question:     'Will your app support multiple languages?',
            subtitle:     'Shapes §31 i18n architecture — locale files, RTL support, date/currency formatting',
            options: [
              { value: 'no',  label: 'English only',          description: 'Single language — simpler architecture' },
              { value: 'yes', label: 'Multiple languages',    description: 'Full i18n with locale files and RTL support if needed' },
            ],
            defaultValue: 'no',
          },
        })

        const i18nEvent = await step.waitForEvent('wait-i18n-answer', {
          event:   'brd/pause-answered',
          timeout: '5m',
          if:      `async.data.projectId == "${projectId}" && async.data.field == "multiLanguage"`,
        })
        lockedDecisions['multiLanguage'] = (i18nEvent?.data as Record<string,string> | null)?.answer ?? 'no'
      }

      // Capture current snapshot — Inngest callbacks don't re-run on replay,
      // so we pass lockedDecisions BY VALUE (spread) at the time this step queues.
      const decisionsSnapshot = { ...lockedDecisions }

      const stepResult = await step.run(`generate-${sectionNum}`, async () => {
        const result = await generateSection(
          sectionNum,
          tmpl.template,
          parsedBRD,
          decisionGraph,
          userAnswers,
          decisionsSnapshot,
        )

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

        // Return decisions so we can accumulate them OUTSIDE the callback
        // (Inngest memoizes this return value, so it's available on replay too)
        return {
          sectionNum,
          confidence: result.confidence,
          decisions:  result.decisions ?? {},
        }
      })

      // Accumulate outside the callback — runs on every invoke (fresh + replay)
      // so downstream sections always receive the full cascade context
      if (stepResult.decisions && Object.keys(stepResult.decisions).length > 0) {
        Object.assign(lockedDecisions, stepResult.decisions)
      }

      completedIdx++
      const pct = 15 + Math.round((completedIdx / totalSections) * 75)
      await setJobState(projectId, {
        status:  'running',
        percent: pct,
        step:    `generate-${sectionNum}`,
        message: `§${sectionNum} complete (${completedIdx}/${totalSections})…`,
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
