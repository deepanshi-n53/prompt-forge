import type { ArchitectureDecisions } from '@/types/brd'

// ── Public interfaces ─────────────────────────────────────────────────────────

export type GapInputType = 'text' | 'select' | 'multiselect' | 'boolean'

// A question is generated ONLY for a field the BRD did not confidently answer.
export interface GapQuestion {
  field:      string                 // ArchitectureDecisions field name
  group:      string                 // Foundation | Architecture | Auth & Security | Integrations | Compliance
  question:   string                 // conversational prompt shown to the user
  aiGuess:    string | null          // what the parser inferred, or null if nothing
  confidence: number                 // current confidence (0.0–0.69)
  inputType:  GapInputType
  options:    string[] | null        // for select / multiselect
}

export interface BRDInsight {
  field:      string
  label:      string
  value:      string                 // formatted value, or 'Unknown'
  confidence: number                 // 0.0–1.0
}

export interface InsightGroup {
  title:    string
  insights: BRDInsight[]
}

// ── Tunables ──────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.7
const MAX_QUESTIONS = 12

// Critical fields in PRIORITY order. Earlier entries survive the 12-question cap.
interface FieldMeta {
  field:     keyof ArchitectureDecisions
  group:     string
  question:  string
  inputType: GapInputType
  options:   string[] | null
}

const CRITICAL_FIELDS: FieldMeta[] = [
  // ── Foundation ──────────────────────────────────────────────────────────────
  { field: 'appName',  group: 'Foundation', question: 'What is your app called?', inputType: 'text', options: null },
  { field: 'appType',  group: 'Foundation', question: 'What type of product is this?', inputType: 'select',
    options: ['marketplace', 'b2b-saas', 'consumer', 'ecommerce', 'ai-tool', 'productivity', 'social', 'booking', 'fintech', 'healthtech'] },
  { field: 'platform', group: 'Foundation', question: 'Which platforms will it run on?', inputType: 'select',
    options: ['web', 'mobile', 'both'] },
  { field: 'userTypes',    group: 'Foundation', question: 'Who are the main types of users? (comma-separated)', inputType: 'text', options: null },
  { field: 'coreFeatures', group: 'Foundation', question: 'What are the core features? (comma-separated)', inputType: 'text', options: null },

  // ── Architecture ────────────────────────────────────────────────────────────
  { field: 'multiTenant',     group: 'Architecture', question: 'Will multiple separate organizations use this as isolated workspaces?', inputType: 'boolean', options: null },
  { field: 'tenancyModel',    group: 'Architecture', question: 'How should each tenant’s data be isolated?', inputType: 'select',
    options: ['row-level', 'schema-per-tenant', 'database-per-tenant'] },
  { field: 'deploymentModel', group: 'Architecture', question: 'What backend architecture do you prefer?', inputType: 'select',
    options: ['monolith', 'modular-monolith', 'microservices'] },
  { field: 'needsRealtime',   group: 'Architecture', question: 'Does your app need real-time features like live chat, live tracking, or live notifications?', inputType: 'boolean', options: null },
  { field: 'needsFileStorage', group: 'Architecture', question: 'Will users upload files, images, or documents?', inputType: 'boolean', options: null },

  // ── Auth & Security ─────────────────────────────────────────────────────────
  { field: 'authMethod',  group: 'Auth & Security', question: 'How should users stay authenticated?', inputType: 'select',
    options: ['JWT', 'sessions', 'opaque-tokens'] },
  { field: 'mfaRequired', group: 'Auth & Security', question: 'Do users need multi-factor authentication (MFA)?', inputType: 'boolean', options: null },
  { field: 'rbacRoles',   group: 'Auth & Security', question: 'What user roles need different permission levels? (comma-separated)', inputType: 'text', options: null },

  // ── Integrations ────────────────────────────────────────────────────────────
  { field: 'paymentProvider', group: 'Integrations', question: 'Will your app process payments? If so, which provider?', inputType: 'select',
    options: ['Stripe', 'Razorpay', 'PayPal', 'none'] },
  { field: 'emailProvider',   group: 'Integrations', question: 'Which service will send your transactional emails?', inputType: 'text', options: null },

  // ── Compliance ──────────────────────────────────────────────────────────────
  { field: 'gdprRequired',  group: 'Compliance', question: 'Will you serve users in the EU (requiring GDPR compliance)?', inputType: 'boolean', options: null },
  { field: 'hipaaRequired', group: 'Compliance', question: 'Will your app handle health or medical data (requiring HIPAA)?', inputType: 'boolean', options: null },
  { field: 'pciRequired',   group: 'Compliance', question: 'Will you store raw credit-card data (requiring PCI-DSS)?', inputType: 'boolean', options: null },
  { field: 'launchRegions', group: 'Compliance', question: 'Which countries or regions are you launching in? (comma-separated)', inputType: 'text', options: null },
]

// ── Value & confidence helpers ────────────────────────────────────────────────

const ARRAY_DEFAULT_CONF = 0.8 // a non-empty extracted array counts as answered

function effectiveConfidence(field: keyof ArchitectureDecisions, d: ArchitectureDecisions): number {
  const explicit = d.confidence[field as string]
  if (typeof explicit === 'number') return explicit

  // Fall back to value presence when the parser omitted a confidence entry.
  const value = d[field]
  if (Array.isArray(value)) return value.length > 0 ? ARRAY_DEFAULT_CONF : 0
  if (value == null) return 0
  return 0.5
}

function displayValue(field: keyof ArchitectureDecisions, d: ArchitectureDecisions): string {
  const v = d[field]
  if (v == null) return 'Unknown'
  if (Array.isArray(v)) return v.length > 0 ? v.join(', ') : 'Unknown'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') return String(v)
  return v as string
}

function aiGuessFor(field: keyof ArchitectureDecisions, d: ArchitectureDecisions): string | null {
  const v = d[field]
  if (v == null) return null
  if (Array.isArray(v) && v.length === 0) return null
  return displayValue(field, d)
}

// ── Gap detection ─────────────────────────────────────────────────────────────

// Returns questions ONLY for fields whose confidence is below the threshold,
// ordered by criticalness and capped at MAX_QUESTIONS.
export function analyzeGaps(decisions: ArchitectureDecisions): GapQuestion[] {
  const gaps: GapQuestion[] = []

  for (const meta of CRITICAL_FIELDS) {
    const conf = effectiveConfidence(meta.field, decisions)
    if (conf >= CONFIDENCE_THRESHOLD) continue // BRD already answered this

    gaps.push({
      field:      meta.field as string,
      group:      meta.group,
      question:   meta.question,
      aiGuess:    aiGuessFor(meta.field, decisions),
      confidence: Math.min(Math.round(conf * 100) / 100, 0.69),
      inputType:  meta.inputType,
      options:    meta.options,
    })

    if (gaps.length >= MAX_QUESTIONS) break
  }

  return gaps
}

// ── BRD insights (what the AI understood) ─────────────────────────────────────

interface InsightFieldMeta {
  field:  keyof ArchitectureDecisions
  label:  string
  format?: (d: ArchitectureDecisions) => string
}

function platformLabel(d: ArchitectureDecisions): string {
  if (d.platform === 'both')   return 'Web + Mobile'
  if (d.platform === 'web')    return 'Web'
  if (d.platform === 'mobile') return 'Mobile'
  return 'Unknown'
}

function paymentLabel(d: ArchitectureDecisions): string {
  if (d.paymentProvider == null) return 'Unknown'
  if (d.paymentProvider === 'none') return 'No payments'
  return d.needsPaymentSplit ? `${d.paymentProvider} (with splits)` : d.paymentProvider
}

const INSIGHT_GROUPS: { title: string; fields: InsightFieldMeta[] }[] = [
  {
    title: 'App Overview',
    fields: [
      { field: 'appName',  label: 'App name' },
      { field: 'appType',  label: 'App type' },
      { field: 'platform', label: 'Platform', format: platformLabel },
    ],
  },
  {
    title: 'Users & Features',
    fields: [
      { field: 'userTypes',    label: 'User types' },
      { field: 'coreFeatures', label: 'Core features' },
    ],
  },
  {
    title: 'Architecture Signals',
    fields: [
      { field: 'multiTenant',      label: 'Multi-tenant' },
      { field: 'paymentProvider',  label: 'Payment model', format: paymentLabel },
      { field: 'needsRealtime',    label: 'Real-time' },
      { field: 'needsFileStorage', label: 'File storage' },
    ],
  },
  {
    title: 'Compliance',
    fields: [
      { field: 'launchRegions',      label: 'Launch regions' },
      { field: 'sensitiveDataTypes', label: 'Sensitive data' },
      { field: 'gdprRequired',       label: 'GDPR' },
      { field: 'hipaaRequired',      label: 'HIPAA' },
    ],
  },
]

export function buildInsights(decisions: ArchitectureDecisions): InsightGroup[] {
  return INSIGHT_GROUPS.map((group) => ({
    title: group.title,
    insights: group.fields.map((meta) => ({
      field:      meta.field as string,
      label:      meta.label,
      value:      meta.format ? meta.format(decisions) : displayValue(meta.field, decisions),
      confidence: effectiveConfidence(meta.field, decisions),
    })),
  }))
}

// ── Confidence summary (for the wizard header counters) ───────────────────────

export function summarizeConfidence(decisions: ArchitectureDecisions): {
  confirmed: number
  inferred:  number
  unknown:   number
} {
  let confirmed = 0
  let inferred = 0
  let unknown = 0

  for (const group of INSIGHT_GROUPS) {
    for (const meta of group.fields) {
      const c = effectiveConfidence(meta.field, decisions)
      if (c >= 0.9) confirmed++
      else if (c >= 0.5) inferred++
      else unknown++
    }
  }

  return { confirmed, inferred, unknown }
}
