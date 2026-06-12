import { describe, it, expect } from 'vitest'
import { calculateHealthScore } from './health-scorer'
import type { ParsedBRD } from '@/types'

function makeBRD(overrides: Partial<ParsedBRD> = {}): ParsedBRD {
  return {
    archetype: 'b2b-saas',
    archetypeConfidence: 0.8,
    productPurpose: '',
    userTypes: [],
    coreFeatures: [],
    platform: 'web',
    complianceHints: [],
    integrationHints: [],
    scalingHints: '',
    monetizationModel: '',
    healthScores: [],
    extractedDecisions: {},
    ...overrides,
  }
}

describe('calculateHealthScore', () => {
  it('returns 0 total for a completely empty BRD', () => {
    const result = calculateHealthScore(makeBRD(), '')
    expect(result.total).toBe(0)
    expect(result.gaps.length).toBeGreaterThan(0)
  })

  it('scores product purpose 100 when description is long enough', () => {
    const brd = makeBRD({ productPurpose: 'A marketplace that connects dog owners with vetted dog walkers for on-demand bookings.' })
    const result = calculateHealthScore(brd, '')
    const dim = result.dimensions.find((d) => d.name === 'Product Purpose')
    expect(dim?.score).toBe(100)
  })

  it('scores product purpose 50 when description exists but is short', () => {
    const brd = makeBRD({ productPurpose: 'Dog app' })
    const result = calculateHealthScore(brd, '')
    const dim = result.dimensions.find((d) => d.name === 'Product Purpose')
    expect(dim?.score).toBe(50)
    expect(dim?.gaps.length).toBeGreaterThan(0)
  })

  it('scores user types 100 with 2 or more types', () => {
    const brd = makeBRD({ userTypes: ['dog owner', 'dog walker'] })
    const result = calculateHealthScore(brd, '')
    const dim = result.dimensions.find((d) => d.name === 'User Types')
    expect(dim?.score).toBe(100)
  })

  it('scores core features 100 with 5 or more features', () => {
    const features = Array.from({ length: 5 }, (_, i) => ({
      id: String(i), name: `Feature ${i}`, description: 'desc', category: 'core', priority: 'MUST' as const,
    }))
    const brd = makeBRD({ coreFeatures: features })
    const result = calculateHealthScore(brd, '')
    const dim = result.dimensions.find((d) => d.name === 'Core Features')
    expect(dim?.score).toBe(100)
  })

  it('detects NFR keywords from raw text', () => {
    const result = calculateHealthScore(makeBRD(), 'The system must handle high throughput with low latency and 99.9% uptime SLA.')
    const dim = result.dimensions.find((d) => d.name === 'Non-Functional Requirements')
    expect(dim?.score).toBe(100)
  })

  it('detects named compliance frameworks', () => {
    const brd = makeBRD({ complianceHints: ['must comply with GDPR'] })
    const result = calculateHealthScore(brd, '')
    const dim = result.dimensions.find((d) => d.name === 'Compliance & Security')
    expect(dim?.score).toBe(100)
  })

  it('scores edge cases 100 when raw text mentions error handling', () => {
    const result = calculateHealthScore(makeBRD(), 'We need robust error handling and retry logic for all external calls.')
    const dim = result.dimensions.find((d) => d.name === 'Edge Cases')
    expect(dim?.score).toBe(100)
  })

  it('recommendations list only covers dimensions scoring below 60', () => {
    const brd = makeBRD({
      productPurpose: 'A comprehensive B2B SaaS platform for managing enterprise teams with SSO and role-based access control.',
      userTypes: ['admin', 'member'],
      coreFeatures: Array.from({ length: 5 }, (_, i) => ({
        id: String(i), name: `F${i}`, description: 'd', category: 'c', priority: 'MUST' as const,
      })),
    })
    const result = calculateHealthScore(brd, '')
    for (const rec of result.recommendations) {
      const dimName = result.dimensions.find((d) => rec.includes(d.name))
      expect(dimName?.score).toBeLessThan(60)
    }
  })

  it('total score is between 0 and 100', () => {
    const brd = makeBRD({
      productPurpose: 'A full-featured platform for connecting service providers with customers.',
      userTypes: ['customer', 'provider', 'admin'],
      coreFeatures: Array.from({ length: 5 }, (_, i) => ({
        id: String(i), name: `F${i}`, description: 'd', category: 'c', priority: 'MUST' as const,
      })),
      complianceHints: ['GDPR compliant'],
      integrationHints: ['Stripe', 'Twilio'],
      monetizationModel: 'Subscription SaaS with per-seat pricing',
    })
    const result = calculateHealthScore(brd, 'error handling retry timeout fallback performance latency uptime sla')
    expect(result.total).toBeGreaterThanOrEqual(0)
    expect(result.total).toBeLessThanOrEqual(100)
    expect(result.total).toBeGreaterThan(80)
  })
})
