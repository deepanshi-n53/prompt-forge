import { type NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe, PLAN_MAP } from '@/lib/stripe/stripe'
import { db } from '@/lib/db/prisma'
import { sendEmail } from '@/lib/email/mailer'
import { sendPaymentFailedEmail } from '@/lib/email'
import { Plan } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const rawBody  = await request.text()
  const sig      = request.headers.get('stripe-signature') ?? ''
  const secret   = process.env.STRIPE_WEBHOOK_SECRET ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    console.error('[stripe/webhook] signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_action_required':
        await handlePaymentActionRequired(event.data.object as Stripe.Invoice)
        break

      default:
        // Unhandled event — acknowledge and ignore
        break
    }
  } catch (err) {
    console.error(`[stripe/webhook] error handling ${event.type}`, err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId     = session.customer as string | null
  const subscriptionId = session.subscription as string | null
  const userId         = session.metadata?.userId

  if (!customerId || !subscriptionId || !userId) {
    console.warn('[stripe/webhook] checkout.session.completed missing fields', { customerId, subscriptionId, userId })
    return
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const priceId      = subscription.items.data[0]?.price.id
  const plan         = (priceId && PLAN_MAP[priceId]) ? PLAN_MAP[priceId] : Plan.PROFESSIONAL

  await db.user.update({
    where: { id: userId },
    data:  { plan, stripeCustomerId: customerId },
  })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const priceId    = subscription.items.data[0]?.price.id
  const plan       = (priceId && PLAN_MAP[priceId]) ? PLAN_MAP[priceId] : null

  if (!plan) {
    console.warn('[stripe/webhook] subscription.updated: unknown price', priceId)
    return
  }

  // Only update if subscription is active/trialing
  if (!['active', 'trialing'].includes(subscription.status)) return

  await db.user.updateMany({
    where: { stripeCustomerId: customerId },
    data:  { plan },
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  await db.user.updateMany({
    where: { stripeCustomerId: customerId },
    data:  { plan: Plan.FREE },
  })
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string

  const user = await db.user.findFirst({
    where:  { stripeCustomerId: customerId },
    select: { email: true, name: true },
  })
  if (!user) return

  await sendPaymentFailedEmail(user.email, user.name ?? '')
}

async function handlePaymentActionRequired(invoice: Stripe.Invoice) {
  const customerId   = invoice.customer as string
  const hostedUrl    = (invoice as Stripe.Invoice & { hosted_invoice_url?: string }).hosted_invoice_url

  const user = await db.user.findFirst({
    where:  { stripeCustomerId: customerId },
    select: { email: true, name: true },
  })
  if (!user) return

  await sendEmail({
    to:      user.email,
    subject: 'Action required: please authenticate your payment',
    html: `
      <p>Hi ${user.name ?? 'there'},</p>
      <p>Your subscription payment requires additional authentication.</p>
      ${hostedUrl ? `<p><a href="${hostedUrl}">Complete payment →</a></p>` : ''}
      <p>If you have trouble, visit <a href="${process.env.NEXT_PUBLIC_APP_URL}/account/billing">your billing page</a>.</p>
    `,
  })
}
