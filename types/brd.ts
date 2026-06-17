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

// ── Architecture extraction ───────────────────────────────────────────────────
// Rich, flat decision set extracted directly from a BRD by GPT-4o. Every field
// carries an entry in `confidence` keyed by the same field name:
//   1.0 = explicitly stated · 0.7 = strongly inferable · 0.4 = weakly inferable · 0.0 = absent
export interface ArchitectureDecisions {
  // Product
  appName: string | null
  appType:
    | 'marketplace' | 'b2b-saas' | 'consumer' | 'ecommerce' | 'ai-tool'
    | 'productivity' | 'social' | 'booking' | 'fintech' | 'healthtech' | null
  platform: 'web' | 'mobile' | 'both' | null
  track: 'FAST' | 'FULL' | null
  coreUserJourneys: string[]
  userTypes: string[]
  coreFeatures: string[]
  outOfScope: string[]

  // Scale & performance
  targetConcurrentUsers: number | null
  p95ResponseTime: string | null
  uptimeSLA: string | null

  // Architecture
  multiTenant: boolean | null
  tenancyModel: 'row-level' | 'schema-per-tenant' | 'database-per-tenant' | null
  deploymentModel: 'monolith' | 'microservices' | 'modular-monolith' | null
  cloudProvider: 'AWS' | 'GCP' | 'Azure' | 'Vercel' | 'Railway' | null

  // Auth & security
  authMethod: 'JWT' | 'sessions' | 'opaque-tokens' | null
  socialProviders: string[]
  mfaRequired: boolean | null
  rbacRoles: string[]

  // Data
  dbEngine: 'PostgreSQL' | 'MySQL' | 'MongoDB' | 'SQLite' | null
  cacheLayer: 'Redis' | 'Memcached' | 'none' | null
  searchEngine: 'Elasticsearch' | 'Algolia' | 'pg-fulltext' | 'none' | null

  // API & realtime
  apiStyle: 'REST' | 'GraphQL' | 'tRPC' | null
  needsPublicAPI: boolean | null
  needsRealtime: boolean | null
  realtimeMethod: 'WebSocket' | 'SSE' | 'polling' | null

  // Files
  needsFileStorage: boolean | null
  fileStorageProvider: 'S3' | 'Supabase Storage' | 'Cloudinary' | null

  // Payments
  paymentProvider: 'Stripe' | 'Razorpay' | 'PayPal' | 'none' | null
  needsPaymentSplit: boolean | null

  // Integrations & UI
  emailProvider: string | null
  thirdPartyApis: string[]
  componentLibrary: 'shadcn/ui' | 'MUI' | 'Chakra UI' | 'custom' | null
  darkModeRequired: boolean | null

  // Compliance & localisation
  launchRegions: string[]
  gdprRequired: boolean | null
  hipaaRequired: boolean | null
  pciRequired: boolean | null
  sensitiveDataTypes: string[]
  multiLanguage: boolean | null
  languages: string[]

  // Per-field confidence (0.0–1.0)
  confidence: Record<string, number>
}
