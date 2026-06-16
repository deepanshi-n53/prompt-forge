import { verifyWebhook } from '@clerk/nextjs/webhooks'
import type {
  UserJSON,
  OrganizationJSON,
  OrganizationMembershipJSON,
  DeletedObjectJSON,
} from '@clerk/nextjs/server'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/prisma'
import { sendWelcomeEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  let evt: Awaited<ReturnType<typeof verifyWebhook>>

  try {
    evt = await verifyWebhook(request, {
      signingSecret: process.env.CLERK_WEBHOOK_SECRET,
    })
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  const eventType = evt.type

  try {
    switch (eventType) {
      case 'user.created': {
        const data = evt.data as UserJSON
        const email = data.email_addresses[0]?.email_address ?? ''
        const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || null

        // @n53tech.com employees get Enterprise access for free
        const isN53 = email.toLowerCase().endsWith('@n53tech.com')

        await db.user.create({
          data: {
            clerkId:   data.id,
            email,
            name,
            avatarUrl: data.image_url ?? null,
            isNewUser: !isN53,           // skip onboarding wizard for internal team
            plan:      isN53 ? 'ENTERPRISE' : 'FREE',
          },
        })

        void sendWelcomeEmail(email, name ?? '')
        break
      }

      case 'user.updated': {
        const data = evt.data as UserJSON
        const email = data.email_addresses[0]?.email_address ?? ''
        const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || null

        await db.user.update({
          where: { clerkId: data.id },
          data: { email, name, avatarUrl: data.image_url ?? null },
        })
        break
      }

      case 'user.deleted': {
        const data = evt.data as DeletedObjectJSON
        if (!data.id) break

        const existingUser = await db.user.findUnique({ where: { clerkId: data.id } })
        if (existingUser) {
          await db.user.update({
            where: { clerkId: data.id },
            data: { deletedAt: new Date() },
          })
        }
        break
      }

      case 'organization.created': {
        const data = evt.data as OrganizationJSON

        await db.organisation.create({
          data: {
            clerkOrgId: data.id,
            name: data.name,
          },
        })
        break
      }

      case 'organizationMembership.created': {
        const data = evt.data as OrganizationMembershipJSON

        const [org, user] = await Promise.all([
          db.organisation.findUnique({ where: { clerkOrgId: data.organization.id } }),
          db.user.findUnique({ where: { clerkId: data.public_user_data.user_id } }),
        ])

        if (org && user) {
          await db.orgMember.create({
            data: {
              orgId: org.id,
              userId: user.id,
            },
          })
        }
        break
      }

      case 'organizationMembership.deleted': {
        const data = evt.data as OrganizationMembershipJSON

        const [org, user] = await Promise.all([
          db.organisation.findUnique({ where: { clerkOrgId: data.organization.id } }),
          db.user.findUnique({ where: { clerkId: data.public_user_data.user_id } }),
        ])

        if (org && user) {
          await db.orgMember.deleteMany({
            where: { orgId: org.id, userId: user.id },
          })
        }
        break
      }
    }
  } catch (err) {
    console.error(`[clerk-webhook] failed to handle ${eventType}`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
