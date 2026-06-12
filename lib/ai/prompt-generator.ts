import Anthropic from '@anthropic-ai/sdk'
import { SECTION_TEMPLATES } from './section-templates'
import type { ParsedBRD } from '@/types/brd'
import type { DecisionGraph, Assumption } from '@/types/decision'

const client = new Anthropic()

function buildSystem(agentHint: string): string {
  return `You are a senior software architect filling in a SaaS architecture prompt section.

Use the PROJECT CONTEXT and BRD DATA to fill ALL blank fields (___) with concrete, specific values.
Return ONLY valid JSON — no markdown fences, no prose outside the JSON object.

Response format:
{ "content": string, "confidence": number (0-1), "assumptions": Assumption[] }

Assumption format:
{ "field": string, "value": string, "confidence": "HIGH"|"MEDIUM"|"LOW", "reason": string }

Confidence guide:
0.90–0.95 → all decisions explicitly stated in user input
0.70–0.89 → inferred from BRD context with reasonable certainty
0.50–0.69 → best guess with limited supporting evidence
Below 0.50 → speculative — flag as assumption

AGENT HINT (what to produce in the "content" field):
${agentHint}`
}

export interface GeneratedContent {
  content:     string
  confidence:  number
  assumptions: Assumption[]
}

function safeParse(text: string): GeneratedContent {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  const raw = JSON.parse(stripped) as Record<string, unknown>
  return {
    content:     typeof raw.content === 'string' ? raw.content : String(raw.content ?? ''),
    confidence:  typeof raw.confidence === 'number' ? Math.max(0, Math.min(1, raw.confidence)) : 0.7,
    assumptions: Array.isArray(raw.assumptions) ? (raw.assumptions as Assumption[]) : [],
  }
}

export async function generateSection(
  sectionNum: string,
  _sectionTemplate: string,   // kept for API compatibility, now sourced from SECTION_TEMPLATES
  parsedBRD: ParsedBRD,
  decisions: DecisionGraph,
  userAnswers: Record<string, string>,
): Promise<GeneratedContent> {
  const template = SECTION_TEMPLATES[sectionNum]
  if (!template) throw new Error(`No template found for section ${sectionNum}`)

  const brdContext = {
    archetype:         parsedBRD.archetype,
    productPurpose:    parsedBRD.productPurpose,
    userTypes:         parsedBRD.userTypes,
    coreFeatures:      parsedBRD.coreFeatures?.slice(0, 10),
    platform:          parsedBRD.platform,
    complianceHints:   parsedBRD.complianceHints,
    integrationHints:  parsedBRD.integrationHints,
    scalingHints:      parsedBRD.scalingHints,
    monetizationModel: parsedBRD.monetizationModel,
  }

  const userMessage = [
    `## PROJECT CONTEXT\n${JSON.stringify(decisions.sections ?? {}, null, 2)}`,
    `## BRD DATA\n${JSON.stringify(brdContext, null, 2)}`,
    `## USER ANSWERS\n${JSON.stringify(userAnswers, null, 2)}`,
    `## SECTION PROMPT (§${sectionNum} — ${template.name})\n${template.prompt}`,
  ].join('\n\n')

  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 4000,
    system:     buildSystem(template.agentHint),
    messages:   [{ role: 'user', content: userMessage }],
  })

  const block = response.content[0]
  if (block.type !== 'text') {
    throw new Error(`Unexpected Claude response block type: ${block.type}`)
  }

  try {
    return safeParse(block.text)
  } catch {
    return {
      content:    block.text,
      confidence: 0.4,
      assumptions: [{
        field:      'parse_error',
        value:      'raw-text',
        reason:     'Claude response was not valid JSON — content preserved verbatim',
        confidence: 'LOW',
      }],
    }
  }
}
