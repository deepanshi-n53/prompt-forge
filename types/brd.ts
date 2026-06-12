export interface Feature {
  id: string
  name: string
  description: string
  category: string
  priority: 'MUST' | 'SHOULD' | 'COULD' | 'WONT'
}

export interface HealthDimension {
  name: string
  score: number
  gaps: string[]
}

export interface ParsedBRD {
  archetype: string
  archetypeConfidence: number
  productPurpose: string
  userTypes: string[]
  coreFeatures: Feature[]
  platform: 'web' | 'mobile' | 'both'
  complianceHints: string[]
  integrationHints: string[]
  scalingHints: string
  monetizationModel: string
  healthScores: HealthDimension[]
  extractedDecisions: Record<string, unknown>
}

export interface BRDHealthReport {
  total: number
  dimensions: HealthDimension[]
  gaps: string[]
  recommendations: string[]
}
