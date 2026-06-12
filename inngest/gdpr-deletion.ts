import { inngest } from '@/inngest/client'
import { db } from '@/lib/db/prisma'
import { deleteBRD } from '@/lib/storage/supabase-storage'
import { getStripe } from '@/lib/stripe/stripe'
import { clerkClient } from '@clerk/nextjs/server'

interface DeletionPayload {
  userId:  string
  clerkId: string
}

export const gdprDeletionJob = inngest.createFunction(
  {
    id:       'gdpr-user-deletion',
    retries:  3,
    triggers: [{ event: 'user/deletion-requested' }],
  },
  async ({ event, step }) => {
    const { userId, clerkId } = event.data as DeletionPayload

    // 1. Delete all BRD files from object storage
    await step.run('delete-storage', async () => {
      const brds = await db.bRD.findMany({
        where:  { project: { ownerId: userId } },
        select: { storagePath: true },
      })
      await Promise.allSettled(brds.map((b) => deleteBRD(b.storagePath)))
    })

    // 2. Delete DB records — projects first (no cascade on User→Project), then user
    await step.run('delete-db', async () => {
      await db.project.deleteMany({ where: { ownerId: userId } })
      await db.deletionRequest.deleteMany({ where: { userId } })
      await db.user.delete({ where: { id: userId } })
    })

    // 3. Cancel Stripe subscription if present
    await step.run('cancel-stripe', async () => {
      const customerId = await db.user
        .findUnique({ where: { id: userId }, select: { stripeCustomerId: true } })
        .then((u) => u?.stripeCustomerId)
        .catch(() => null)

      if (customerId) {
        const subscriptions = await getStripe().subscriptions.list({ customer: customerId, limit: 10 })
        await Promise.allSettled(
          subscriptions.data.map((sub) =>
            getStripe().subscriptions.cancel(sub.id, { prorate: false }),
          ),
        )
      }
    })

    // 4. Delete Clerk user — must come after DB deletion
    await step.run('delete-clerk-user', async () => {
      const clerk = await clerkClient()
      await clerk.users.deleteUser(clerkId)
    })

    await step.run('log-completion', async () => {
      console.info('[gdpr] User deletion completed', { userId, clerkId })
    })
  },
)
