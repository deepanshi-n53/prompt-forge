import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { PromptBrowser } from './_components/PromptBrowser'
import { PromptsLiveControls } from './_components/PromptsLiveControls'
import { FirstPromptsSuccess } from '@/components/prompts/FirstPromptsSuccess'
import type { PromptLayer } from './_components/PromptBrowser'
import type { ParsedBRD } from '@/types/brd'
import type { SectionDecision } from '@/types/decision'

// Always read fresh from the DB — caching the RSC is what made a freshly-finished
// project render with zero sections (stale pre-generation snapshot).
export const dynamic = 'force-dynamic'

export default async function PromptsPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ onboarding?: string }>
}) {
  const user = await requireAuth()
  const { id }         = await params
  const { onboarding } = await searchParams
  const isFirstTime    = onboarding === '1'

  const [project, decisionRecord, activeBrd] = await Promise.all([
    db.project.findFirst({
      where: { id, ownerId: user.id },
      select: { id: true, name: true, description: true, status: true, track: true, archetype: true, updatedAt: true },
    }),
    db.decisionGraph.findUnique({
      where: { projectId: id },
      select: { decisions: true },
    }),
    db.bRD.findFirst({
      where: { projectId: id, isActive: true },
      orderBy: { version: 'desc' },
      select: { parsedContent: true },
    }),
  ])

  if (!project) notFound()

  const prompts = await db.generatedPrompt.findMany({
    where:   { projectId: id },
    orderBy: [{ layer: 'asc' }, { sectionNum: 'asc' }],
    select: {
      id:          true,
      sectionNum:  true,
      sectionName: true,
      layer:       true,
      track:       true,
      status:      true,
      confidence:  true,
      assumptions: true,
      brdVersion:  true,
      updatedAt:   true,
    },
  })

  // Group by layer for the browser
  const byLayer: Record<string, typeof prompts> = {}
  for (const p of prompts) {
    if (!byLayer[p.layer]) byLayer[p.layer] = []
    byLayer[p.layer].push(p)
  }

  const layers: PromptLayer[] = Object.entries(byLayer).map(([layer, items]) => ({
    layer,
    prompts: items.map((p) => ({
      id:              p.id,
      sectionNum:      p.sectionNum,
      sectionName:     p.sectionName,
      layer:           p.layer,
      status:          p.status,
      confidence:      p.confidence,
      assumptionCount: Array.isArray(p.assumptions) ? p.assumptions.length : 0,
      brdVersion:      p.brdVersion,
      updatedAt:       p.updatedAt.toISOString(),
    })),
  }))

  const sections = (decisionRecord?.decisions ?? {}) as unknown as Record<string, SectionDecision>
  const parsedBRD = (activeBrd?.parsedContent ?? {}) as unknown as ParsedBRD

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Live polling while PROCESSING + a debug panel toggle */}
      <PromptsLiveControls
        projectId={id}
        status={project.status}
        sectionCount={prompts.length}
        lastUpdated={project.updatedAt.toISOString()}
      />

      {/* top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href={`/project/${id}`} className="text-sm text-zinc-400 hover:text-zinc-600">
            ← {project.name}
          </Link>
          <span className="text-zinc-200">/</span>
          <span className="text-sm font-medium text-zinc-800">Prompts</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">
            {prompts.length} section{prompts.length !== 1 ? 's' : ''} · {project.track} track
          </span>
          {project.status !== 'READY' && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              {project.status}
            </span>
          )}
        </div>
      </header>

      {/* first-time success banner */}
      {isFirstTime && prompts.length > 0 && <FirstPromptsSuccess />}

      {/* content */}
      {prompts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-4">
          {project.status === 'PROCESSING' ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl animate-pulse">⚙</div>
              <div>
                <p className="text-sm font-semibold text-zinc-800">Generation in progress</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Your prompts are being generated. This can take 60–120 seconds.
                </p>
              </div>
              <Link
                href={`/project/${id}/generating?jobId=${id}`}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Watch progress →
              </Link>
            </>
          ) : project.status === 'ERROR' ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">✕</div>
              <div>
                <p className="text-sm font-semibold text-zinc-800">Generation failed</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Something went wrong during generation. You can retry from setup.
                </p>
              </div>
              <Link
                href={`/project/${id}/setup`}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Retry from setup →
              </Link>
            </>
          ) : project.status === 'READY' ? (
            /* Finished, but nothing was saved — the dreaded "0 sections" case. */
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-2xl">⚠</div>
              <div>
                <p className="text-sm font-semibold text-zinc-800">Generation completed but prompts are missing</p>
                <p className="mt-1 text-xs text-zinc-400 max-w-xs mx-auto">
                  The project is marked ready, but no sections were saved. Click to regenerate.
                </p>
              </div>
              <Link
                href={`/project/${id}/setup`}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Regenerate →
              </Link>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-50 text-2xl">◻</div>
              <div>
                <p className="text-sm font-semibold text-zinc-800">No prompts yet</p>
                <p className="mt-1 text-xs text-zinc-400 max-w-xs mx-auto">
                  Complete the setup wizard to generate your {project.track === 'FAST' ? 'Fast Track' : 'Full'} architecture prompts.
                </p>
                <p className="mt-1 text-[10px] text-zinc-300">Project status: {project.status}</p>
              </div>
              <Link
                href={`/project/${id}/setup`}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Start setup →
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <PromptBrowser
            projectId={id}
            projectMeta={{
              id:          project.id,
              name:        project.name,
              description: project.description,
              archetype:   project.archetype,
              track:       project.track,
            }}
            layers={layers}
            track={project.track}
            decisionSections={sections}
            parsedBRD={parsedBRD}
          />
        </div>
      )}
    </div>
  )
}
