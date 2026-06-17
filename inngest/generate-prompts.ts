import { inngest } from '@/inngest/client'
import { db } from '@/lib/db/prisma'
import { generateSection } from '@/lib/ai/prompt-generator'
import { getTemplatesForTrack } from '@/lib/ai/section-templates'
import type { SectionTemplate } from '@/lib/ai/section-templates'
import { sendPromptsReadyEmail } from '@/lib/email'
import { setJobState } from '@/lib/jobs/redis'
import { applyAnswersToDecisions, emptyDecisions, normalizeDecisions } from '@/lib/ai/brd-parser'
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
  mfaRequired: {
    question: 'Does your app require multi-factor authentication (MFA)?',
    subtitle: 'Required for healthcare, fintech, or enterprise apps.',
    inputType: 'select',
    options: [
      { value: 'true',  label: 'Yes — MFA required', description: 'Enforce a second factor (TOTP, SMS, or passkey)' },
      { value: 'false', label: 'No — optional',       description: 'Password + social login is sufficient at launch' },
    ],
    defaultValue: 'false',
  },
  paymentProvider: {
    question: 'Which payment provider will you use?',
    subtitle: 'Your core features suggest payments — this shapes §12 integrations and billing.',
    inputType: 'select',
    options: [
      { value: 'Stripe',   label: 'Stripe',         description: 'Global cards, subscriptions, Connect for marketplaces' },
      { value: 'Razorpay', label: 'Razorpay',       description: 'India-first — UPI, cards, netbanking' },
      { value: 'PayPal',   label: 'PayPal',         description: 'PayPal balance + cards' },
      { value: 'none',     label: 'Not needed yet', description: 'No payments at launch' },
    ],
    defaultValue: 'Stripe',
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
  dbEngine: {
    question: 'Which primary database should this app use?',
    subtitle: 'No database preference was found in the BRD — this locks §05 and §07.',
    inputType: 'select',
    options: [
      { value: 'PostgreSQL', label: 'PostgreSQL', description: 'Relational — the safe default for most apps' },
      { value: 'MySQL',      label: 'MySQL',      description: 'Relational alternative' },
      { value: 'MongoDB',    label: 'MongoDB',    description: 'Document store for flexible schemas' },
      { value: 'SQLite',     label: 'SQLite',     description: 'Embedded — small or single-node apps' },
    ],
    defaultValue: 'PostgreSQL',
  },
  cacheLayer: {
    question: 'Which caching layer should the app use?',
    subtitle: 'No caching strategy was found in the BRD — this locks §05.',
    inputType: 'select',
    options: [
      { value: 'Redis',     label: 'Redis',     description: 'In-memory cache + sessions + queues' },
      { value: 'Memcached', label: 'Memcached', description: 'Lightweight in-memory cache' },
      { value: 'none',      label: 'None',      description: 'No cache layer at launch' },
    ],
    defaultValue: 'Redis',
  },
  searchEngine: {
    question: 'How should search be powered?',
    subtitle: 'No search approach was found in the BRD — this locks §05.',
    inputType: 'select',
    options: [
      { value: 'pg-fulltext',   label: 'Postgres full-text', description: 'Built-in — good enough for most apps' },
      { value: 'Algolia',       label: 'Algolia',            description: 'Hosted, typo-tolerant instant search' },
      { value: 'Elasticsearch', label: 'Elasticsearch',      description: 'Self-hosted, large-scale search' },
      { value: 'none',          label: 'None',               description: 'No search at launch' },
    ],
    defaultValue: 'pg-fulltext',
  },
  apiStyle: {
    question: 'Which API style should the backend expose?',
    subtitle: 'No API style was found in the BRD — this locks §08.',
    inputType: 'select',
    options: [
      { value: 'REST',    label: 'REST',    description: 'Resource endpoints — the broad default' },
      { value: 'GraphQL', label: 'GraphQL', description: 'Single typed graph endpoint' },
      { value: 'tRPC',    label: 'tRPC',    description: 'End-to-end typed RPC (TS-only stacks)' },
    ],
    defaultValue: 'REST',
  },
  multiTenant: {
    question: 'Is this a multi-tenant (B2B) application?',
    subtitle: 'No tenancy model was found in the BRD — this locks §05.',
    inputType: 'select',
    options: [
      { value: 'true',  label: 'Yes — multi-tenant', description: 'Multiple organisations share one deployment' },
      { value: 'false', label: 'No — single tenant', description: 'One pool of users, no org isolation' },
    ],
    defaultValue: 'false',
  },
  authMethod: {
    question: 'Which authentication strategy should the app use?',
    subtitle: 'No auth method was found in the BRD — this locks §06.',
    inputType: 'select',
    options: [
      { value: 'JWT',           label: 'JWT (Bearer tokens)', description: 'Stateless bearer tokens' },
      { value: 'sessions',      label: 'Server sessions',     description: 'Cookie-backed server sessions' },
      { value: 'opaque-tokens', label: 'Opaque tokens',       description: 'Reference tokens checked server-side' },
    ],
    defaultValue: 'JWT',
  },
  platform: {
    question: 'Which platform is this app for?',
    subtitle: 'No platform was found in the BRD — this changes which sections are generated.',
    inputType: 'select',
    options: [
      { value: 'web',    label: 'Web',           description: 'Browser-based app' },
      { value: 'mobile', label: 'Mobile',        description: 'iOS / Android app' },
      { value: 'both',   label: 'Web + mobile',  description: 'Both platforms' },
    ],
    defaultValue: 'web',
  },
  appType: {
    question: 'What type of app is this?',
    subtitle: 'No app type was found in the BRD — this anchors the whole architecture.',
    inputType: 'select',
    options: [
      { value: 'b2b-saas',     label: 'B2B SaaS',     description: 'Business software, organisations as customers' },
      { value: 'marketplace',  label: 'Marketplace',  description: 'Two-sided buyers + sellers' },
      { value: 'ecommerce',    label: 'E-commerce',   description: 'Online store / catalogue + checkout' },
      { value: 'consumer',     label: 'Consumer app', description: 'Direct-to-user product' },
    ],
    defaultValue: 'b2b-saas',
  },
}

// Map the template-domain owns[] keys onto ArchitectureDecisions fields, so a
// section whose owned decision is completely absent (confidence 0) can pause.
const OWNED_TO_AD: Record<string, string> = {
  dbEngine:     'dbEngine',
  cacheLayer:   'cacheLayer',
  searchEngine: 'searchEngine',
  apiStyle:     'apiStyle',
  multiTenant:  'multiTenant',
  authModel:    'authMethod',
  platform:     'platform',
  appType:      'appType',
}

function paymentsLikely(d: ArchitectureDecisions): boolean {
  if (['marketplace', 'ecommerce', 'fintech', 'booking'].includes(d.appType ?? '')) return true
  const text = [...d.coreFeatures, ...d.coreUserJourneys].join(' ').toLowerCase()
  return /pay|payment|checkout|subscrib|billing|purchase|\bbuy\b|\bsell\b|order|invoice|wallet|transaction/.test(text)
}

const BOOL_PAUSE_FIELDS = new Set(['needsRealtime', 'mfaRequired', 'multiTenant'])

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

    const conf = (field: string): number => decisions.confidence[field] ?? 0
    const isEmpty = (field: string): boolean => {
      const v = (decisions as unknown as Record<string, unknown>)[field]
      return v == null || (Array.isArray(v) && v.length === 0)
    }

    // Decide which (single) pause, if any, this section needs before generating.
    function pickPause(sectionNum: string, tmpl: SectionTemplate): string | null {
      // Rule 2 — §20 ALWAYS confirms compliance.
      if (sectionNum === '20' && !handled.has('compliance')) return 'compliance'

      // Rule 1 — §09 real-time when unknown or low confidence.
      if (sectionNum === '09' && !handled.has('needsRealtime') &&
          (decisions.needsRealtime === null || conf('needsRealtime') < 0.5)) return 'needsRealtime'

      // Rule 3 — §06 MFA when unknown.
      if (sectionNum === '06' && !handled.has('mfaRequired') &&
          decisions.mfaRequired === null) return 'mfaRequired'

      // Rule 4 — §12 payment provider when unknown but features imply payments.
      if (sectionNum === '12' && !handled.has('paymentProvider') &&
          decisions.paymentProvider === null && paymentsLikely(decisions)) return 'paymentProvider'

      // Rule 5 — any owned field that is completely absent (confidence 0).
      for (const owned of tmpl.owns ?? []) {
        const adField = OWNED_TO_AD[owned]
        if (!adField || handled.has(adField) || !PAUSE_SPECS[adField]) continue
        if (isEmpty(adField) && conf(adField) === 0) return adField
      }
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
      const pauseField = pickPause(sectionNum, tmpl)
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
