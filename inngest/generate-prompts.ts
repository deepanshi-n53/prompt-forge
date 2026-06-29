import { inngest } from '@/inngest/client'
import { db } from '@/lib/db/prisma'
import { generateSection } from '@/lib/ai/prompt-generator'
import { getTemplatesForTrack } from '@/lib/ai/section-templates'
import type { SectionTemplate } from '@/lib/ai/section-templates'
import { sendPromptsReadyEmail } from '@/lib/email'
import { setJobState, setRunProject } from '@/lib/jobs/redis'
import { emptyDecisions, normalizeDecisions } from '@/lib/ai/brd-parser'
import { CostMeter, addRunToTotal } from '@/lib/ai/cost-estimator'
import { checkConsistency } from '@/lib/ai/consistency-checker'
import { logger } from '@/lib/logger'
import { Prisma, ProjectStatus, Track, PromptStatus } from '@prisma/client'
import type { ArchitectureDecisions, ParsedBRD } from '@/types/brd'
import type { DecisionGraph, SectionDecision } from '@/types/decision'

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

// Max sections generated concurrently within one dependency level. Bounds the
// OpenAI request fan-out (rate limits) and the Inngest parallel-step width.
const GEN_CONCURRENCY = 6

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
    // Headroom for a full (~55-section) FULL-track run. Per-section time is now
    // bounded by the dependency-scoped prompt and per-call timeout (above), so
    // the run no longer creeps toward this ceiling the way the old growing-context
    // cascade did (which hit the previous 15m limit and got cancelled mid-run).
    timeouts: { finish: '30m' },
    triggers: [{ event: 'brd/answered' }],
    // Let the cancel endpoint stop a stuck run: POST /cancel sends
    // `generation/cancel` with the projectId, which aborts this run instead of
    // leaving it hanging until the finish timeout.
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
  async ({ event, step, runId }) => {
    const { projectId, brdId, track: trackRaw, userAnswers } =
      event.data as BRDAnsweredPayload

    const track = trackRaw === 'FAST' ? 'FAST' : 'FULL'

    // Record run → project so the cancellation-cleanup function can map an
    // `inngest/function.cancelled` event (which carries only run_id) back to this
    // project and flip it out of PROCESSING. Memoized so it runs once.
    await step.run('register-run', () => setRunProject(runId, projectId))

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
          // Planning step — no sections generated yet, so 0%. The bar tracks
          // generated sections only (0% at start → 100% when all are done).
          percent: 0,
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
    // This is the seed for the cascade.
    const decisionsRaw = (parsedBRD as unknown as Record<string, unknown>).architectureDecisions
    const decisions: ArchitectureDecisions = decisionsRaw
      ? normalizeDecisions(decisionsRaw as Record<string, unknown>)
      : emptyDecisions()

    // ── Step 2: Select sections in cascade order ──────────────────────────────

    const orderedNums = await step.run('select-sections', async () => {
      const allTemplates = getTemplatesForTrack(track)
      const selected     = selectSections(allTemplates, parsedBRD, track)

      await setJobState(projectId, {
        status:  'running',
        // Still planning — 0% until the first section is generated.
        percent: 0,
        step:    'select-sections',
        message: `Planning ${selected.length} architecture sections in cascade order…`,
      })

      return selected
    })

    // ── Step 3: Cascade generation — level-parallel, decisions flow forward ────

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
    let   completedIdx  = 0

    // Per-section decisions, attributed to the section that emitted them, so a
    // later section can be given ONLY the decisions from its dependency subgraph
    // instead of the whole accumulated graph.
    const sectionDecisions = new Map<string, Record<string, string>>()

    // Resolve the transitive set of section numbers a section depends on by
    // following each template's declared `depends`. Scoping each prompt to this
    // subgraph (plus the fixed foundational seed) keeps prompt size roughly
    // constant across the cascade — instead of growing every section, which made
    // late sections multiple times slower and pushed the run past its timeout.
    const templateByNum = new Map(allTemplates.map((t) => [t.num, t]))
    const depScopeCache = new Map<string, string[]>()
    function dependencyScope(num: string): string[] {
      const cached = depScopeCache.get(num)
      if (cached) return cached
      const seen  = new Set<string>()
      const stack = [...(templateByNum.get(num)?.depends ?? [])]
      while (stack.length) {
        const d = stack.pop()!
        if (seen.has(d)) continue
        seen.add(d)
        stack.push(...(templateByNum.get(d)?.depends ?? []))
      }
      const out = [...seen]
      depScopeCache.set(num, out)
      return out
    }

    // Group the selected sections into dependency levels (Kahn layering): a
    // section joins a level once every one of its `depends` that is ALSO selected
    // has landed in an earlier level. Sections within a level are mutually
    // independent, so a level can be generated in parallel.
    function computeLevels(nums: string[]): string[][] {
      const selected  = new Set(nums)
      const done      = new Set<string>()
      const remaining = new Set(nums)
      const levels: string[][] = []
      while (remaining.size) {
        const batch = [...remaining].filter((n) => {
          const deps = templateByNum.get(n)?.depends ?? []
          return deps.every((d) => !selected.has(d) || done.has(d))
        })
        // Defensive: a cycle / unresolvable dep would yield an empty batch — emit
        // whatever remains as one final level rather than loop forever.
        const layer = batch.length > 0 ? batch : [...remaining]
        layer.sort((a, b) => nums.indexOf(a) - nums.indexOf(b))
        levels.push(layer)
        for (const n of layer) { remaining.delete(n); done.add(n) }
      }
      return levels
    }

    // One meter for the whole run. Each section's cost is folded in OUTSIDE the
    // step callback (callbacks are memoized and don't re-run on replay), so the
    // accumulation stays deterministic — mirroring the lockedDecisions cascade.
    // No constructor model: each call is priced with the model it actually used
    // (usage.model), so the gpt-4o-mini section calls are costed correctly.
    const meter = new CostMeter()

    // NOTE: there are intentionally NO mid-generation pauses. All gap questions
    // (real-time, file storage, compliance, i18n, …) are asked UP FRONT in the
    // setup wizard (see SETUP_FIELDS in gap-analyzer) and merged into `decisions`
    // before generation starts, so a run never blocks on user input — a locked
    // screen or missed modal can no longer time out and cancel the run.

    // Generate ONE section as a memoized step. The decision snapshot (the fixed
    // foundational seed plus ONLY the decisions emitted by sections in this
    // section's dependency subgraph — every earlier level is already folded in)
    // is captured at queue time. The returned shape feeds metering + decision
    // accumulation OUTSIDE the callback (Inngest memoizes returns across replays).
    function generateOne(sectionNum: string, tmpl: SectionTemplate) {
      const seed: Record<string, string> = {
        productPurpose:    parsedBRD.productPurpose    ?? '',
        archetype:         parsedBRD.archetype         ?? '',
        monetizationModel: parsedBRD.monetizationModel ?? '',
        ...flattenDecisions(decisions),
        track,
      }
      const decisionsSnapshot: Record<string, string> = { ...seed }
      for (const dep of dependencyScope(sectionNum)) {
        Object.assign(decisionsSnapshot, sectionDecisions.get(dep) ?? {})
      }

      return step.run(`generate-${sectionNum}`, async () => {
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

        return {
          sectionNum,
          confidence:      result.confidence,
          decisions:       result.decisions ?? {},
          usage:           result.usage ?? null,
          promptChars:     result.promptChars ?? 0,
          completionChars: result.completionChars ?? 0,
        }
      })
    }

    // Generate level by level: independent sections within a level run in
    // parallel (capped at GEN_CONCURRENCY), levels run in order so each section's
    // dependency decisions are already folded into the cascade before it runs.
    const levels = computeLevels(orderedNums)

    for (const level of levels) {
      const sections = level
        .map((num) => ({ num, tmpl: templateByNum.get(num) }))
        .filter((x): x is { num: string; tmpl: SectionTemplate } => x.tmpl != null)
      if (sections.length === 0) continue

      // Generate the level in parallel waves (≤ GEN_CONCURRENCY each), folding
      //    decisions + metering + progress after EACH wave. Per-wave (not
      //    per-level) progress keeps the UI advancing so a wide level never goes
      //    minutes without an update and trips the page's stuck detection.
      for (let i = 0; i < sections.length; i += GEN_CONCURRENCY) {
        const wave = sections.slice(i, i + GEN_CONCURRENCY)
        const results = await Promise.all(wave.map(({ num, tmpl }) => generateOne(num, tmpl)))

        // Fold decisions + meter in deterministic order so a fresh run and any
        // replay accumulate identically. lockedDecisions stays the FULL cascade
        // (the consistency checker reads all of it); sectionDecisions keeps it
        // attributed per-section for the dependency-scoped snapshots.
        for (const r of results) {
          if (r.decisions && Object.keys(r.decisions).length > 0) {
            Object.assign(lockedDecisions, r.decisions)
            sectionDecisions.set(r.sectionNum, r.decisions)
          }
          meter.meter({
            usage:       r.usage,
            inputChars:  r.promptChars,
            outputChars: r.completionChars,
          })
        }

        // Progress — one memoized write per wave (a memoized step so it isn't
        // re-fired on replay).
        completedIdx += wave.length
        const donePercent = Math.round((completedIdx / totalSections) * 100)
        const doneCount   = completedIdx
        const waveTag     = wave[wave.length - 1].num
        await step.run(`progress-${waveTag}`, () =>
          setJobState(projectId, {
            status:  'running',
            percent: donePercent,
            step:    `generate-${waveTag}`,
            message: `Generated sections (${doneCount}/${totalSections})…`,
          }),
        )
      }
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
        // All sections generated → 100%. This is post-generation finalisation,
        // so the bar stays full rather than regressing from the last section.
        percent: 100,
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
