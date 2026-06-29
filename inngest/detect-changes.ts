import { inngest } from '@/inngest/client'
import { db } from '@/lib/db/prisma'
import { extractTextFromStorage } from '@/lib/ai/text-extractor'
import {
  extractArchitectureDecisions,
  decisionsToParsedBRD,
  normalizeDecisions,
  mergeDecisionsPreferringPrior,
} from '@/lib/ai/brd-parser'
import { detectChanges } from '@/lib/ai/change-detector'
import { setJobState } from '@/lib/jobs/redis'
import { Prisma, BRDStatus, ChangeEventStatus } from '@prisma/client'
import { sendChangeDetectedEmail } from '@/lib/email'
import type { DecisionGraph, SectionDecision, ChangeAnalysis } from '@/types/decision'

interface BRDChangedPayload {
  projectId:     string
  oldBrdId:      string
  newBrdId:      string
  changeEventId: string
}

export const detectChangesJob = inngest.createFunction(
  {
    id:       'detect-changes',
    retries:  3,
    timeouts: { finish: '5m' },
    triggers: [{ event: 'brd/changed' }],
    onFailure: async ({ event }) => {
      const { projectId, changeEventId } = (
        event.data as { event: { data: BRDChangedPayload } }
      ).event.data
      await Promise.all([
        db.changeEvent.update({
          where: { id: changeEventId },
          data:  { status: ChangeEventStatus.DISMISSED },
        }),
        setJobState(projectId, {
          status:  'failed',
          percent: 0,
          step:    'error',
          message: 'Change detection failed. Please try again.',
          error:   'Unable to analyse BRD changes.',
        }),
      ])
    },
  },
  async ({ event, step }) => {
    const { projectId, oldBrdId, newBrdId, changeEventId } =
      event.data as BRDChangedPayload

    // ── Step 1: load texts ──────────────────────────────────────────────────
    const { oldText, newStoragePath, newMimeType, ownerEmail, ownerName, projectName } = await step.run(
      'load-texts',
      async () => {
        const [oldBrd, newBrd, project] = await Promise.all([
          db.bRD.findUnique({
            where:  { id: oldBrdId },
            select: { rawText: true },
          }),
          db.bRD.findUnique({
            where:  { id: newBrdId },
            select: { storagePath: true, mimeType: true },
          }),
          db.project.findUnique({
            where:  { id: projectId },
            select: { name: true, owner: { select: { email: true, name: true } } },
          }),
        ])

        await setJobState(projectId, {
          status:  'running',
          percent: 10,
          step:    'load-texts',
          message: 'Loading BRD documents…',
        })

        return {
          oldText:        oldBrd?.rawText ?? '',
          newStoragePath: newBrd?.storagePath ?? '',
          newMimeType:    newBrd?.mimeType ?? 'text/plain',
          ownerEmail:     project?.owner?.email ?? '',
          ownerName:      project?.owner?.name  ?? '',
          projectName:    project?.name         ?? '',
        }
      },
    )

    // ── Step 2: extract text from new BRD ───────────────────────────────────
    const newText = await step.run('extract-new-text', async () => {
      const text = await extractTextFromStorage(newStoragePath, newMimeType)

      await db.bRD.update({
        where: { id: newBrdId },
        data:  { rawText: text },
      })

      await setJobState(projectId, {
        status:  'running',
        percent: 22,
        step:    'extract-new-text',
        message: 'Extracting updated document text…',
      })

      return text
    })

    // ── Step 3: parse new BRD with AI ───────────────────────────────────────
    // Rich extraction of the NEW text, merged on top of the PREVIOUS version's
    // stored decisions (which carry the user's confirmed gap answers at full
    // confidence). This is what stops a re-upload from re-asking already-answered
    // setup questions: only fields the new BRD genuinely changed — or that were
    // never answered — fall back below threshold. Persisted in the same
    // { ...legacy, architectureDecisions } shape the first-upload parse writes,
    // so both the setup wizard and generate-delta-prompts read it correctly.
    await step.run('parse-new-brd', async () => {
      const fresh = await extractArchitectureDecisions(newText)

      const oldBrd = await db.bRD.findUnique({
        where:  { id: oldBrdId },
        select: { parsedContent: true },
      })
      const priorRaw = (oldBrd?.parsedContent as Record<string, unknown> | null)
        ?.architectureDecisions
      const merged = priorRaw
        ? mergeDecisionsPreferringPrior(
            normalizeDecisions(priorRaw as Record<string, unknown>),
            fresh,
          )
        : fresh

      const parsedContent = {
        ...decisionsToParsedBRD(merged),
        architectureDecisions: merged,
      }

      await db.bRD.update({
        where: { id: newBrdId },
        data: {
          status:        BRDStatus.PARSED,
          parsedContent: parsedContent as unknown as Prisma.InputJsonValue,
        },
      })

      await setJobState(projectId, {
        status:  'running',
        percent: 42,
        step:    'parse-new-brd',
        message: 'Parsing updated requirements…',
      })

      return merged
    })

    // ── Step 4: load decisions ──────────────────────────────────────────────
    const decisions = await step.run('load-decisions', async () => {
      const graphRecord = await db.decisionGraph.findUnique({ where: { projectId } })

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
        percent: 52,
        step:    'load-decisions',
        message: 'Loading architectural decisions…',
      })

      return graph
    })

    // ── Step 5: diff with Claude ────────────────────────────────────────────
    const analysis: ChangeAnalysis = await step.run('diff-with-claude', async () => {
      await setJobState(projectId, {
        status:  'running',
        percent: 58,
        step:    'diff-with-claude',
        message: 'Analysing semantic changes…',
      })

      const result = await detectChanges(
        oldText || '(no previous text available)',
        newText,
        decisions,
      )

      await setJobState(projectId, {
        status:  'running',
        percent: 82,
        step:    'diff-with-claude',
        message: `Found ${result.impactedSections.length} impacted section${result.impactedSections.length !== 1 ? 's' : ''}…`,
      })

      return result
    })

    // ── Step 6: save change event ───────────────────────────────────────────
    await step.run('save-change-event', async () => {
      await db.changeEvent.update({
        where: { id: changeEventId },
        data: {
          changeAnalysis: analysis as unknown as Prisma.InputJsonValue,
          status:         ChangeEventStatus.PENDING,
        },
      })

      await setJobState(projectId, {
        status:  'running',
        percent: 93,
        step:    'save-change-event',
        message: 'Saving change analysis…',
      })
    })

    // ── Step 7: notify ──────────────────────────────────────────────────────
    await step.run('notify-user', async () => {
      const breakingCount = analysis.impactedSections.filter(
        (s) => s.impactLevel === 'BREAKING',
      ).length

      await Promise.all([
        ownerEmail
          ? sendChangeDetectedEmail(ownerEmail, ownerName, projectName, breakingCount, projectId)
          : Promise.resolve(),
        inngest.send({
          name: 'changes/detected',
          data: {
            projectId,
            changeEventId,
            isBreaking:   analysis.isBreaking,
            impactCount:  analysis.impactedSections.length,
            breakingCount,
          },
        }),
        setJobState(projectId, {
          status:  'complete',
          percent: 100,
          step:    'done',
          message: analysis.isBreaking
            ? `${breakingCount} breaking change${breakingCount !== 1 ? 's' : ''} detected — review required`
            : `${analysis.impactedSections.length} section${analysis.impactedSections.length !== 1 ? 's' : ''} to review`,
          result: {
            changeEventId,
            isBreaking:  analysis.isBreaking,
            impactCount: analysis.impactedSections.length,
          },
        }),
      ])
    })

    return {
      changeEventId,
      isBreaking:  analysis.isBreaking,
      impactCount: analysis.impactedSections.length,
    }
  },
)
