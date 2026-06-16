import { callAI } from './ai-client'
import { SECTION_TEMPLATES } from './section-templates'
import type { ParsedBRD } from '@/types/brd'
import type { DecisionGraph, Assumption } from '@/types/decision'

export interface GeneratedContent {
  content:     string
  decisions:   Record<string, string>
  confidence:  number
  assumptions: Assumption[]
}

function buildSystem(sectionNum: string, sectionName: string): string {
  return `You are a senior software architect completing section §${sectionNum} — ${sectionName} of a SaaS Architecture Prompt System.

YOUR ONLY JOB:
Take the section template below and fill in every gap with specific, real answers based on the APP CONTEXT and LOCKED DECISIONS provided.

RULES:
1. Output the COMPLETE section text — do not summarise, truncate, or rewrite the structure
2. Replace every [blank], ___, or [example] with a specific, concrete answer for this app
3. Every decision in LOCKED DECISIONS is final — reference it, never contradict or redefine it
4. If a decision is not in LOCKED DECISIONS and you must infer, make a clearly-labeled assumption
5. Return ONLY valid JSON — no markdown fences, no prose outside the JSON

Response format (MUST be valid JSON):
{
  "content": "the full completed section text as a single string",
  "decisions": { "key": "value" },
  "confidence": 0.0,
  "assumptions": [{ "field": "name", "value": "value", "confidence": "HIGH|MEDIUM|LOW", "reason": "why" }]
}

The "decisions" object must contain ONLY the key decisions this section locks in (for subsequent sections to reference).`
}

function safeParse(text: string): GeneratedContent {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(stripped) as Record<string, unknown>
  } catch {
    // AI returned raw text, not JSON — wrap it
    return {
      content:    stripped,
      decisions:  {},
      confidence: 0.4,
      assumptions: [{
        field:      'parse_error',
        value:      'raw-text',
        reason:     'AI did not return JSON — content preserved verbatim',
        confidence: 'LOW',
      }],
    }
  }

  let content: string
  if (typeof raw.content === 'string') {
    content = raw.content
  } else if (raw.content !== null && raw.content !== undefined) {
    content = JSON.stringify(raw.content, null, 2)
  } else {
    content = stripped
  }

  return {
    content,
    decisions:  typeof raw.decisions === 'object' && raw.decisions !== null && !Array.isArray(raw.decisions)
      ? raw.decisions as Record<string, string>
      : {},
    confidence:  typeof raw.confidence === 'number' ? Math.max(0, Math.min(1, raw.confidence)) : 0.7,
    assumptions: Array.isArray(raw.assumptions) ? (raw.assumptions as Assumption[]) : [],
  }
}

export async function generateSection(
  sectionNum: string,
  _sectionTemplate: string,
  parsedBRD: ParsedBRD,
  decisions: DecisionGraph,
  userAnswers: Record<string, string>,
  lockedDecisions?: Record<string, string>,
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

  const lockedBlock = lockedDecisions && Object.keys(lockedDecisions).length > 0
    ? `LOCKED DECISIONS (from previous sections — do not redefine):\n${
        Object.entries(lockedDecisions)
          .map(([k, v]) => `  ${k}: ${v}`)
          .join('\n')
      }\n\n`
    : ''

  const userMessage = [
    `APP CONTEXT FROM BRD:\n${JSON.stringify(brdContext, null, 2)}`,
    `USER SETUP ANSWERS:\n${JSON.stringify(userAnswers, null, 2)}`,
    `PROJECT DECISIONS:\n${JSON.stringify(decisions.sections ?? {}, null, 2)}`,
    `${lockedBlock}SECTION TEMPLATE (§${sectionNum} — ${template.name}):\n${template.template}`,
    `AGENT HINT — what to produce in the "content" field:\n${template.agentHint}`,
  ].join('\n\n---\n\n')

  const systemPrompt = buildSystem(sectionNum, template.name)

  const response = await callAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage },
    ],
    4096,
  )

  try {
    return safeParse(response.text)
  } catch {
    return {
      content:    response.text,
      decisions:  {},
      confidence: 0.4,
      assumptions: [{
        field:      'parse_error',
        value:      'raw-text',
        reason:     'AI response was not valid JSON — content preserved verbatim',
        confidence: 'LOW',
      }],
    }
  }
}
