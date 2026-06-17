import type { ArchitectureDecisions, ParsedBRD, BRDHealthReport, HealthDimension } from '@/types'

// --- keyword lists for raw-text signal checks ---

const NFR_KEYWORDS = [
  'performance', 'latency', 'throughput', 'availability', 'uptime', 'sla',
  'concurrent', 'response time', 'scalab', 'capacity', 'load balancing',
]

const EDGE_KEYWORDS = [
  'error handling', 'failure state', 'fallback', 'retry', 'timeout',
  'edge case', 'invalid input', 'exception', 'what if',
]

const COMPLIANCE_NAMED = [
  'gdpr', 'hipaa', 'pci', 'sox', 'ccpa', 'iso 27001', 'fedramp',
  'wcag', 'accessibility', 'fips', 'nist', 'dpa',
]

// --- individual dimension scorers ---

function scoreProductPurpose(brd: ParsedBRD): HealthDimension {
  const p = brd.productPurpose?.trim() ?? ''
  let score: number
  const gaps: string[] = []

  if (!p) {
    score = 0
    gaps.push('Product purpose is missing entirely')
  } else if (p.length > 50) {
    score = 100
  } else {
    score = 50
    gaps.push('Product purpose exists but is too brief or vague')
  }

  return { name: 'Product Purpose', score, gaps }
}

function scoreUserTypes(brd: ParsedBRD): HealthDimension {
  const count = brd.userTypes?.length ?? 0
  let score: number
  const gaps: string[] = []

  if (count >= 2) {
    score = 100
  } else if (count === 1) {
    score = 60
    gaps.push('Only one user type identified — consider all actors who will interact with the system')
  } else {
    score = 0
    gaps.push('No user types or roles defined')
  }

  return { name: 'User Types', score, gaps }
}

function scoreCoreFeatures(brd: ParsedBRD): HealthDimension {
  const count = brd.coreFeatures?.length ?? 0
  let score: number
  const gaps: string[] = []

  if (count >= 5) {
    score = 100
  } else if (count >= 3) {
    score = 70
    gaps.push('Only 3–4 features defined — aim for at least 5 prioritised features')
  } else if (count >= 1) {
    score = 40
    gaps.push('Too few features defined — expand the feature list with priority levels')
  } else {
    score = 0
    gaps.push('No core features listed')
  }

  return { name: 'Core Features', score, gaps }
}

function scoreNonFunctionalRequirements(brd: ParsedBRD, rawText: string): HealthDimension {
  const corpus = `${brd.scalingHints ?? ''} ${rawText}`.toLowerCase()
  const hits = NFR_KEYWORDS.filter((kw) => corpus.includes(kw)).length
  let score: number
  const gaps: string[] = []

  if (hits >= 3) {
    score = 100
  } else if (hits >= 1) {
    score = 50
    gaps.push('Non-functional requirements partially covered — add explicit performance, uptime, and scalability targets')
  } else {
    score = 0
    gaps.push('No non-functional requirements (performance, availability, scalability) specified')
  }

  return { name: 'Non-Functional Requirements', score, gaps }
}

function scoreComplianceAndSecurity(brd: ParsedBRD): HealthDimension {
  const hints = (brd.complianceHints ?? []).map((h) => h.toLowerCase())
  const hasNamed = hints.some((h) => COMPLIANCE_NAMED.some((c) => h.includes(c)))
  let score: number
  const gaps: string[] = []

  if (hasNamed) {
    score = 100
  } else if (hints.length > 0) {
    score = 50
    gaps.push('Security mentioned but no specific compliance frameworks (GDPR, HIPAA, PCI-DSS) identified')
  } else {
    score = 0
    gaps.push('No compliance or security requirements specified')
  }

  return { name: 'Compliance & Security', score, gaps }
}

function scoreIntegrations(brd: ParsedBRD): HealthDimension {
  const count = brd.integrationHints?.length ?? 0
  let score: number
  const gaps: string[] = []

  if (count >= 2) {
    score = 100
  } else if (count === 1) {
    score = 50
    gaps.push('Only one third-party integration identified — review external dependencies')
  } else {
    score = 0
    gaps.push('No third-party integrations or external services identified')
  }

  return { name: 'Integrations', score, gaps }
}

function scoreEdgeCases(rawText: string): HealthDimension {
  const corpus = rawText.toLowerCase()
  const hits = EDGE_KEYWORDS.filter((kw) => corpus.includes(kw)).length
  let score: number
  const gaps: string[] = []

  if (hits >= 1) {
    score = 100
  } else {
    score = 0
    gaps.push('No error handling, failure states, or edge cases described — BRD covers the happy path only')
  }

  return { name: 'Edge Cases', score, gaps }
}

function scoreMonetisation(brd: ParsedBRD): HealthDimension {
  const m = brd.monetizationModel?.trim() ?? ''
  let score: number
  const gaps: string[] = []

  if (!m) {
    score = 0
    gaps.push('No monetisation model defined')
  } else if (m.length > 10) {
    score = 100
  } else {
    score = 50
    gaps.push('Monetisation model is vague — specify pricing strategy, tiers, or revenue model')
  }

  return { name: 'Monetisation', score, gaps }
}

// --- weights ---

const WEIGHTS: Record<string, number> = {
  'Product Purpose': 0.15,
  'User Types': 0.15,
  'Core Features': 0.20,
  'Non-Functional Requirements': 0.15,
  'Compliance & Security': 0.15,
  'Integrations': 0.10,
  'Edge Cases': 0.05,
  'Monetisation': 0.05,
}

// --- main export ---

export function calculateHealthScore(
  parsedBRD: ParsedBRD,
  rawText: string,
): BRDHealthReport {
  const dimensions: HealthDimension[] = [
    scoreProductPurpose(parsedBRD),
    scoreUserTypes(parsedBRD),
    scoreCoreFeatures(parsedBRD),
    scoreNonFunctionalRequirements(parsedBRD, rawText),
    scoreComplianceAndSecurity(parsedBRD),
    scoreIntegrations(parsedBRD),
    scoreEdgeCases(rawText),
    scoreMonetisation(parsedBRD),
  ]

  const total = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * (WEIGHTS[d.name] ?? 0), 0),
  )

  const gaps = dimensions.filter((d) => d.score < 60).flatMap((d) => d.gaps)

  const recommendations = dimensions
    .filter((d) => d.score < 60)
    .map((d) => {
      const weight = Math.round((WEIGHTS[d.name] ?? 0) * 100)
      return `Add ${d.name} detail (${weight}% of total score): ${d.gaps[0]}`
    })

  return { total, dimensions, gaps, recommendations }
}

// ── architecture health (confidence-based) ────────────────────────────────────
// Scores the rich ArchitectureDecisions extraction across 8 dimensions. A field
// "counts" only when it was extracted with confidence >= 0.7 (explicit or strongly
// inferable). Each dimension = (confident fields / total fields) * 100; overall =
// the unweighted average of the 8 dimensions.

const CONFIDENCE_THRESHOLD = 0.7

const HEALTH_DIMENSIONS: Record<string, (keyof ArchitectureDecisions)[]> = {
  'Product clarity':      ['appName', 'appType', 'coreFeatures', 'userTypes'],
  'Platform definition':  ['platform', 'coreUserJourneys'],
  'Architecture signals': ['multiTenant', 'deploymentModel', 'cloudProvider'],
  'Auth & security':      ['authMethod', 'mfaRequired', 'rbacRoles'],
  'Data model':           ['dbEngine', 'cacheLayer'],
  'Integration clarity':  ['paymentProvider', 'emailProvider', 'thirdPartyApis'],
  'Compliance awareness': ['gdprRequired', 'hipaaRequired', 'pciRequired', 'launchRegions'],
  'Scale & performance':  ['targetConcurrentUsers', 'uptimeSLA'],
}

// A field is "confident" when its confidence entry clears the threshold. Array
// fields fall back to "non-empty" when no explicit confidence score was provided.
function isConfident(field: keyof ArchitectureDecisions, d: ArchitectureDecisions): boolean {
  const score = d.confidence[field as string]
  if (typeof score === 'number') return score >= CONFIDENCE_THRESHOLD

  const value = d[field]
  if (Array.isArray(value)) return value.length > 0
  return false
}

export function calculateArchitectureHealth(d: ArchitectureDecisions): BRDHealthReport {
  const dimensions: HealthDimension[] = Object.entries(HEALTH_DIMENSIONS).map(([name, fields]) => {
    const confident = fields.filter((f) => isConfident(f, d))
    const score = Math.round((confident.length / fields.length) * 100)
    const missing = fields.filter((f) => !isConfident(f, d))
    const gaps =
      missing.length > 0
        ? [`Low confidence on: ${missing.join(', ')}`]
        : []
    return { name, score, gaps }
  })

  const total = Math.round(
    dimensions.reduce((sum, dim) => sum + dim.score, 0) / dimensions.length,
  )

  const gaps = dimensions.filter((dim) => dim.score < 60).flatMap((dim) => dim.gaps)

  const recommendations = dimensions
    .filter((dim) => dim.score < 60)
    .map((dim) => `Clarify ${dim.name} — ${dim.gaps[0] ?? 'add explicit detail to the BRD'}`)

  return { total, dimensions, gaps, recommendations }
}
