import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db/prisma'
import type { User } from '@prisma/client'

export async function getCurrentUser(): Promise<User | null> {
  const { userId } = await auth()
  if (!userId) return null

  return db.user.findUnique({ where: { clerkId: userId } })
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()

  if (!user) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 })
  }

  return user
}

export async function requireOrgAccess(orgId: string): Promise<User> {
  const user = await requireAuth()

  const membership = await db.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: user.id } },
  })

  if (!membership) {
    throw Object.assign(new Error('Forbidden'), { status: 403 })
  }

  return user
}
