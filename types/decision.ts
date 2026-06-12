export interface Assumption {
  field: string
  value: string
  reason: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface SectionDecision {
  sectionNum: string
  sectionName: string
  completedAt: string
  decisions: Record<string, unknown>
  downstreamDependencies: string[]
  confidence: number
  assumptions: Assumption[]
}

export interface DecisionGraph {
  projectId: string
  version: number
  sections: Record<string, SectionDecision>
  updatedAt: string
}

export interface SectionImpact {
  sectionNum: string
  sectionName: string
  impactLevel: 'BREAKING' | 'REVIEW' | 'SAFE'
  reason: string
  affectedDecisions: string[]
}

export interface ChangeAnalysis {
  summary: string
  changedAreas: string[]
  impactedSections: SectionImpact[]
  isBreaking: boolean
}
