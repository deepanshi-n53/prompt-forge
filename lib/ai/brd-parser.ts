import { callAI } from './ai-client'
import type { ParsedBRD } from '@/types'

const SYSTEM_PROMPT = `You are a senior software architect. Extract structured information from the BRD document.

Return ONLY valid JSON with this exact schema (no markdown fences, no prose outside the JSON):
{
  "archetype": string,
  "archetypeConfidence": number,
  "productPurpose": string,
  "userTypes": string[],
  "coreFeatures": [{ "id": string, "name": string, "description": string, "category": string, "priority": "MUST"|"SHOULD"|"COULD"|"WONT" }],
  "platform": "web"|"mobile"|"both",
  "complianceHints": string[],
  "integrationHints": string[],
  "scalingHints": string,
  "monetizationModel": string,
  "healthScores": [],
  "extractedDecisions": {}
}

archetype must be one of: "b2b-saas", "marketplace", "consumer-app", "ecommerce", "ai-tool"
All array fields must be arrays even if empty. platform must be one of the three allowed values.`

function normalizeParsedBRD(raw: Record<string, unknown>): ParsedBRD {
  const validPlatforms = new Set(['web', 'mobile', 'both'])
  return {
    archetype:           typeof raw.archetype === 'string' ? raw.archetype : 'b2b-saas',
    archetypeConfidence: typeof raw.archetypeConfidence === 'number' ? raw.archetypeConfidence : 0,
    productPurpose:      typeof raw.productPurpose === 'string' ? raw.productPurpose : '',
    userTypes:           Array.isArray(raw.userTypes) ? (raw.userTypes as string[]) : [],
    coreFeatures:        Array.isArray(raw.coreFeatures) ? (raw.coreFeatures as ParsedBRD['coreFeatures']) : [],
    platform:            validPlatforms.has(raw.platform as string) ? (raw.platform as ParsedBRD['platform']) : 'web',
    complianceHints:     Array.isArray(raw.complianceHints) ? (raw.complianceHints as string[]) : [],
    integrationHints:    Array.isArray(raw.integrationHints) ? (raw.integrationHints as string[]) : [],
    scalingHints:        typeof raw.scalingHints === 'string' ? raw.scalingHints : '',
    monetizationModel:   typeof raw.monetizationModel === 'string' ? raw.monetizationModel : '',
    healthScores:        Array.isArray(raw.healthScores) ? (raw.healthScores as ParsedBRD['healthScores']) : [],
    extractedDecisions:  raw.extractedDecisions != null && typeof raw.extractedDecisions === 'object' && !Array.isArray(raw.extractedDecisions)
                           ? (raw.extractedDecisions as Record<string, unknown>)
                           : {},
  }
}

function safeParse(text: string): ParsedBRD {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const raw = JSON.parse(stripped) as Record<string, unknown>
  return normalizeParsedBRD(raw)
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
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: `Parse this BRD:\n\n${rawText.slice(0, 400_000)}` },
    ],
    4096,
  )

  return safeParse(response.text)
}
