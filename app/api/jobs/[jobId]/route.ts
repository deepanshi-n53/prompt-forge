import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getJobState } from '@/lib/jobs/redis'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ jobId: string }> }

export async function GET(_request: NextRequest, { params }: Context) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { jobId } = await params
  const state = await getJobState(jobId)

  return NextResponse.json({ state })
}
