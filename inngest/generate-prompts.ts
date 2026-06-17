import { inngest } from '@/inngest/client'
import { db } from '@/lib/db/prisma'
import { generateSection } from '@/lib/ai/prompt-generator'
import { getTemplatesForTrack } from '@/lib/ai/section-templates'
import type { SectionTemplate } from '@/lib/ai/section-templates'
import { sendPromptsReadyEmail } from '@/lib/email'
import { setJobState } from '@/lib/jobs/redis'
import { applyAnswersToDecisions, emptyDecisions, normalizeDecisions } from '@/lib/ai/brd-parser'
import { applyArchitectureDefaults } from '@/lib/ai/architecture-defaults'
import { Prisma, ProjectStatus, Track, PromptStatus } from '@prisma/client'
import type { ArchitectureDecisions, ParsedBRD } from '@/types/brd'
import type { DecisionGraph, SectionDecision } from '@/types/decision'
import type { PauseOption, PauseInputType } from '@/types/api'

interface BRDAnsweredPayload {
  projectId:       string
  brdId:           string
  decisionGraphId: string
  track:           string
  userAnswers:     Record<string, string>
}

// Exact cascade order — foundational decisions are locked first so every later
// section can reference them. Any selected section NOT listed here (e.g. §04) is
// appended after, so nothing is silently dropped.
const CASCADE_ORDER = [
  '01','05','06','07','08','02','03',
  '09','10','11','12','13',
  '14','15','16','17','18','19','20',
  '21','22','23','24','25','26',
  '27','28','29','30','31','32',
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

  const inCascade = CASCADE_ORDER.filter(num => selected.includes(num))
  const leftover  = selected.filter(num => !CASCADE_ORDER.includes(num))
  return [...inCascade, ...leftover]
}

// ── Locked-decision flattening ────────────────────────────────────────────────
// Turn the rich ArchitectureDecisions into the flat string map every section
// receives as its "LOCKED DECISIONS — never contradict".
function flattenDecisions(d: ArchitectureDecisions): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(d)) {
    if (k === 'confidence' || v == null) continue
    if (Array.isArray(v)) { if (v.length) out[k] = v.join(', '); continue }
    if (typeof v === 'boolean') { out[k] = v ? 'yes' : 'no'; continue }
    out[k] = String(v)
  }
  return out
}

// ── Human pause checkpoints ───────────────────────────────────────────────────

interface PauseSpec {
  question:     string
  subtitle:     string
  inputType:    PauseInputType
  options:      PauseOption[]
  defaultValue: string
}

const PAUSE_SPECS: Record<string, PauseSpec> = {
  needsRealtime: {
    question: 'Does your app need real-time features (live chat, live feed, collaborative editing)?',
    subtitle: 'This affects the entire backend architecture — websockets, SSE, or polling.',
    inputType: 'select',
    options: [
      { value: 'true',  label: 'Yes — real-time needed', description: 'Live chat, live feeds, presence, or collaborative editing' },
      { value: 'false', label: 'No — standard updates',   description: 'Page refresh and periodic polling are sufficient' },
    ],
    defaultValue: 'false',
  },
  hipaaRequired: {
    question: 'Will this app store or process health / medical data (PHI)?',
    subtitle: 'HIPAA reshapes the entire security architecture — encryption, audit logging, and access controls.',
    inputType: 'select',
    options: [
      { value: 'true',  label: 'Yes — handles health data', description: 'Patient records, diagnoses, treatment, or other PHI' },
      { value: 'false', label: 'No — no health data',        description: 'No protected health information is stored' },
    ],
    defaultValue: 'false',
  },
  compliance: {
    question: 'Please confirm your compliance requirements. Which apply to your app?',
    subtitle: 'Select all that apply — this changes the entire §20 compliance architecture.',
    inputType: 'multiselect',
    options: [
      { value: 'GDPR',    label: 'GDPR',    description: 'EU / UK personal-data protection' },
      { value: 'HIPAA',   label: 'HIPAA',   description: 'US health / medical data' },
      { value: 'PCI-DSS', label: 'PCI-DSS', description: 'Storing or processing card data' },
      { value: 'SOC2',    label: 'SOC2',    description: 'Enterprise security attestation' },
      { value: 'None',    label: 'None',    description: 'No regulated data at launch' },
    ],
    defaultValue: 'None',
  },
}

// Boolean pause answers render as Yes/No selects; their answer is normalised to
// 'yes'/'no' in the flat locked map every section reads.
const BOOL_PAUSE_FIELDS = new Set(['needsRealtime', 'hipaaRequired'])

export const generatePromptsJob = inngest.createFunction(
  {
    id:       'generate-prompts',
    retries:  3,
    timeouts: { finish: '15m' },
    triggers: [{ event: 'brd/answered' }],
    // Let the cancel endpoint stop a stuck run: POST /cancel sends
    // `generation/cancel` with the projectId, which aborts this run (including a
    // waitForEvent pause) instead of leaving it hanging until the 15m timeout.
    cancelOn: [
      { event: 'generation/cancel', if: 'async.data.projectId == event.data.projectId' },
    ],
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

    // The rich ArchitectureDecisions (already merged with the user's gap answers)
    // live inside parsedContent — NOT DecisionGraph, which holds the sections shape.
    // This is the seed for the cascade. `let` so pause answers can re-merge into it.
    const decisionsRaw = (parsedBRD as unknown as Record<string, unknown>).architectureDecisions
    let decisions: ArchitectureDecisions = decisionsRaw
      ? normalizeDecisions(decisionsRaw as Record<string, unknown>)
      : emptyDecisions()

    // Fill every non-pausing architecture field the BRD + wizard left blank with a
    // sensible default, so the cascade NEVER blocks on dbEngine/authMethod/etc.
    // (confidence is left untouched, so the §09/§18 pauses can still fire). This is
    // the seed for the flat locked map below.
    decisions = applyArchitectureDefaults(decisions)

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

    // ── Step 3: Cascade generation — sequential, decisions flow forward ────────

    // Seed locked decisions from the full ArchitectureDecisions, plus legacy
    // BRD-derived keys for any consumer that still reads them.
    const lockedDecisions: Record<string, string> = {
      productPurpose:    parsedBRD.productPurpose    ?? '',
      archetype:         parsedBRD.archetype         ?? '',
      monetizationModel: parsedBRD.monetizationModel ?? '',
      ...flattenDecisions(decisions),
      track,
    }

    const allTemplates  = getTemplatesForTrack(track)
    const totalSections = orderedNums.length
    const handled       = new Set<string>()
    let   completedIdx  = 0

    const conf = (field: string): number => decisions.confidence[field] ?? 0

    // The ONLY three pauses that may ever block generation. Every other decision
    // (dbEngine, authMethod, cacheLayer, …) resolves to ARCHITECTURE_DEFAULTS and
    // continues — see lib/ai/architecture-defaults. Returns the pause field key
    // (looked up in PAUSE_SPECS) or null to generate the section immediately.
    function shouldPause(sectionNum: string): string | null {
      // PAUSE 1 — §20 Compliance. ALWAYS confirm which regimes apply.
      if (sectionNum === '20' && !handled.has('compliance')) return 'compliance'

      // PAUSE 2 — §09 Real-time, ONLY when genuinely unknown (confidence < 0.5).
      if (sectionNum === '09' && !handled.has('needsRealtime') && conf('needsRealtime') < 0.5)
        return 'needsRealtime'

      // PAUSE 3 — Security architecture, ONLY when HIPAA is genuinely unknown.
      // NOTE: the spec calls this "§16 Security"; in THIS codebase §16 is rate
      // limiting and §18 is the Security Architecture section that consumes
      // hipaaRequired (encryption, audit logging), so the pause lives at §18.
      if (sectionNum === '18' && !handled.has('hipaaRequired') && conf('hipaaRequired') < 0.5)
        return 'hipaaRequired'

      return null
    }

    // Merge a pause answer back into BOTH the rich decisions (for confidence /
    // dedupe) and the flat locked map (for downstream prompts), at confidence 1.0.
    function applyPauseAnswer(field: string, answer: string): void {
      if (field === 'compliance') {
        const picked = answer.split(',').map(s => s.trim().toLowerCase())
        const gdpr  = picked.includes('gdpr')
        const hipaa = picked.includes('hipaa')
        const pci   = picked.includes('pci-dss') || picked.includes('pci')
        decisions = applyAnswersToDecisions(decisions, {
          gdprRequired:  gdpr  ? 'true' : 'false',
          hipaaRequired: hipaa ? 'true' : 'false',
          pciRequired:   pci   ? 'true' : 'false',
        })
        lockedDecisions.gdprRequired        = gdpr  ? 'yes' : 'no'
        lockedDecisions.hipaaRequired       = hipaa ? 'yes' : 'no'
        lockedDecisions.pciRequired         = pci   ? 'yes' : 'no'
        lockedDecisions.complianceConfirmed = answer
        handled.add('compliance')
        return
      }

      decisions = applyAnswersToDecisions(decisions, { [field]: answer })
      lockedDecisions[field] = BOOL_PAUSE_FIELDS.has(field)
        ? (/^(true|yes|y|1)$/i.test(answer) ? 'yes' : 'no')
        : answer
      handled.add(field)
    }

    for (const sectionNum of orderedNums) {
      const tmpl = allTemplates.find(t => t.num === sectionNum)
      if (!tmpl) continue

      const pct = 15 + Math.round((completedIdx / totalSections) * 75)

      // ── Human pause checkpoint (at most one per section) ────────────────────
      const pauseField = shouldPause(sectionNum)
      if (pauseField) {
        const spec = PAUSE_SPECS[pauseField]

        // Write the paused state inside a step so it is memoized — a raw
        // side-effect would re-fire on every Inngest replay and flicker Redis.
        await step.run(`pause-state-${pauseField}`, () =>
          setJobState(projectId, {
            status:  'paused',
            percent: pct,
            step:    `pause-${pauseField}`,
            message: `Paused at §${sectionNum} — ${tmpl.name}`,
            pauseQuestion: {
              field:        pauseField,
              sectionNum,
              sectionName:  tmpl.name,
              question:     spec.question,
              subtitle:     spec.subtitle,
              inputType:    spec.inputType,
              options:      spec.options,
              defaultValue: spec.defaultValue,
            },
          }),
        )

        const pauseEvent = await step.waitForEvent(`wait-${pauseField}`, {
          event:   'brd/pause-answered',
          timeout: '2h',
          if:      `async.data.projectId == "${projectId}" && async.data.field == "${pauseField}"`,
        })

        const rawAnswer = (pauseEvent?.data as Record<string, string> | null)?.answer
        const answer = rawAnswer && rawAnswer.trim() ? rawAnswer.trim() : spec.defaultValue
        applyPauseAnswer(pauseField, answer)

        // Clear the paused state in Redis the instant we resume — without this,
        // a reconnect during the gap before the next section completes would
        // re-surface the (already-answered) pause modal. Memoized so it doesn't
        // re-fire on replay.
        await step.run(`resume-${pauseField}`, () =>
          setJobState(projectId, {
            status:  'running',
            percent: pct,
            step:    `resume-${pauseField}`,
            message: 'Answer received — resuming generation…',
          }),
        )
      }

      // Snapshot the full locked set BY VALUE — Inngest callbacks don't re-run on
      // replay, so the snapshot must be captured at queue time.
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
        // (Inngest memoizes this return value, so it's available on replay too).
        return {
          sectionNum,
          confidence: result.confidence,
          decisions:  result.decisions ?? {},
        }
      })

      // Accumulate the decisions this section locked in — runs on every invoke
      // (fresh + replay) so downstream sections always get the full cascade.
      if (stepResult.decisions && Object.keys(stepResult.decisions).length > 0) {
        Object.assign(lockedDecisions, stepResult.decisions)
      }

      completedIdx++
      await setJobState(projectId, {
        status:  'running',
        percent: 15 + Math.round((completedIdx / totalSections) * 75),
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
