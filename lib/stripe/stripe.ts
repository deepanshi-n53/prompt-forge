import Stripe from 'stripe'
import { Plan } from '@prisma/client'

let _client: Stripe | undefined

export function getStripe(): Stripe {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (_client ??= new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as any }))
}

// Map plan → Stripe price ID (set in env)
export const PRICE_IDS: Record<Exclude<Plan, 'FREE'>, string> = {
  PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL ?? '',
  AGENCY:       process.env.STRIPE_PRICE_AGENCY ?? '',
  ENTERPRISE:   process.env.STRIPE_PRICE_ENTERPRISE ?? '',
}

// Reverse map for webhook lookup: price ID → Plan
export const PLAN_MAP: Record<string, Plan> = Object.fromEntries(
  (Object.entries(PRICE_IDS) as [string, string][])
    .filter(([, priceId]) => priceId)
    .map(([plan, priceId]) => [priceId, plan as Plan]),
)

// Prices shown in the UI (cents)
export const PLAN_PRICES: Record<Exclude<Plan, 'FREE'>, number> = {
  PROFESSIONAL: 4900,
  AGENCY:       19900,
  ENTERPRISE:   99900,
}

/** Create a Stripe customer and return the customer ID. DB save is the caller's responsibility. */
export async function createCustomer(email: string, name: string): Promise<string> {
  const customer = await getStripe().customers.create({ email, name: name || email })
  return customer.id
}

/**
 * Create a Stripe checkout session for a subscription.
 * Returns the session URL.
 */
export async function createCheckoutSession(
  customerId: string,
  priceId:    string,
  userId:     string,
): Promise<string> {
  const session = await getStripe().checkout.sessions.create({
    customer:              customerId,
    mode:                  'subscription',
    line_items:            [{ price: priceId, quantity: 1 }],
    success_url:           `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
    cancel_url:            `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    allow_promotion_codes: true,
    metadata:              { userId },
  })
  if (!session.url) throw new Error('Stripe returned no checkout URL')
  return session.url
}

/** Create a Stripe billing-portal session. Returns the portal URL. */
export async function createPortalSession(customerId: string): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({
    customer:   customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/account/billing`,
  })
  return session.url
}
