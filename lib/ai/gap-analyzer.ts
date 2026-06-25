import type { ArchitectureDecisions } from '@/types/brd'

// ── Public interfaces ─────────────────────────────────────────────────────────

export type GapInputType = 'text' | 'select' | 'multiselect' | 'boolean'

// An option whose stored value (a clean enum / array token) is separate from the
// human-friendly label shown in the wizard. value is what gets persisted, so it
// MUST match the enum the parser accepts (see brd-parser ENUM_FIELDS).
export interface GapOption {
  value: string
  label: string
}

// A question generated for a field the BRD did not confidently answer.
export interface GapQuestion {
  field:           string             // ArchitectureDecisions field name
  group:           string             // Foundation | Architecture | Auth & Security | Database | API | Integrations
  question:        string             // conversational prompt shown to the user
  aiGuess:         string | null      // what the parser inferred, or null if nothing
  preFilledAnswer: string | null      // inferred value (wizard input format) pre-selected
  confidence:      number             // current confidence (0.0–0.99)
  inputType:       GapInputType
  options:         GapOption[] | null // for select / multiselect
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

// ── Value & confidence helpers ────────────────────────────────────────────────

const ARRAY_DEFAULT_CONF = 0.8 // a non-empty extracted array counts as answered

// The parser only writes confidence entries for non-array fields, so for arrays we
// fall back to presence. This is why setup gating uses this, not raw confidence —
// otherwise a fully-populated coreFeatures/userTypes would always be re-asked.
function effectiveConfidence(field: keyof ArchitectureDecisions, d: ArchitectureDecisions): number {
  const explicit = d.confidence[field as string]
  if (typeof explicit === 'number') return explicit

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

// The inferred value in the EXACT format the wizard inputs expect, so it can be
// pre-selected: boolean → 'true'/'false', arrays → comma-joined, else the raw value.
function answerValueFor(field: keyof ArchitectureDecisions, d: ArchitectureDecisions): string | null {
  const v = d[field]
  if (v == null) return null
  if (Array.isArray(v)) return v.length > 0 ? v.join(', ') : null
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

// ── SETUP QUESTIONS (Group A — asked before generation starts) ─────────────────
// Fields owned or depended on by §01–§08. They are locked for every later section,
// so a blank here makes early sections generic. There is NO cap: every field below
// its threshold becomes a question. A detailed BRD → few/none; a vague BRD → many.

const opt = (value: string, label?: string): GapOption => ({ value, label: label ?? value })

interface SetupFieldMeta {
  field:          keyof ArchitectureDecisions
  group:          string
  threshold:      number
  question:       string
  inputType:      GapInputType
  options:        GapOption[] | null
  conditionalOn?: (d: ArchitectureDecisions) => boolean
}

// Payments are only worth asking about when the product clearly involves them.
function featuresImplyPayments(d: ArchitectureDecisions): boolean {
  if (['marketplace', 'ecommerce', 'fintech', 'booking'].includes(d.appType ?? '')) return true
  const text = [...d.coreFeatures, ...d.coreUserJourneys].join(' ').toLowerCase()
  return /pay|payment|checkout|subscrib|billing|purchase|\bbuy\b|\bsell\b|order|invoice|wallet|transaction/.test(text)
}

const SETUP_FIELDS: SetupFieldMeta[] = [
  // ── Foundation (needed by §01) ──────────────────────────────────────────────
  { field: 'appName', group: 'Foundation', threshold: 0.8,
    question: 'What is your app called?', inputType: 'text', options: null },
  { field: 'appType', group: 'Foundation', threshold: 0.7,
    question: 'What type of product is this?', inputType: 'select',
    options: ['marketplace','b2b-saas','consumer','ecommerce','ai-tool','productivity','social','booking','fintech','healthtech'].map((v) => opt(v)) },
  { field: 'platform', group: 'Foundation', threshold: 0.7,
    question: 'Which platforms will it run on?', inputType: 'select',
    options: ['web','mobile','both'].map((v) => opt(v)) },
  { field: 'userTypes', group: 'Foundation', threshold: 0.6,
    question: 'Who are the main types of users? (e.g. admin, customer, vendor)', inputType: 'text', options: null },
  { field: 'coreFeatures', group: 'Foundation', threshold: 0.5,
    question: 'What are the core features of your app? (comma-separated)', inputType: 'text', options: null },
  { field: 'track', group: 'Foundation', threshold: 0.6,
    question: 'Is this a quick MVP or a full production build?', inputType: 'select',
    options: [opt('FAST', 'FAST — MVP in weeks'), opt('FULL', 'FULL — Production with all sections')] },

  // ── Architecture (needed by §05) ──────────────────────────────────────────────
  { field: 'multiTenant', group: 'Architecture', threshold: 0.6,
    question: 'Will multiple separate organisations each have their own isolated workspace? (e.g. Slack — each company is a tenant)',
    inputType: 'boolean', options: null },
  { field: 'tenancyModel', group: 'Architecture', threshold: 0.6,
    question: "How should each tenant's data be isolated?", inputType: 'select',
    options: [
      opt('row-level', 'row-level — shared DB, filter by tenantId (simplest)'),
      opt('schema-per-tenant', 'schema-per-tenant — separate DB schema per tenant'),
      opt('database-per-tenant', 'database-per-tenant — fully separate DB per tenant (most isolated)'),
    ],
    conditionalOn: (d) => d.multiTenant === true },
  { field: 'deploymentModel', group: 'Architecture', threshold: 0.5,
    question: 'What backend architecture do you prefer?', inputType: 'select',
    options: [
      opt('modular-monolith', 'modular-monolith — one codebase, separate modules (recommended)'),
      opt('microservices', 'microservices — separate services per domain'),
      opt('monolith', 'monolith — single simple codebase'),
    ] },
  { field: 'cloudProvider', group: 'Architecture', threshold: 0.5,
    question: 'Which cloud provider will you deploy to?', inputType: 'select',
    options: ['Railway','Vercel','AWS','GCP','Azure'].map((v) => opt(v)) },

  // ── Auth & Security (needed by §06) ───────────────────────────────────────────
  { field: 'authMethod', group: 'Auth & Security', threshold: 0.6,
    question: 'How should users authenticate? How should sessions be managed?', inputType: 'select',
    options: [
      opt('JWT', 'JWT — stateless tokens (recommended for APIs)'),
      opt('sessions', 'sessions — server-side sessions'),
      opt('opaque-tokens', 'opaque-tokens — database-backed tokens'),
    ] },
  { field: 'socialProviders', group: 'Auth & Security', threshold: 0.5,
    question: 'Which social login options do you need? (select all that apply)', inputType: 'multiselect',
    options: [opt('Google'), opt('GitHub'), opt('Facebook'), opt('Apple'), opt('None', 'None — email/password only')] },
  { field: 'mfaRequired', group: 'Auth & Security', threshold: 0.5,
    question: 'Do users need multi-factor authentication (MFA)?', inputType: 'boolean', options: null },
  { field: 'rbacRoles', group: 'Auth & Security', threshold: 0.5,
    question: 'What user roles need different permission levels? (e.g. admin, editor, viewer)', inputType: 'text', options: null },

  // ── Database (needed by §07) ──────────────────────────────────────────────────
  { field: 'dbEngine', group: 'Database', threshold: 0.6,
    question: 'Which database engine will you use?', inputType: 'select',
    options: [opt('PostgreSQL', 'PostgreSQL (recommended)'), opt('MySQL'), opt('MongoDB'), opt('SQLite')] },
  { field: 'cacheLayer', group: 'Database', threshold: 0.5,
    question: 'Do you need a cache layer for performance?', inputType: 'select',
    options: [opt('Redis', 'Redis (recommended)'), opt('Memcached'), opt('none', 'None')] },
  { field: 'searchEngine', group: 'Database', threshold: 0.5,
    question: 'Do you need full-text search?', inputType: 'select',
    options: [
      opt('pg-fulltext', 'pg-fulltext — built into PostgreSQL (simplest)'),
      opt('Elasticsearch', 'Elasticsearch — dedicated search engine'),
      opt('Algolia', 'Algolia — hosted search service'),
      opt('none', 'None'),
    ] },

  // ── API (needed by §08) ───────────────────────────────────────────────────────
  { field: 'apiStyle', group: 'API', threshold: 0.6,
    question: 'What API style will you use?', inputType: 'select',
    options: [opt('REST', 'REST (recommended)'), opt('GraphQL'), opt('tRPC', 'tRPC — TypeScript end-to-end')] },
  { field: 'needsPublicAPI', group: 'API', threshold: 0.5,
    question: 'Will you expose a public API for third-party developers?', inputType: 'boolean', options: null },

  // ── Integrations (needed by §12) ──────────────────────────────────────────────
  { field: 'paymentProvider', group: 'Integrations', threshold: 0.5,
    question: 'Which payment provider will you use?', inputType: 'select',
    options: [opt('Stripe'), opt('Razorpay'), opt('PayPal'), opt('none', 'None — no payments needed')],
    conditionalOn: featuresImplyPayments },
  { field: 'emailProvider', group: 'Integrations', threshold: 0.4,
    question: 'Which service will send transactional emails (welcome, password reset, notifications)?', inputType: 'select',
    options: [opt('Resend', 'Resend (recommended)'), opt('SendGrid'), opt('Postmark'), opt('Nodemailer/SMTP')] },

  // ── Real-time & Storage (formerly mid-gen pauses for §09 / §10) ───────────────
  { field: 'needsRealtime', group: 'Real-time & Storage', threshold: 0.5,
    question: 'Does your app need real-time features? (live chat, live tracking, collaborative editing, live dashboards)',
    inputType: 'boolean', options: null },
  { field: 'realtimeMethod', group: 'Real-time & Storage', threshold: 0.5,
    question: 'Which real-time method suits your app?', inputType: 'select',
    options: [
      opt('WebSocket', 'WebSocket — bidirectional (chat, presence, collaboration)'),
      opt('SSE', 'SSE — server-push only (notifications, live feeds)'),
      opt('polling', 'Polling — periodic refresh (simplest)'),
    ],
    conditionalOn: (d) => d.needsRealtime === true },
  { field: 'needsFileStorage', group: 'Real-time & Storage', threshold: 0.5,
    question: 'Will users upload files, images, videos, or documents?',
    inputType: 'boolean', options: null },
  { field: 'fileStorageProvider', group: 'Real-time & Storage', threshold: 0.5,
    question: 'Which file storage provider will you use?', inputType: 'select',
    options: [
      opt('Supabase Storage', 'Supabase Storage — simple, S3-compatible'),
      opt('S3', 'AWS S3 — industry standard'),
      opt('Cloudinary', 'Cloudinary — images / video with transforms'),
    ],
    conditionalOn: (d) => d.needsFileStorage === true },

  // ── Compliance & Data (formerly mid-gen pauses for §18 / §20) ─────────────────
  { field: 'gdprRequired', group: 'Compliance & Data', threshold: 0.5,
    question: 'Will you serve users in the EU? (GDPR)', inputType: 'boolean', options: null },
  { field: 'hipaaRequired', group: 'Compliance & Data', threshold: 0.5,
    question: 'Will your app handle any health, medical, or clinical data? (HIPAA)',
    inputType: 'boolean', options: null },
  { field: 'pciRequired', group: 'Compliance & Data', threshold: 0.5,
    question: 'Will you store or process raw credit-card data? (PCI-DSS)', inputType: 'boolean', options: null },
  { field: 'launchRegions', group: 'Compliance & Data', threshold: 0.5,
    question: 'Which countries or regions are you launching in? (comma-separated)', inputType: 'text', options: null },
  { field: 'sensitiveDataTypes', group: 'Compliance & Data', threshold: 0.5,
    question: 'What sensitive data will your app store? (comma-separated)', inputType: 'text', options: null },

  // ── Internationalisation (formerly mid-gen pause for §31) ─────────────────────
  { field: 'multiLanguage', group: 'Internationalisation', threshold: 0.5,
    question: 'Does your app need to support multiple languages?', inputType: 'boolean', options: null },
  { field: 'languages', group: 'Internationalisation', threshold: 0.5,
    question: 'Which languages do you need to support? (comma-separated, e.g. English, Hindi, French)',
    inputType: 'text', options: null,
    conditionalOn: (d) => d.multiLanguage === true },
]

// Returns a question for EVERY setup field below its confidence threshold — no cap.
export function getSetupQuestions(decisions: ArchitectureDecisions): GapQuestion[] {
  const out: GapQuestion[] = []

  for (const meta of SETUP_FIELDS) {
    const conf = effectiveConfidence(meta.field, decisions)
    if (conf >= meta.threshold) continue                              // BRD answered it
    if (meta.conditionalOn && !meta.conditionalOn(decisions)) continue // not applicable

    out.push({
      field:           meta.field as string,
      group:           meta.group,
      question:        meta.question,
      aiGuess:         conf > 0 ? aiGuessFor(meta.field, decisions) : null,
      preFilledAnswer: conf > 0 ? answerValueFor(meta.field, decisions) : null,
      confidence:      Math.min(Math.round(conf * 100) / 100, 0.99),
      inputType:       meta.inputType,
      options:         meta.options,
    })
  }

  return out
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
