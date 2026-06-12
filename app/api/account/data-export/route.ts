import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { clerkId },
    include: {
      projects: {
        include: {
          brds: {
            select: {
              id: true,
              version: true,
              fileName: true,
              fileSize: true,
              mimeType: true,
              status: true,
              healthScore: true,
              isActive: true,
              uploadedAt: true,
              // rawText and parsedContent are excluded — potentially large / sensitive
            },
          },
          prompts: {
            select: {
              id: true,
              sectionNum: true,
              sectionName: true,
              layer: true,
              track: true,
              status: true,
              brdVersion: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          changeEvents: {
            select: {
              id: true,
              status: true,
              appliedAt: true,
              createdAt: true,
            },
          },
        },
      },
    },
  })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const exportDate = new Date().toISOString().split('T')[0]

  const payload = {
    exportedAt: new Date().toISOString(),
    profile: {
      id:        user.id,
      email:     user.email,
      name:      user.name,
      avatarUrl: user.avatarUrl,
      plan:      user.plan,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    projects: user.projects.map((p) => ({
      id:          p.id,
      name:        p.name,
      description: p.description,
      status:      p.status,
      archetype:   p.archetype,
      track:       p.track,
      createdAt:   p.createdAt,
      updatedAt:   p.updatedAt,
      brds:        p.brds,
      prompts:     p.prompts,
      changeEvents: p.changeEvents,
    })),
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type':        'application/json',
      'Content-Disposition': `attachment; filename="promptforge-data-export-${exportDate}.json"`,
    },
  })
}
