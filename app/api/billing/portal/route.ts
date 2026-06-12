import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createPortalSession } from '@/lib/stripe/stripe'

// POST /api/billing/portal — create a Stripe billing portal session
export async function POST() {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!user.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No billing account found. Subscribe to a plan first.' },
      { status: 404 },
    )
  }

  const portalUrl = await createPortalSession(user.stripeCustomerId)

  return NextResponse.json({ portalUrl })
}
