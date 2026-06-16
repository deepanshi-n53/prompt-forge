import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ProjectEmptyState } from '@/components/brd/ProjectEmptyState'
import { UploadBRDSection } from '@/components/brd/UploadBRDSection'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { HealthScore } from '@/components/brd/HealthScore'
import { AssumptionCard, type Assumption } from '@/components/brd/AssumptionCard'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { BRDHealthReport, ParsedBRD } from '@/types'

const STATUS_STYLES: Record<string, string> = {
  PROCESSING: 'bg-blue-50 text-blue-700 border-blue-200',
  PARSED:     'bg-violet-50 text-violet-700 border-violet-200',
  READY:      'bg-green-50 text-green-700 border-green-200',
  ERROR:      'bg-red-50 text-red-700 border-red-200',
  UPDATING:   'bg-amber-50 text-amber-700 border-amber-200',
}

function extractAssumptions(parsedBRD: ParsedBRD, confidence: number): Assumption[] {
  const decisions = parsedBRD.extractedDecisions
  if (!decisions || typeof decisions !== 'object') return []

  const level: Assumption['confidence'] =
    confidence > 0.7 ? 'HIGH' : confidence > 0.4 ? 'MEDIUM' : 'LOW'

  return Object.entries(decisions)
    .slice(0, 5)
    .map(([field, value]) => ({
      field: field.replace(/_/g, ' '),
      inferredValue: typeof value === 'string' ? value : JSON.stringify(value),
      confidence: level,
      reason: `Based on your BRD analysis, I've inferred the ${field.replace(/_/g, ' ')} from the context provided.`,
    }))
}

export default async function ProjectPage({
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
        where: { isActive: true },
        orderBy: { version: 'desc' },
        take: 1,
      },
      prompts: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          sectionNum: true,
          sectionName: true,
          layer: true,
          track: true,
          status: true,
          confidence: true,
          brdVersion: true,
          createdAt: true,
        },
      },
      changeEvents: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })

  if (!project) notFound()

  const activeBrd = project.brds[0] ?? null
  const healthReport = activeBrd?.healthDetail as BRDHealthReport | null
  const parsedBRD = activeBrd?.parsedContent as ParsedBRD | null
  const assumptions = parsedBRD
    ? extractAssumptions(parsedBRD, project.archetypeConfidence ?? 0)
    : []

  const statusStyle = STATUS_STYLES[project.status] ?? STATUS_STYLES.PROCESSING

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* breadcrumb */}
      <nav className="text-sm text-zinc-500">
        <Link href="/dashboard" className="hover:text-zinc-700">Projects</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-800 font-medium">{project.name}</span>
      </nav>

      {/* project header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-zinc-900">{project.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}>
              {project.status}
            </span>
            {project.archetype && (
              <Badge variant="outline" className="capitalize">
                {project.archetype.replace(/-/g, ' ')}
              </Badge>
            )}
            <Badge variant="secondary">{project.track} track</Badge>
          </div>
          {project.description && (
            <p className="text-sm text-zinc-500">{project.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {activeBrd && (
            <UploadBRDSection projectId={project.id} hasActiveBrd={true} />
          )}
          {project.status === 'PARSED' && (
            <Link href={`/project/${project.id}/setup`} className={cn(buttonVariants())}>
              Configure &amp; Generate →
            </Link>
          )}
          {project.status === 'READY' && (
            <Link href={`/project/${project.id}/prompts`} className={cn(buttonVariants())}>
              Review Architecture →
            </Link>
          )}
        </div>
      </div>

      {/* tabs */}
      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="prompts">
            Prompts ({project.prompts.length})
          </TabsTrigger>
          <TabsTrigger value="changes">Changes</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ── overview tab ── */}
        <TabsContent value="overview" className="mt-6">
          {!activeBrd ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8">
              <UploadBRDSection projectId={project.id} hasActiveBrd={false} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* health score */}
              <div className="lg:col-span-1">
                {healthReport ? (
                  <div className="rounded-xl border border-zinc-200 bg-white p-6">
                    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                      BRD Health
                    </h2>
                    <HealthScore report={healthReport} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center">
                    <p className="text-sm text-zinc-500">
                      {project.status === 'PROCESSING'
                        ? 'Analysing your BRD…'
                        : 'Upload a BRD to see the health score'}
                    </p>
                  </div>
                )}
              </div>

              {/* right column: next-step CTA + assumptions + suggestions */}
              <div className="space-y-6 lg:col-span-2">

                {/* ── PARSED: prominent next-step card ── */}
                {project.status === 'PARSED' && (
                  <div className="rounded-xl border border-indigo-200 bg-linear-to-br from-indigo-50 to-violet-50 p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-lg">
                        ✓
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-base font-semibold text-indigo-900">
                          BRD analysed — one step left
                        </h2>
                        <p className="mt-1 text-sm text-indigo-700">
                          Answer 5 quick questions so we can tailor your architecture to your timeline,
                          market, and scale. Takes about 2 minutes.
                        </p>
                        <Link
                          href={`/project/${project.id}/setup`}
                          className={cn(buttonVariants(), 'mt-4')}
                        >
                          Configure &amp; Generate prompts →
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {assumptions.length > 0 && (
                  <div>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                      Key Decisions Inferred
                    </h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {assumptions.map((a) => (
                        <AssumptionCard key={a.field} {...a} />
                      ))}
                    </div>
                  </div>
                )}

                {healthReport && healthReport.recommendations.length > 0 && (
                  <div>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                      Suggestions to Strengthen your BRD
                    </h2>
                    <ul className="space-y-2">
                      {healthReport.recommendations.slice(0, 5).map((rec, i) => (
                        <li key={i} className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          <span>💡</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!healthReport && !assumptions.length && (
                  <ProjectEmptyState projectId={project.id} projectStatus={project.status} />
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── prompts tab ── */}
        <TabsContent value="prompts" className="mt-6">
          {project.prompts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-12 text-center">
              <p className="font-medium text-zinc-700">No prompts generated yet</p>
              <p className="mt-1 text-sm text-zinc-500">
                Prompts are generated automatically after your BRD is parsed.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {project.prompts.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3">
                  <div>
                    <span className="text-sm font-medium text-zinc-800">
                      {p.sectionNum} — {p.sectionName}
                    </span>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">{p.layer}</Badge>
                      <Badge variant="secondary" className="text-xs">{p.status}</Badge>
                    </div>
                  </div>
                  <Link
                    href={`/project/${project.id}/prompts`}
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── changes tab ── */}
        <TabsContent value="changes" className="mt-6">
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-12 text-center">
            <p className="font-medium text-zinc-700">No changes tracked yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Upload a new BRD version to start tracking changes.
            </p>
          </div>
        </TabsContent>

        {/* ── settings tab ── */}
        <TabsContent value="settings" className="mt-6">
          <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900">Project Settings</h3>
            <div className="space-y-1">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Project ID</p>
              <p className="font-mono text-xs text-zinc-600">{project.id}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Track</p>
              <p className="text-sm text-zinc-700">{project.track}</p>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-zinc-400 mb-3">Danger zone</p>
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ variant: 'destructive', size: 'sm' }))}
              >
                ← Back to projects
              </Link>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
