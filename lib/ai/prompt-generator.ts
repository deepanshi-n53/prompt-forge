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

// ── Locked-decision rendering ─────────────────────────────────────────────────

function renderLocked(lockedDecisions?: Record<string, string>): string {
  if (!lockedDecisions) return '  (none yet — this is the first section)'
  const entries = Object.entries(lockedDecisions).filter(([, v]) => v != null && v !== '')
  if (entries.length === 0) return '  (none yet — this is the first section)'
  return entries.map(([k, v]) => `  - ${k}: ${v}`).join('\n')
}

function renderBRDContext(
  parsedBRD: ParsedBRD,
  locked: Record<string, string>,
): string {
  // Prefer the rich locked decisions (sourced from ArchitectureDecisions), then
  // fall back to the legacy parsed BRD fields.
  const appName  = locked.appName  || parsedBRD.productPurpose?.slice(0, 60) || 'this app'
  const appType  = locked.appType  || parsedBRD.archetype || 'SaaS'
  const platform = locked.platform || parsedBRD.platform || 'web'
  const userTypes = locked.userTypes || (parsedBRD.userTypes ?? []).join(', ') || 'general users'
  const coreFeatures = locked.coreFeatures
    || (parsedBRD.coreFeatures ?? []).map((f) => f.name).join(', ')
    || 'core product features'
  const regions = locked.launchRegions || 'not specified'

  const compliance = [
    locked.gdprRequired === 'yes'  ? 'GDPR'    : null,
    locked.hipaaRequired === 'yes' ? 'HIPAA'   : null,
    locked.pciRequired === 'yes'   ? 'PCI-DSS' : null,
  ].filter(Boolean).join(', ') || 'none flagged'

  return [
    `- App name: ${appName}`,
    `- App type: ${appType}`,
    `- Platform: ${platform}`,
    `- User types: ${userTypes}`,
    `- Core features: ${coreFeatures}`,
    `- Launch regions: ${regions}`,
    `- Compliance: ${compliance}`,
  ].join('\n')
}

function buildSystem(
  sectionNum: string,
  sectionName: string,
  parsedBRD: ParsedBRD,
  lockedDecisions?: Record<string, string>,
): string {
  const locked = lockedDecisions ?? {}

  return `You are filling §${sectionNum} — ${sectionName} of the SaaS Architecture Prompt System.

LOCKED DECISIONS — NEVER CONTRADICT THESE:
${renderLocked(lockedDecisions)}

BRD CONTEXT:
${renderBRDContext(parsedBRD, locked)}

RULES:
1. Fill EVERY ___ blank with real, specific content for THIS exact app — never a generic placeholder.
2. NEVER leave a ___ blank. If the BRD is silent, infer the best answer and record it as an assumption.
3. NEVER contradict the LOCKED DECISIONS above — they are final, set by earlier sections.
   - If §06 decided JWT, say "Bearer token" — not "auth token".
   - If §07 decided PostgreSQL, never mention MongoDB.
4. Use the real app vocabulary — if this is a dog-walking app, say "walkers", not "service providers".
5. The "content" field must be ONLY the filled template text — every ___ replaced — with no preamble, no meta-commentary, no markdown fences.

Return ONLY valid JSON (no markdown fences, no prose outside the JSON):
{
  "content": "the COMPLETE filled section text — all headers and sub-sections from the template, every ___ replaced",
  "decisions": { "decisionKey": "specificValue" },
  "confidence": 0.85,
  "assumptions": [{ "field": "fieldName", "value": "assumed value", "confidence": "HIGH|MEDIUM|LOW", "reason": "why assumed" }]
}

The "decisions" object must contain the key decisions THIS section locks in for every subsequent section.
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

  const userMessage = [
    `SECTION TEMPLATE (§${sectionNum} — ${template.name}) — preserve all structure, replace every ___:\n${template.template}`,
    `AGENT HINT — what to produce in the "content" field:\n${template.agentHint}`,
  ].join('\n\n---\n\n')

  const systemPrompt = buildSystem(sectionNum, template.name, parsedBRD, lockedDecisions)

  const response = await callAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage },
    ],
    4096,
  )

  return safeParse(response.text)
}
