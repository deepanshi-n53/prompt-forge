import { inngest } from '@/inngest/client'
import { db } from '@/lib/db/prisma'
import { generateSection } from '@/lib/ai/prompt-generator'
import { getTemplatesForTrack } from '@/lib/ai/section-templates'
import type { SectionTemplate } from '@/lib/ai/section-templates'
import { sendPromptsReadyEmail } from '@/lib/email'
import { setJobState } from '@/lib/jobs/redis'
import { applyAnswersToDecisions, emptyDecisions, normalizeDecisions } from '@/lib/ai/brd-parser'
import { getMidGenQuestion } from '@/lib/ai/gap-analyzer'
import { CostMeter, addRunToTotal } from '@/lib/ai/cost-estimator'
import { checkConsistency } from '@/lib/ai/consistency-checker'
import { logger } from '@/lib/logger'
import { Prisma, ProjectStatus, Track, PromptStatus } from '@prisma/client'
import type { ArchitectureDecisions, ParsedBRD } from '@/types/brd'
import type { DecisionGraph, SectionDecision } from '@/types/decision'
import type { PauseQuestion } from '@/types/api'

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

    // One meter for the whole run. Each section's cost is folded in OUTSIDE the
    // step callback (callbacks are memoized and don't re-run on replay), so the
    // accumulation stays deterministic — mirroring the lockedDecisions cascade.
    // No constructor model: each call is priced with the model it actually used
    // (usage.model), so the gpt-4o-mini section calls are costed correctly.
    const meter = new CostMeter()

    // Merge a mid-gen pause answer back into BOTH the rich decisions (for
    // confidence / dedupe) and the flat locked map (for downstream prompts), at
    // confidence 1.0. Handles a single-field pause (data.answer) and a
    // multi-question pause such as §20 compliance (data.answers map). A blank /
    // skipped answer falls back to the question's defaultValue.
    function applyMidGenAnswer(q: PauseQuestion, data: Record<string, unknown> | null): void {
      if (q.questions && q.questions.length > 0) {
        const answers = (data?.answers as Record<string, string> | undefined) ?? {}
        const merged: Record<string, string> = {}
        for (const sub of q.questions) {
          const a = answers[sub.field]
          merged[sub.field] = a && a.trim() ? a.trim() : sub.defaultValue
        }
        decisions = applyAnswersToDecisions(decisions, merged)
      } else {
        const raw    = data?.answer as string | undefined
        const answer = raw && raw.trim() ? raw.trim() : q.defaultValue
        decisions = applyAnswersToDecisions(decisions, { [q.field]: answer })
      }
      // Re-flatten so every field the answer touched (booleans → yes/no, arrays →
      // joined) overwrites the locked map the downstream sections read.
      Object.assign(lockedDecisions, flattenDecisions(decisions))
    }

    for (const sectionNum of orderedNums) {
      const tmpl = allTemplates.find(t => t.num === sectionNum)
      if (!tmpl) continue

      const pct = 15 + Math.round((completedIdx / totalSections) * 75)

      // ── Human pause checkpoints ─────────────────────────────────────────────
      // A section may need more than one answer (e.g. §09 asks needsRealtime, then
      // realtimeMethod). Re-evaluate after every merge: getMidGenQuestion returns
      // the next unanswered question or null. `handled` guards each field so a
      // skipped (empty) answer never re-triggers the same pause. NO hardcoded list
      // of pausing sections — it's driven entirely by what's still unknown.
      let pauseQ: PauseQuestion | null
      while ((pauseQ = getMidGenQuestion(sectionNum, decisions, handled)) != null) {
        const q = pauseQ
        const field = q.field

        // Write the paused state inside a step so it is memoized — a raw
        // side-effect would re-fire on every Inngest replay and flicker Redis.
        await step.run(`pause-state-${field}`, () =>
          setJobState(projectId, {
            status:  'paused',
            percent: pct,
            step:    `pause-${field}`,
            message: `Paused at §${sectionNum} — ${tmpl.name}`,
            pauseQuestion: { ...q, sectionNum, sectionName: q.sectionName ?? tmpl.name },
          }),
        )

        // Cap the wait so an unanswered pause never stalls the cascade. On
        // timeout, waitForEvent resolves to null and we fall through to
        // applyMidGenAnswer(q, null), which fills the field from its
        // defaultValue / AI guess — generation always completes whether or not
        // the user answers in time.
        const pauseEvent = await step.waitForEvent(`wait-${field}`, {
          event:   'brd/pause-answered',
          timeout: '90s',
          if:      `async.data.projectId == "${projectId}" && async.data.field == "${field}"`,
        })

        if (pauseEvent === null) {
          logger.info(
            { projectId, sectionNum, field, defaultValue: q.defaultValue },
            'Mid-gen pause timed out — proceeding with default value',
          )
        }
        applyMidGenAnswer(q, (pauseEvent?.data as Record<string, unknown> | null) ?? null)
        handled.add(field)

        // Clear the paused state in Redis the instant we resume — without this,
        // a reconnect during the gap before the next section completes would
        // re-surface the (already-answered) pause modal. Memoized so it doesn't
        // re-fire on replay.
        await step.run(`resume-${field}`, () =>
          setJobState(projectId, {
            status:  'running',
            percent: pct,
            step:    `resume-${field}`,
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

        // Return decisions + cost-metering inputs so we can accumulate them
        // OUTSIDE the callback (Inngest memoizes this return value, so it's
        // available on replay too). usage is the provider's real token counts
        // when available; promptChars/completionChars are the fallback estimate.
        return {
          sectionNum,
          confidence:      result.confidence,
          decisions:       result.decisions ?? {},
          usage:           result.usage ?? null,
          promptChars:     result.promptChars ?? 0,
          completionChars: result.completionChars ?? 0,
        }
      })

      // Accumulate the decisions this section locked in — runs on every invoke
      // (fresh + replay) so downstream sections always get the full cascade.
      if (stepResult.decisions && Object.keys(stepResult.decisions).length > 0) {
        Object.assign(lockedDecisions, stepResult.decisions)
      }

      // Meter this call's cost the same way — from the memoized return value, so
      // the run total is identical on a fresh run and any replay. Prefers real
      // usage; falls back to the char-count estimate when usage is absent (mock).
      meter.meter({
        usage:       stepResult.usage,
        inputChars:  stepResult.promptChars,
        outputChars: stepResult.completionChars,
      })

      completedIdx++
      // Memoized so it runs exactly once per section. A RAW setJobState here is a
      // replay hazard: on any Inngest re-invocation while the run is paused
      // (waitForEvent pending), the live re-run of already-completed sections
      // would write a 'running' frame AFTER the memoized (non-re-firing)
      // pause-state frame, clobbering the stored pauseQuestion — so the client
      // would never see the pause modal and the run would hang until timeout.
      const donePercent = 15 + Math.round((completedIdx / totalSections) * 75)
      const doneCount   = completedIdx
      await step.run(`progress-${sectionNum}`, () =>
        setJobState(projectId, {
          status:  'running',
          percent: donePercent,
          step:    `generate-${sectionNum}`,
          message: `§${sectionNum} complete (${doneCount}/${totalSections})…`,
        }),
      )
    }

    // ── Step 4: Persist this run's AI cost ────────────────────────────────────
    // Fold the run total into the project's accumulated spend and count the run.
    // Memoized step → runs exactly once, so the total isn't double-added on replay.
    const runCents = meter.runTotalCents
    await step.run('persist-cost', async () => {
      const project = await db.project.findUnique({
        where:  { id: projectId },
        select: { aiCostCents: true },
      })
      const newTotal = addRunToTotal(project?.aiCostCents ?? 0, runCents)
      await db.project.update({
        where: { id: projectId },
        data:  {
          aiCostCents:      newTotal,
          aiGenerationRuns: { increment: 1 },
        },
      })
    })

    // ── Step 5: Consistency check (non-blocking) ──────────────────────────────
    // Diagnostic only — cross-reference locked decisions against the generated
    // prose and surface any problems. We do NOT block READY on this yet; the
    // count is logged and carried through to the completion state for visibility.
    const consistency = await step.run('consistency-check', async () => {
      const prompts = await db.generatedPrompt.findMany({
        where:  { projectId, brdVersion },
        select: { sectionNum: true, content: true },
      })
      const sections: Record<string, string> = {}
      for (const p of prompts) sections[p.sectionNum] = p.content

      const problems = checkConsistency({
        lockedDecisions,
        sections,
        expectedSections: orderedNums,
      })

      if (problems.length > 0) {
        logger.warn(
          { projectId, problemCount: problems.length, problems },
          'Consistency check found problems (non-blocking)',
        )
      } else {
        logger.info({ projectId }, 'Consistency check passed — no problems')
      }

      return { problemCount: problems.length }
    })

    // ── Step 6: Mark project READY ────────────────────────────────────────────

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

    // ── Step 7: Notify user ───────────────────────────────────────────────────

    await step.run('notify-user', async () => {
      if (ownerEmail) {
        await sendPromptsReadyEmail(ownerEmail, ownerName, projectName, orderedNums.length, projectId)
      }

      await inngest.send({
        name: 'prompts/generated',
        data: { projectId, sectionCount: orderedNums.length, track, consistencyProblems: consistency.problemCount },
      })

      await setJobState(projectId, {
        status:  'complete',
        percent: 100,
        step:    'done',
        message: 'All prompts are ready!',
        result:  { projectId, sectionCount: orderedNums.length, consistencyProblems: consistency.problemCount },
      })
    })

    return { projectId, sectionsGenerated: orderedNums.length, track, consistencyProblems: consistency.problemCount }
  },
)
