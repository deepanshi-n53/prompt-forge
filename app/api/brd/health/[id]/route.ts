import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import type { BRDHealthReport } from '@/types'
import { BRDStatus } from '@prisma/client'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const brd = await db.bRD.findUnique({
    where: { id },
    include: { project: { select: { ownerId: true } } },
  })

  if (!brd) {
    return NextResponse.json({ error: 'BRD not found' }, { status: 404 })
  }

  if (brd.project.ownerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (brd.status === BRDStatus.PENDING) {
    return NextResponse.json({ status: 'processing' }, { status: 202 })
  }

  if (brd.status === BRDStatus.FAILED) {
    return NextResponse.json({ error: 'BRD parsing failed' }, { status: 422 })
  }

  // PARSED — return health data
  const healthDetail = brd.healthDetail as BRDHealthReport | null

  return NextResponse.json({
    brdId: brd.id,
    status: brd.status,
    healthScore: brd.healthScore ?? 0,
    dimensions: healthDetail?.dimensions ?? [],
    gaps: healthDetail?.gaps ?? [],
    recommendations: healthDetail?.recommendations ?? [],
  })
}
