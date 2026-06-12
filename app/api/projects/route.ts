import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { Prisma, Plan, ProjectStatus } from '@prisma/client'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { createProjectSchema } from '@/lib/validations'

const PAGE_SIZE = 20

export async function GET(request: NextRequest) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const q = searchParams.get('q')?.trim() || undefined
  const rawStatus = searchParams.get('status')
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10))

  const validStatus =
    rawStatus && (Object.values(ProjectStatus) as string[]).includes(rawStatus)
      ? (rawStatus as ProjectStatus)
      : undefined

  const where: Prisma.ProjectWhereInput = { ownerId: user.id }
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
          where:   { isActive: true },
          orderBy: { version: 'desc' },
          take:    1,
          select:  { id: true, healthScore: true, status: true },
        },
        prompts: { select: { id: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take:    PAGE_SIZE,
      skip:    page * PAGE_SIZE,
    }),
    db.project.count({ where }),
  ])

  return NextResponse.json({
    projects: projects.map((p) => ({
      id:                 p.id,
      name:               p.name,
      description:        p.description,
      status:             p.status,
      archetype:          p.archetype,
      archetypeConfidence: p.archetypeConfidence,
      track:              p.track,
      createdAt:          p.createdAt,
      updatedAt:          p.updatedAt,
      promptCount:        p.prompts.length,
      latestBrd:          p.brds[0] ?? null,
    })),
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
  })
}

export async function POST(request: NextRequest) {
  // orgId must come from JWT claims, not the request body
  const { userId: clerkId, orgId: clerkOrgId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  if (user.plan === Plan.FREE) {
    const count = await db.project.count({ where: { ownerId: user.id } })
    if (count >= 1) {
      return NextResponse.json(
        {
          code:       'PLAN_LIMIT_REACHED',
          upgradeUrl: '/pricing',
          message:    'Free plan allows 1 project. Upgrade to create more.',
        },
        { status: 403 },
      )
    }
  }

  // Resolve DB orgId from Clerk's active org claim
  let resolvedOrgId: string | undefined
  if (clerkOrgId) {
    const org = await db.organisation.findUnique({
      where:  { clerkOrgId },
      select: { id: true },
    })
    resolvedOrgId = org?.id
  }

  const project = await db.project.create({
    data: {
      name:        parsed.data.name,
      description: parsed.data.description,
      ownerId:     user.id,
      orgId:       resolvedOrgId,
    },
  })

  return NextResponse.json({ project }, { status: 201 })
}
