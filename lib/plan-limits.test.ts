import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Prisma before importing plan-limits
vi.mock('@prisma/client', () => ({
  Plan: {
    FREE: 'FREE',
    PROFESSIONAL: 'PROFESSIONAL',
    AGENCY: 'AGENCY',
    ENTERPRISE: 'ENTERPRISE',
  },
}))

vi.mock('@/lib/db/prisma', () => ({
  db: {
    project: {
      count: vi.fn(),
    },
    generatedPrompt: {
      count: vi.fn(),
    },
  },
}))

import { PLAN_LIMITS, PlanLimitError, checkProjectLimit, checkGenerationLimit } from './plan-limits'
import { db } from '@/lib/db/prisma'

describe('PLAN_LIMITS', () => {
  it('FREE plan allows 1 project and 3 generations', () => {
    expect(PLAN_LIMITS.FREE.maxProjects).toBe(1)
    expect(PLAN_LIMITS.FREE.maxGenerationsPerMonth).toBe(3)
    expect(PLAN_LIMITS.FREE.maxSeats).toBe(1)
  })

  it('PROFESSIONAL plan allows 5 projects and 30 generations', () => {
    expect(PLAN_LIMITS.PROFESSIONAL.maxProjects).toBe(5)
    expect(PLAN_LIMITS.PROFESSIONAL.maxGenerationsPerMonth).toBe(30)
  })

  it('AGENCY plan allows Infinity projects', () => {
    expect(PLAN_LIMITS.AGENCY.maxProjects).toBe(Infinity)
    expect(PLAN_LIMITS.AGENCY.maxSeats).toBe(5)
  })

  it('ENTERPRISE plan allows Infinity on all limits', () => {
    expect(PLAN_LIMITS.ENTERPRISE.maxProjects).toBe(Infinity)
    expect(PLAN_LIMITS.ENTERPRISE.maxGenerationsPerMonth).toBe(Infinity)
    expect(PLAN_LIMITS.ENTERPRISE.maxSeats).toBe(Infinity)
  })
})

describe('PlanLimitError', () => {
  it('sets name, limitType, message, and upgradeUrl', () => {
    const err = new PlanLimitError('project', 'Too many projects')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('PlanLimitError')
    expect(err.limitType).toBe('project')
    expect(err.message).toBe('Too many projects')
    expect(err.upgradeUrl).toBe('/pricing')
  })

  it('works for all limit types', () => {
    expect(new PlanLimitError('generation', 'quota').limitType).toBe('generation')
    expect(new PlanLimitError('seat', 'seats').limitType).toBe('seat')
  })
})

describe('checkProjectLimit', () => {
  const mockCount = db.project.count as ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockCount.mockReset()
  })

  it('does not throw for AGENCY (Infinity limit)', async () => {
    await expect(checkProjectLimit('user-1', 'AGENCY')).resolves.toBeUndefined()
    expect(mockCount).not.toHaveBeenCalled()
  })

  it('does not throw when under the FREE limit (0 projects)', async () => {
    mockCount.mockResolvedValue(0)
    await expect(checkProjectLimit('user-1', 'FREE')).resolves.toBeUndefined()
  })

  it('throws PlanLimitError when FREE user already has 1 project', async () => {
    mockCount.mockResolvedValue(1)
    await expect(checkProjectLimit('user-1', 'FREE')).rejects.toThrow(PlanLimitError)
  })

  it('throws with limitType "project"', async () => {
    mockCount.mockResolvedValue(5)
    const err = await checkProjectLimit('user-1', 'PROFESSIONAL').catch((e) => e)
    expect(err).toBeInstanceOf(PlanLimitError)
    expect((err as PlanLimitError).limitType).toBe('project')
  })
})

describe('checkGenerationLimit', () => {
  const mockCount = db.generatedPrompt.count as ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockCount.mockReset()
  })

  it('does not throw for ENTERPRISE (Infinity limit)', async () => {
    await expect(checkGenerationLimit('user-1', 'ENTERPRISE')).resolves.toBeUndefined()
    expect(mockCount).not.toHaveBeenCalled()
  })

  it('throws PlanLimitError when monthly quota is exceeded', async () => {
    mockCount.mockResolvedValue(3)
    await expect(checkGenerationLimit('user-1', 'FREE')).rejects.toThrow(PlanLimitError)
  })

  it('does not throw when under quota', async () => {
    mockCount.mockResolvedValue(2)
    await expect(checkGenerationLimit('user-1', 'FREE')).resolves.toBeUndefined()
  })
})
