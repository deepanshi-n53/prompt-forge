import { callAI } from './ai-client'
import type { ParsedBRD } from '@/types'

function safeParse(text: string): ParsedBRD {
  // Models occasionally wrap JSON in a fence despite instructions
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  return JSON.parse(stripped) as ParsedBRD
}

export async function parseBRDWithAI(rawText: string): Promise<ParsedBRD> {
  if (process.env.AI_PROVIDER === 'mock') {
    return {
      archetype: 'b2b-saas',
      archetypeConfidence: 0.85,
      productPurpose: 'A SaaS platform for managing business operations efficiently',
      userTypes: ['Admin', 'Manager', 'User'],
      coreFeatures: [
        { id: '1', name: 'Dashboard', description: 'Main overview dashboard', category: 'core', priority: 'MUST' },
        { id: '2', name: 'User Management', description: 'Manage team members', category: 'core', priority: 'MUST' },
        { id: '3', name: 'Analytics', description: 'Business analytics', category: 'analytics', priority: 'SHOULD' },
        { id: '4', name: 'Settings', description: 'App configuration', category: 'settings', priority: 'COULD' },
        { id: '5', name: 'Notifications', description: 'Alert system', category: 'communication', priority: 'SHOULD' },
      ],
      platform: 'web',
      complianceHints: [],
      integrationHints: ['Stripe', 'Email'],
      scalingHints: 'Medium scale - 1000-10000 users',
      monetizationModel: 'Monthly subscription',
      healthScores: [],
      extractedDecisions: {},
    }
  }

  const response = await callAI(
    [
      {
        role:    'system',
        content: 'You are a senior software architect. Extract structured information from the BRD. Return ONLY valid JSON matching ParsedBRD schema. No markdown, no explanation, just JSON.',
      },
      {
        role:    'user',
        content: `Parse this BRD:\n\n${rawText.slice(0, 400_000)}`,
      },
    ],
    4096,
  )

  return safeParse(response.text)
}
