import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { getSetupQuestions, buildInsights, summarizeConfidence } from '@/lib/ai/gap-analyzer'
import { emptyDecisions, normalizeDecisions, hasAnyDecision } from '@/lib/ai/brd-parser'
import { Wizard } from './_components/Wizard'
import { RetryBanner } from './_components/RetryBanner'
import { AnalysingBRD } from './_components/AnalysingBRD'

export default async function SetupPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireAuth()
  const { id } = await params

  const project = await db.project.findFirst({
    where: { id, ownerId: user.id },
    include: {
      brds: {
        where:   { isActive: true },
        orderBy: { version: 'desc' },
        take:    1,
        select:  { parsedContent: true },
      },
      // The parser writes the same rich ArchitectureDecisions to the project's
      // DecisionGraph too — used as a fallback when the BRD's embedded copy is
      // missing or empty (e.g. an older or partially-broken parse).
      decisions: { select: { decisions: true } },
    },
  })

  if (!project) notFound()

  if (project.status === 'READY') redirect(`/project/${id}/prompts`)

  // Parsing not finished yet — the decisions aren't populated, so rendering the
  // wizard now would show an all-blank "Unknown" state and ask every question.
  // Show a loading state that polls and refreshes once parse completes (PARSED),
  // then this server component re-runs and falls through to the wizard below.
  if (project.status === 'PARSING' || project.status === 'UPDATING') {
    return <AnalysingBRD projectId={id} />
  }

  // Resolve the rich decision set, preferring whichever source is actually
  // populated. The parser embeds it in the active BRD's parsedContent AND in the
  // DecisionGraph; both share the ArchitectureDecisions shape, so both go through
  // normalizeDecisions. We prefer the BRD copy (the DecisionGraph is later
  // repurposed to hold the section-decision map once the wizard is submitted),
  // and fall back to the DecisionGraph only when the BRD copy has no decisions.
  const parsedContent = (project.brds[0]?.parsedContent ?? {}) as Record<string, unknown>
  const fromBRD = parsedContent.architectureDecisions
    ? normalizeDecisions(parsedContent.architectureDecisions as Record<string, unknown>)
    : null

  const graphRaw  = (project.decisions?.decisions ?? null) as Record<string, unknown> | null
  const fromGraph = graphRaw ? normalizeDecisions(graphRaw) : null

  const decisions =
    fromBRD   && hasAnyDecision(fromBRD)   ? fromBRD
    : fromGraph && hasAnyDecision(fromGraph) ? fromGraph
    : fromBRD ?? fromGraph ?? emptyDecisions()

  // The user's remembered cross-project preferences (db engine, compliance, …)
  // pre-fill any gap question this BRD didn't infer — shown as an editable
  // "from your previous answers" default, never applied silently.
  const defaultRows = await db.userAnswerDefault.findMany({
    where:  { userId: user.id },
    select: { field: true, value: true },
  })
  const answerDefaults: Record<string, string> = {}
  for (const row of defaultRows) answerDefaults[row.field] = row.value

  const insightGroups = buildInsights(decisions)
  const gapQuestions  = getSetupQuestions(decisions, answerDefaults)
  const { confirmed, inferred, unknown } = summarizeConfidence(decisions)

  return (
    <>
      {project.status === 'ERROR' && <RetryBanner projectId={id} />}
      <Wizard
        projectId={id}
        projectName={project.name}
        insightGroups={insightGroups}
        gapQuestions={gapQuestions}
        confirmed={confirmed}
        inferred={inferred}
        unknown={unknown}
      />
    </>
  )
}
