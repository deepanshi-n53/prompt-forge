import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import {
  stripe,
  createCustomer,
  createCheckoutSession,
  PRICE_IDS,
} from '@/lib/stripe/stripe'
import { Plan } from '@prisma/client'

const checkoutSchema = z.object({
  plan: z.enum(['PROFESSIONAL', 'AGENCY', 'ENTERPRISE'] as const),
})

// POST /api/billing/checkout — create a Stripe checkout session
export async function POST(request: NextRequest) {
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

  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const plan: Exclude<Plan, 'FREE'> = parsed.data.plan

  const priceId = PRICE_IDS[plan]
  if (!priceId) {
    return NextResponse.json(
      { error: `No price configured for plan ${plan}` },
      { status: 503 },
    )
  }

  // Ensure the user has a Stripe customer record
  let customerId = user.stripeCustomerId

  if (!customerId) {
    // Verify the user still exists with their current email
    const fullUser = await db.user.findUnique({
      where:  { id: user.id },
      select: { email: true, name: true },
    })
    const email = fullUser?.email ?? user.email
    const name  = fullUser?.name  ?? user.name ?? email

    customerId = await createCustomer(email, name ?? email)

    await db.user.update({
      where: { id: user.id },
      data:  { stripeCustomerId: customerId },
    })
  } else {
    // Keep Stripe customer email in sync
    const fullUser = await db.user.findUnique({
      where:  { id: user.id },
      select: { email: true, name: true },
    })
    if (fullUser) {
      await stripe.customers.update(customerId, {
        email: fullUser.email,
        name:  fullUser.name ?? fullUser.email,
      })
    }
  }

  const checkoutUrl = await createCheckoutSession(customerId, priceId, user.id)

  return NextResponse.json({ checkoutUrl })
}
