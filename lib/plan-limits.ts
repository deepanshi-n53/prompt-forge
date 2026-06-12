import { Plan } from '@prisma/client'
import { db } from '@/lib/db/prisma'

// ── Plan limits config ────────────────────────────────────────────────────────

export interface PlanLimits {
  maxProjects:           number
  maxGenerationsPerMonth: number
  maxSeats:              number
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE:         { maxProjects: 1,        maxGenerationsPerMonth: 3,        maxSeats: 1        },
  PROFESSIONAL: { maxProjects: 5,        maxGenerationsPerMonth: 30,       maxSeats: 1        },
  AGENCY:       { maxProjects: Infinity, maxGenerationsPerMonth: 200,      maxSeats: 5        },
  ENTERPRISE:   { maxProjects: Infinity, maxGenerationsPerMonth: Infinity, maxSeats: Infinity },
}

// ── Custom error ──────────────────────────────────────────────────────────────

export class PlanLimitError extends Error {
  readonly upgradeUrl = '/pricing'
  readonly limitType: 'project' | 'generation' | 'seat'

  constructor(
    limitType: 'project' | 'generation' | 'seat',
    message: string,
  ) {
    super(message)
    this.name = 'PlanLimitError'
    this.limitType = limitType
  }
}

// ── Limit checkers ────────────────────────────────────────────────────────────

/** Throws PlanLimitError if the user has reached their project cap. */
export async function checkProjectLimit(userId: string, plan: Plan): Promise<void> {
  const limits = PLAN_LIMITS[plan]
  if (limits.maxProjects === Infinity) return

  const count = await db.project.count({ where: { ownerId: userId } })
  if (count >= limits.maxProjects) {
    throw new PlanLimitError(
      'project',
      `Your ${plan} plan allows ${limits.maxProjects} project${limits.maxProjects === 1 ? '' : 's'}. Upgrade to create more.`,
    )
  }
}

/** Throws PlanLimitError if the user has hit their monthly generation quota. */
export async function checkGenerationLimit(userId: string, plan: Plan): Promise<void> {
  const limits = PLAN_LIMITS[plan]
  if (limits.maxGenerationsPerMonth === Infinity) return

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const count = await db.generatedPrompt.count({
    where: {
      project: { ownerId: userId },
      createdAt: { gte: monthStart },
    },
  })

  if (count >= limits.maxGenerationsPerMonth) {
    throw new PlanLimitError(
      'generation',
      `Your ${plan} plan allows ${limits.maxGenerationsPerMonth} generations per month. Upgrade for more.`,
    )
  }
}
