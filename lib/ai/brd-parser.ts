import Anthropic from '@anthropic-ai/sdk'
import type { ParsedBRD } from '@/types'

const client = new Anthropic()

const SYSTEM = `You are an expert business analyst AI. You extract structured information from Business Requirement Documents (BRDs) and return ONLY valid JSON — no prose, no markdown fences.

Return a JSON object that matches this TypeScript type exactly:
{
  archetype: string,           // one of: marketplace, b2b-saas, consumer-app, ecommerce, ai-tool
  archetypeConfidence: number, // 0-1
  productPurpose: string,      // 1-2 sentences describing what the product does
  userTypes: string[],         // user roles (e.g. ["admin", "walker", "pet owner"])
  coreFeatures: Array<{
    id: string,                // kebab-case slug
    name: string,
    description: string,
    category: string,          // e.g. "auth", "payments", "messaging"
    priority: "MUST" | "SHOULD" | "COULD" | "WONT"
  }>,
  platform: "web" | "mobile" | "both",
  complianceHints: string[],   // e.g. ["GDPR", "PCI-DSS", "HIPAA"]
  integrationHints: string[],  // e.g. ["Stripe", "Twilio", "Google Maps"]
  scalingHints: string,        // brief note on expected scale
  monetizationModel: string,   // e.g. "subscription", "commission", "freemium"
  healthScores: Array<{
    name: string,              // dimension name e.g. "Functional Requirements"
    score: number,             // 0-100
    gaps: string[]             // what is missing or unclear
  }>,
  extractedDecisions: Record<string, unknown>  // any notable decisions or constraints
}

healthScores must have at least these 5 dimensions:
1. Functional Requirements (are features well defined?)
2. Non-Functional Requirements (performance, security, availability targets)
3. User Stories (are user types and journeys specified?)
4. Data Model Clarity (entities, relationships, data flows)
5. Compliance & Risk (regulatory, legal, security considerations)

Be conservative: low scores for vague or missing sections.`

function safeParse(text: string): ParsedBRD {
  // Claude occasionally wraps JSON in a fence despite instructions
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  return JSON.parse(stripped) as ParsedBRD
}

export async function parseBRDWithAI(rawText: string): Promise<ParsedBRD> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Parse this BRD and return structured JSON:\n\n${rawText.slice(0, 400_000)}`,
      },
    ],
  })

  const block = response.content[0]
  if (block.type !== 'text') {
    throw new Error(`Unexpected response block type: ${block.type}`)
  }

  return safeParse(block.text)
}
