import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Prisma, ProjectStatus } from '@prisma/client'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { ProjectCard } from '@/components/shared/ProjectCard'
import type { ProjectSummary } from '@/components/shared/ProjectCard'
import { FilterTabs, ProjectSearch, NewProjectButton } from './_components/Controls'
import DashboardLoading from './loading'

const PAGE_SIZE = 20

async function fetchProjects(userId: string, q?: string, status?: string, page = 0) {
  const validStatus =
    status && (Object.values(ProjectStatus) as string[]).includes(status)
      ? (status as ProjectStatus)
      : undefined

  const where: Prisma.ProjectWhereInput = { ownerId: userId }
  if (validStatus) where.status = validStatus
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ]
  }

  const [projects, total] = await Promise.all([
    db.project.findMany({
      where,
      include: {
        brds: {
          where: { isActive: true },
          orderBy: { version: 'desc' },
          take: 1,
          select: { id: true, healthScore: true, status: true },
        },
        prompts: { select: { id: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: PAGE_SIZE,
      skip: page * PAGE_SIZE,
    }),
    db.project.count({ where }),
  ])

  return {
    projects: projects.map((p): ProjectSummary => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      archetype: p.archetype,
      archetypeConfidence: p.archetypeConfidence,
      track: p.track,
      updatedAt: p.updatedAt,
      promptCount: p.prompts.length,
      latestBrd: p.brds[0] ?? null,
    })),
    total,
    pages: Math.ceil(total / PAGE_SIZE),
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const user = await requireAuth()

  // First-time user — show the onboarding wizard
  if (user.isNewUser) redirect('/onboarding')

  const { q, status, page: pageStr } = await searchParams
  const page = Math.max(0, parseInt(pageStr ?? '0', 10))

  const { projects, total } = await fetchProjects(user.id, q, status, page)

  return (
    <div className="p-6 space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Projects</h1>
          <p className="text-sm text-zinc-500">{total} project{total !== 1 ? 's' : ''}</p>
        </div>
        <Suspense>
          <NewProjectButton />
        </Suspense>
      </div>

      {/* search + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <Suspense>
          <ProjectSearch />
        </Suspense>
        <Suspense>
          <FilterTabs />
        </Suspense>
      </div>

      {/* project list */}
      {projects.length === 0 ? (
        q || status ? (
          /* filtered empty — minimal */
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 py-16 text-center">
            <p className="text-base font-semibold text-zinc-700">No projects match your search</p>
            <p className="mt-1 text-sm text-zinc-500">Try a different search or filter</p>
          </div>
        ) : (
          /* first-time empty state */
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 py-20 text-center space-y-5">
            {/* icon */}
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
              <svg className="size-8 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold text-zinc-900">Upload your first BRD</p>
              <p className="mt-1 text-sm text-zinc-500 max-w-xs mx-auto">
                Create a project, upload your BRD, and get 55 production-ready architecture prompts in minutes.
              </p>
            </div>
            <Suspense>
              <NewProjectButton />
            </Suspense>
          </div>
        )
      ) : (
        <Suspense fallback={<DashboardLoading />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </Suspense>
      )}
    </div>
  )
}
