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

function buildSystem(
  sectionNum: string,
  sectionName: string,
  lockedDecisions?: Record<string, string>,
): string {
  const appName = lockedDecisions?.productPurpose
    ? lockedDecisions.productPurpose.slice(0, 60)
    : 'this app'
  const appType = lockedDecisions?.archetype ?? 'SaaS'

  const lockedList = lockedDecisions && Object.keys(lockedDecisions).length > 0
    ? Object.entries(lockedDecisions)
        .filter(([, v]) => v)
        .map(([k, v]) => `  - ${k}: ${v}`)
        .join('\n')
    : '  (none yet — this is the first section)'

  return `You are filling in §${sectionNum} — ${sectionName} of the SaaS Architecture Prompt System for ${appName} (${appType}).

LOCKED DECISIONS — never contradict these:
${lockedList}

RULES:
1. Fill EVERY ___ field with a specific real answer for THIS app — not a generic example
2. Use exact app context — if this is a dog-walking app, say "walkers" not "service providers"
3. Never contradict LOCKED DECISIONS above — they are final and set by earlier sections
4. Never leave ___ blank — infer the best answer and label it as an assumption if needed
5. Output ONLY the filled section text — no preamble, no meta-commentary
6. Return ONLY valid JSON — no markdown fences, no prose outside the JSON

Response format (MUST be valid JSON):
{
  "content": "the COMPLETE filled section text as a single string — include ALL headers and sub-sections from the template",
  "decisions": { "decisionKey": "specificValue" },
  "confidence": 0.85,
  "assumptions": [{ "field": "fieldName", "value": "assumed value", "confidence": "HIGH|MEDIUM|LOW", "reason": "why assumed" }]
}

The "decisions" object must contain only the key decisions this section locks in for subsequent sections.
The "content" must be the full completed section — do NOT truncate or summarise.`
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

  const userMessage = [
    `APP CONTEXT FROM BRD:\n${JSON.stringify(brdContext, null, 2)}`,
    `USER SETUP ANSWERS:\n${JSON.stringify(userAnswers, null, 2)}`,
    `SECTION TEMPLATE (§${sectionNum} — ${template.name}):\n${template.template}`,
    `AGENT HINT — what to produce in the "content" field:\n${template.agentHint}`,
  ].join('\n\n---\n\n')

  const systemPrompt = buildSystem(sectionNum, template.name, lockedDecisions)

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
