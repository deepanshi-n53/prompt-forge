import { callAI } from './ai-client'
import type { DecisionGraph, ChangeAnalysis, SectionImpact } from '@/types/decision'

const SYSTEM = `You are a software architect analysing BRD (Business Requirements Document) changes.
Compare OLD and NEW BRD semantically — not just text diff.
Cross-reference with the DECISION GRAPH to understand what architectural decisions are affected.
Return ONLY JSON matching the ChangeAnalysis schema below.

Impact rules — apply ALL that match:
- Auth model change (SSO added/removed, OAuth providers changed, auth flow restructured)
    → BREAKING: §06, §07, §08, §15, §18
- Multi-tenancy change (org/team structure added, removed, or restructured)
    → BREAKING: §05, §06, §07, §08
- New user type added
    → BREAKING: §02, §06; REVIEW: §07, §15
- Payment model change (subscription→usage, new tiers, billing cycle change)
    → BREAKING: §17; REVIEW: §07, §08
- New compliance requirement (GDPR, HIPAA, SOC2, PCI-DSS added)
    → BREAKING: §20; REVIEW: §18
- New feature added (additive change)
    → REVIEW: §02, §07, §08
- Feature removed or significantly renamed
    → REVIEW: every section that references that feature
- Scaling requirement change (10× traffic, new regions, SLA change)
    → BREAKING: §03, §28; REVIEW: §22
- Integration added or removed (new third-party service)
    → REVIEW: §09, §10

Sections with no relevant BRD change → SAFE.
isBreaking = true if ANY section is BREAKING.

ChangeAnalysis schema (return ONLY this JSON — no prose, no markdown):
{
  "summary": "<2–3 plain-English sentences readable by a non-technical client>",
  "changedAreas": ["<area>", ...],
  "isBreaking": true | false,
  "impactedSections": [
    {
      "sectionNum":         "<two-digit string, e.g. '07'>",
      "sectionName":        "<full name, e.g. 'Authentication & Authorisation'>",
      "impactLevel":        "BREAKING" | "REVIEW" | "SAFE",
      "reason":             "<one sentence>",
      "affectedDecisions":  ["<decision key>", ...]
    }
  ]
}`

function parseResponse(text: string): ChangeAnalysis {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  const raw = JSON.parse(stripped) as Record<string, unknown>

  return {
    summary: typeof raw.summary === 'string' ? raw.summary : 'BRD changes detected.',
    changedAreas: Array.isArray(raw.changedAreas) ? (raw.changedAreas as string[]) : [],
    isBreaking: Boolean(raw.isBreaking),
    impactedSections: Array.isArray(raw.impactedSections)
      ? (raw.impactedSections as SectionImpact[])
      : [],
  }
}

export async function detectChanges(
  oldBRDText: string,
  newBRDText: string,
  decisions: DecisionGraph,
): Promise<ChangeAnalysis> {
  const userMessage = [
    `## OLD BRD\n${oldBRDText.slice(0, 8_000)}`,
    `## NEW BRD\n${newBRDText.slice(0, 8_000)}`,
    `## DECISION GRAPH\n${JSON.stringify(decisions.sections ?? {}, null, 2).slice(0, 4_000)}`,
  ].join('\n\n---\n\n')

  const response = await callAI(
    [
      { role: 'system', content: SYSTEM },
      { role: 'user',   content: userMessage },
    ],
    3000,
  )

  try {
    return parseResponse(response.text)
  } catch {
    // AI response could not be parsed — conservative fallback
    return {
      summary:
        'Unable to analyse changes automatically. Please review the updated BRD manually.',
      changedAreas:     ['Unknown'],
      isBreaking:       true,
      impactedSections: [],
    }
  }
}
