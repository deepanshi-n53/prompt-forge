import { describe, it, expect } from 'vitest'
import { detectArchetype } from './archetype-detector'
import type { ParsedBRD } from '@/types'

function makeBRD(overrides: Partial<ParsedBRD> = {}): ParsedBRD {
  return {
    archetype: '',
    archetypeConfidence: 0,
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

describe('detectArchetype', () => {
  it('detects marketplace from booking/commission keywords', () => {
    const brd = makeBRD({
      productPurpose: 'Platform for booking freelance walkers with commission-based payments',
      userTypes: ['buyers', 'sellers'],
    })
    const { archetype } = detectArchetype(brd)
    expect(archetype).toBe('marketplace')
  })

  it('detects b2b-saas from workspace/teams/admin keywords', () => {
    const brd = makeBRD({
      productPurpose: 'Workspace management tool for enterprise teams with SSO and admin controls',
      userTypes: ['admin', 'member'],
    })
    const { archetype } = detectArchetype(brd)
    expect(archetype).toBe('b2b-saas')
  })

  it('detects ai-tool from prompt/llm/generate keywords', () => {
    const brd = makeBRD({
      productPurpose: 'AI-powered prompt generation tool using LLM inference and embeddings',
      userTypes: ['developer'],
    })
    const { archetype } = detectArchetype(brd)
    expect(archetype).toBe('ai-tool')
  })

  it('detects ecommerce from cart/checkout/inventory keywords', () => {
    const brd = makeBRD({
      productPurpose: 'Online store with cart, checkout, and inventory management',
      userTypes: ['shopper'],
    })
    const { archetype } = detectArchetype(brd)
    expect(archetype).toBe('ecommerce')
  })

  it('returns confidence between 0 and 1', () => {
    const brd = makeBRD({ productPurpose: 'SaaS platform for teams with billing and seats' })
    const { confidence } = detectArchetype(brd)
    expect(confidence).toBeGreaterThanOrEqual(0)
    expect(confidence).toBeLessThanOrEqual(1)
  })

  it('defers to parsedBRD.archetype when its confidence is higher', () => {
    const brd = makeBRD({
      productPurpose: 'booking and commission marketplace',
      archetype: 'consumer-app',
      archetypeConfidence: 0.95,
    })
    const { archetype } = detectArchetype(brd)
    expect(archetype).toBe('consumer-app')
  })

  it('falls back to b2b-saas when no keywords match', () => {
    const brd = makeBRD({ productPurpose: 'something completely generic' })
    const { archetype } = detectArchetype(brd)
    expect(archetype).toBe('b2b-saas')
  })

  it('checks features for archetype signals', () => {
    const brd = makeBRD({
      productPurpose: 'platform',
      coreFeatures: [
        { id: '1', name: 'Shopping cart', description: 'add items to cart', category: 'core', priority: 'MUST' },
        { id: '2', name: 'Checkout', description: 'checkout and payment', category: 'core', priority: 'MUST' },
        { id: '3', name: 'Product catalogue', description: 'browse products', category: 'core', priority: 'MUST' },
      ],
    })
    const { archetype } = detectArchetype(brd)
    expect(archetype).toBe('ecommerce')
  })
})
