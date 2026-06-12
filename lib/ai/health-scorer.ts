import type { ParsedBRD, BRDHealthReport, HealthDimension } from '@/types'

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
