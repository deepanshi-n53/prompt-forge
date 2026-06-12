import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db/prisma'
import { inngest } from '@/inngest/client'
import { sendAccountDeletionEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const { userId: clerkId, sessionId } = await auth()
  if (!clerkId || !sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  if (body.confirmation !== 'DELETE') {
    return NextResponse.json(
      { error: 'Confirmation required. Send { "confirmation": "DELETE" }' },
      { status: 422 },
    )
  }

  const user = await db.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Guard: only one pending deletion request per user
  const existing = await db.deletionRequest.findUnique({ where: { userId: user.id } })
  if (existing) {
    return NextResponse.json(
      { error: 'A deletion request already exists', scheduledFor: existing.scheduledFor },
      { status: 409 },
    )
  }

  const scheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await db.deletionRequest.create({
    data: { userId: user.id, scheduledFor },
  })

  // Revoke current session immediately so the user is signed out
  const clerk = await clerkClient()
  await clerk.sessions.revokeSession(sessionId).catch((err: unknown) => {
    console.error('[gdpr] Failed to revoke Clerk session', { sessionId, err })
  })

  logger.info(
    { userId: user.id, clerkId, scheduledFor, action: 'account.deletion-requested' },
    'Account deletion requested',
  )

  void sendAccountDeletionEmail(user.email, user.name ?? '')

  await inngest.send({
    name: 'user/deletion-requested',
    data: { userId: user.id, clerkId },
    ts:   Date.now() + 30 * 24 * 60 * 60 * 1000,
  })

  return NextResponse.json({ ok: true, scheduledFor })
}
