import { createHash } from 'crypto'
import { Redis } from '@upstash/redis'
import { callAI } from './ai-client'
import { extractLocal, mergeExtractions, residualFields } from './local-extractor'
import type { ArchitectureDecisions, Feature, ParsedBRD } from '@/types'

// ── system prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert software architect. Your job is to extract architectural decisions from a Business Requirements Document (BRD).

CRITICAL RULES:
1. You MUST infer information even when not explicitly stated. A BRD that says "dog walking marketplace" means: appType=marketplace, userTypes=["dog owners","dog walkers"], paymentProvider="Stripe" (confidence 0.7), needsFileStorage=true (profile photos, confidence 0.7).
2. A healthcare BRD means hipaaRequired=true at confidence 0.7 even if not stated.
3. A fintech BRD means pciRequired=true at confidence 0.7, gdprRequired depends on regions.
4. Confidence scores: 1.0=explicitly stated word-for-word, 0.8=clearly implied by context, 0.6=reasonable inference from domain, 0.4=weak guess, 0.0=genuinely impossible to guess.
5. NEVER return 0.0 confidence for appName if ANY name is mentioned anywhere in the text.
6. NEVER return null for appType if the BRD describes any kind of software product.
7. For platform: if BRD mentions "website", "web app", "browser" → platform="web". If mentions "iOS", "Android", "mobile app" → platform="mobile". If mentions both → platform="both". Default guess if unclear: platform="web" at confidence 0.5.
8. For userTypes: extract EVERY type of user mentioned. "Admin" counts. "Customer" counts. Look for any noun describing who uses the system.
9. For coreFeatures: extract EVERY feature mentioned. List everything. No feature is too small.
10. Return ONLY valid JSON. No markdown. No explanation. No code fences.

Domain signals for the "track" field: "Enterprise", "compliance", "SSO", "audit", "high scale" → track="FULL". "MVP", "prototype", "quick", "simple", "validate an idea" → track="FAST". If neither signal is present, track=null.

Return a single valid JSON object with EXACTLY these keys (use null / [] ONLY when a value is
genuinely impossible to infer — see the rules above). Every non-array, non-confidence field
MUST have a matching entry in the "confidence" object:

{
  "appName": string|null,
  "appType": "marketplace"|"b2b-saas"|"consumer"|"ecommerce"|"ai-tool"|"productivity"|"social"|"booking"|"fintech"|"healthtech"|null,
  "platform": "web"|"mobile"|"both"|null,
  "track": "FAST"|"FULL"|null,
  "coreUserJourneys": string[],
  "userTypes": string[],
  "coreFeatures": string[],
  "outOfScope": string[],
  "targetConcurrentUsers": number|null,
  "p95ResponseTime": string|null,
  "uptimeSLA": string|null,
  "multiTenant": boolean|null,
  "tenancyModel": "row-level"|"schema-per-tenant"|"database-per-tenant"|null,
  "deploymentModel": "monolith"|"microservices"|"modular-monolith"|null,
  "cloudProvider": "AWS"|"GCP"|"Azure"|"Vercel"|"Railway"|null,
  "authMethod": "JWT"|"sessions"|"opaque-tokens"|null,
  "socialProviders": string[],
  "mfaRequired": boolean|null,
  "rbacRoles": string[],
  "dbEngine": "PostgreSQL"|"MySQL"|"MongoDB"|"SQLite"|null,
  "cacheLayer": "Redis"|"Memcached"|"none"|null,
  "searchEngine": "Elasticsearch"|"Algolia"|"pg-fulltext"|"none"|null,
  "apiStyle": "REST"|"GraphQL"|"tRPC"|null,
  "needsPublicAPI": boolean|null,
  "needsRealtime": boolean|null,
  "realtimeMethod": "WebSocket"|"SSE"|"polling"|null,
  "needsFileStorage": boolean|null,
  "fileStorageProvider": "S3"|"Supabase Storage"|"Cloudinary"|null,
  "paymentProvider": "Stripe"|"Razorpay"|"PayPal"|"none"|null,
  "needsPaymentSplit": boolean|null,
  "emailProvider": string|null,
  "thirdPartyApis": string[],
  "componentLibrary": "shadcn/ui"|"MUI"|"Chakra UI"|"custom"|null,
  "darkModeRequired": boolean|null,
  "launchRegions": string[],
  "gdprRequired": boolean|null,
  "hipaaRequired": boolean|null,
  "pciRequired": boolean|null,
  "sensitiveDataTypes": string[],
  "multiLanguage": boolean|null,
  "languages": string[],
  "confidence": { "<fieldName>": number }
}

Every non-array, non-confidence field must have a matching entry in "confidence".
All array fields must be arrays (use [] when empty). Never invent keys outside this schema.`

// ── canonical field list & defaults ───────────────────────────────────────────

const STRING_FIELDS = ['appName', 'p95ResponseTime', 'uptimeSLA', 'emailProvider'] as const

const ENUM_FIELDS: Record<string, readonly string[]> = {
  appType: ['marketplace', 'b2b-saas', 'consumer', 'ecommerce', 'ai-tool', 'productivity', 'social', 'booking', 'fintech', 'healthtech'],
  platform: ['web', 'mobile', 'both'],
  track: ['FAST', 'FULL'],
  tenancyModel: ['row-level', 'schema-per-tenant', 'database-per-tenant'],
  deploymentModel: ['monolith', 'microservices', 'modular-monolith'],
  cloudProvider: ['AWS', 'GCP', 'Azure', 'Vercel', 'Railway'],
  authMethod: ['JWT', 'sessions', 'opaque-tokens'],
  dbEngine: ['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite'],
  cacheLayer: ['Redis', 'Memcached', 'none'],
  searchEngine: ['Elasticsearch', 'Algolia', 'pg-fulltext', 'none'],
  apiStyle: ['REST', 'GraphQL', 'tRPC'],
  realtimeMethod: ['WebSocket', 'SSE', 'polling'],
  fileStorageProvider: ['S3', 'Supabase Storage', 'Cloudinary'],
  paymentProvider: ['Stripe', 'Razorpay', 'PayPal', 'none'],
  componentLibrary: ['shadcn/ui', 'MUI', 'Chakra UI', 'custom'],
}

const BOOLEAN_FIELDS = [
  'multiTenant', 'mfaRequired', 'needsPublicAPI', 'needsRealtime', 'needsFileStorage',
  'needsPaymentSplit', 'darkModeRequired', 'gdprRequired', 'hipaaRequired', 'pciRequired',
  'multiLanguage',
] as const

const ARRAY_FIELDS = [
  'coreUserJourneys', 'userTypes', 'coreFeatures', 'outOfScope', 'socialProviders',
  'rbacRoles', 'thirdPartyApis', 'launchRegions', 'sensitiveDataTypes', 'languages',
] as const

// ── normalisation ─────────────────────────────────────────────────────────────

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

function asEnum(v: unknown, allowed: readonly string[]): string | null {
  return typeof v === 'string' && allowed.includes(v) ? v : null
}

function asBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  return null
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

export function normalizeDecisions(raw: Record<string, unknown>): ArchitectureDecisions {
  const out = {} as Record<string, unknown>

  for (const f of STRING_FIELDS) out[f] = asString(raw[f])
  for (const [f, allowed] of Object.entries(ENUM_FIELDS)) out[f] = asEnum(raw[f], allowed)
  for (const f of BOOLEAN_FIELDS) out[f] = asBool(raw[f])
  for (const f of ARRAY_FIELDS) out[f] = asStringArray(raw[f])

  out.targetConcurrentUsers =
    typeof raw.targetConcurrentUsers === 'number' && Number.isFinite(raw.targetConcurrentUsers)
      ? raw.targetConcurrentUsers
      : null

  // confidence map — keep only numeric entries clamped to [0, 1]
  const confidence: Record<string, number> = {}
  if (raw.confidence != null && typeof raw.confidence === 'object' && !Array.isArray(raw.confidence)) {
    for (const [k, v] of Object.entries(raw.confidence as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        confidence[k] = Math.max(0, Math.min(1, v))
      }
    }
  }
  out.confidence = confidence

  return out as unknown as ArchitectureDecisions
}

function safeParseDecisions(text: string): ArchitectureDecisions {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const raw = JSON.parse(stripped) as Record<string, unknown>
  return normalizeDecisions(raw)
}

// ── answer merging ────────────────────────────────────────────────────────────
// Apply user-supplied gap answers onto a decision set. Every field the user
// answers is coerced to its proper type and pinned to confidence 1.0.

const ENUM_FIELD_SET = new Set(Object.keys(ENUM_FIELDS))
const BOOLEAN_FIELD_SET = new Set<string>(BOOLEAN_FIELDS)
const ARRAY_FIELD_SET = new Set<string>(ARRAY_FIELDS)
const STRING_FIELD_SET = new Set<string>(STRING_FIELDS)

export function applyAnswersToDecisions(
  base: ArchitectureDecisions,
  answers: Record<string, string | undefined>,
): ArchitectureDecisions {
  const next = { ...base, confidence: { ...base.confidence } }

  for (const [field, rawAnswer] of Object.entries(answers)) {
    if (rawAnswer == null || rawAnswer.trim() === '') continue

    const answer = rawAnswer.trim()
    let assigned = false

    if (field === 'targetConcurrentUsers') {
      const n = Number(answer.replace(/[^0-9.]/g, ''))
      if (Number.isFinite(n)) { (next as Record<string, unknown>).targetConcurrentUsers = n; assigned = true }
    } else if (BOOLEAN_FIELD_SET.has(field)) {
      const truthy = /^(true|yes|y|1)$/i.test(answer)
      const falsy = /^(false|no|n|0)$/i.test(answer)
      if (truthy || falsy) { (next as Record<string, unknown>)[field] = truthy; assigned = true }
    } else if (ARRAY_FIELD_SET.has(field)) {
      const arr = answer.split(',').map((s) => s.trim()).filter(Boolean)
      ;(next as Record<string, unknown>)[field] = arr
      assigned = true
    } else if (ENUM_FIELD_SET.has(field)) {
      if (ENUM_FIELDS[field].includes(answer)) { (next as Record<string, unknown>)[field] = answer; assigned = true }
    } else if (STRING_FIELD_SET.has(field)) {
      ;(next as Record<string, unknown>)[field] = answer
      assigned = true
    }

    if (assigned) next.confidence[field] = 1.0
  }

  return next
}

// Build a fully-defaulted (all null / empty) decision set — used when a BRD was
// parsed before rich extraction existed.
export function emptyDecisions(): ArchitectureDecisions {
  return normalizeDecisions({})
}

// ── re-upload merge ───────────────────────────────────────────────────────────
// Every canonical decision field (mirrors the field groups above) — used to walk
// both decision sets when merging a re-uploaded BRD.
const ALL_DECISION_FIELDS: readonly string[] = [
  ...STRING_FIELDS, ...Object.keys(ENUM_FIELDS), ...BOOLEAN_FIELDS, ...ARRAY_FIELDS,
  'targetConcurrentUsers',
]

// Effective confidence for a field: the parser's explicit score when present,
// otherwise presence-based (a populated array counts as answered). Mirrors the
// gap-analyzer's gating so "is this field answered?" means the same thing here.
function fieldConfidence(d: ArchitectureDecisions, field: string): number {
  const explicit = d.confidence[field]
  if (typeof explicit === 'number') return explicit
  const v = (d as unknown as Record<string, unknown>)[field]
  if (Array.isArray(v)) return v.length > 0 ? 0.8 : 0
  if (v == null || v === '') return 0
  return 0.5
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    const sa = [...a].sort(), sb = [...b].sort()
    return sa.every((x, i) => x === sb[i])
  }
  return a === b
}

// Carry a previous BRD version's decisions forward when a re-upload is parsed, so
// the setup wizard doesn't re-ask questions the user already answered. The prior
// set (base) holds the user's confirmed gap answers at confidence 1.0; the fresh
// parse of the NEW text overrides a field ONLY when it is at least as confident
// AND actually different — i.e. the new BRD genuinely changed that field. So a
// prior answer survives unless the new BRD restates it just as explicitly, while
// fields the prior never answered fall through to the fresh parse.
export function mergeDecisionsPreferringPrior(
  prior: ArchitectureDecisions,
  fresh: ArchitectureDecisions,
): ArchitectureDecisions {
  const out  = { ...prior, confidence: { ...prior.confidence } } as unknown as Record<string, unknown>
  const conf = out.confidence as Record<string, number>

  for (const field of ALL_DECISION_FIELDS) {
    const pv = (prior as unknown as Record<string, unknown>)[field]
    const fv = (fresh as unknown as Record<string, unknown>)[field]

    const freshHasValue = Array.isArray(fv) ? fv.length > 0 : fv != null && fv !== ''
    if (!freshHasValue) continue            // fresh parse says nothing new
    if (valuesEqual(pv, fv)) continue       // unchanged

    if (fieldConfidence(fresh, field) >= fieldConfidence(prior, field)) {
      out[field] = fv
      conf[field] = fresh.confidence[field] ?? fieldConfidence(fresh, field)
    }
  }

  return normalizeDecisions(out)
}

// ── legacy bridge ─────────────────────────────────────────────────────────────
// Map the rich extraction onto the legacy ParsedBRD shape so existing consumers
// (generate-prompts, decision-builder, archetype-detector, gap-analyzer) keep
// working — now fed with real extracted data instead of stubs.

const APP_TYPE_TO_ARCHETYPE: Record<string, string> = {
  marketplace: 'marketplace',
  booking: 'marketplace',
  'b2b-saas': 'b2b-saas',
  productivity: 'b2b-saas',
  fintech: 'b2b-saas',
  healthtech: 'b2b-saas',
  consumer: 'consumer-app',
  social: 'consumer-app',
  ecommerce: 'ecommerce',
  'ai-tool': 'ai-tool',
}

export function decisionsToParsedBRD(d: ArchitectureDecisions): ParsedBRD {
  const archetype = d.appType ? (APP_TYPE_TO_ARCHETYPE[d.appType] ?? 'b2b-saas') : 'b2b-saas'

  const coreFeatures: Feature[] = d.coreFeatures.map((name, i) => ({
    id: String(i + 1),
    name,
    description: '',
    category: 'core',
    priority: 'MUST',
  }))

  const complianceHints: string[] = []
  if (d.gdprRequired) complianceHints.push('GDPR')
  if (d.hipaaRequired) complianceHints.push('HIPAA')
  if (d.pciRequired) complianceHints.push('PCI-DSS')
  complianceHints.push(...d.sensitiveDataTypes)
  if (d.mfaRequired) complianceHints.push('MFA / multi-factor authentication')

  const integrationHints: string[] = []
  if (d.paymentProvider && d.paymentProvider !== 'none') integrationHints.push(d.paymentProvider)
  if (d.emailProvider) integrationHints.push(d.emailProvider)
  if (d.fileStorageProvider) integrationHints.push(d.fileStorageProvider)
  if (d.searchEngine && d.searchEngine !== 'none') integrationHints.push(d.searchEngine)
  if (d.cacheLayer && d.cacheLayer !== 'none') integrationHints.push(d.cacheLayer)
  integrationHints.push(...d.thirdPartyApis)

  const scalingParts: string[] = []
  if (d.targetConcurrentUsers != null) scalingParts.push(`${d.targetConcurrentUsers} concurrent users`)
  if (d.uptimeSLA) scalingParts.push(`${d.uptimeSLA} uptime SLA`)
  if (d.p95ResponseTime) scalingParts.push(`p95 response time ${d.p95ResponseTime}`)
  if (d.deploymentModel) scalingParts.push(`${d.deploymentModel} deployment`)

  const monetizationParts: string[] = []
  if (d.paymentProvider && d.paymentProvider !== 'none') {
    monetizationParts.push(`Payments via ${d.paymentProvider}`)
    if (d.needsPaymentSplit) monetizationParts.push('with marketplace payment splits')
  }

  const purpose =
    d.coreUserJourneys.length > 0
      ? d.coreUserJourneys.join('; ')
      : [d.appName, d.appType ? `a ${d.appType} product` : null].filter(Boolean).join(' — ')

  return {
    archetype,
    archetypeConfidence: d.confidence.appType ?? 0,
    productPurpose: purpose,
    userTypes: d.userTypes,
    coreFeatures,
    platform: d.platform ?? 'web',
    complianceHints,
    integrationHints,
    scalingHints: scalingParts.join(', '),
    monetizationModel: monetizationParts.join(' '),
    healthScores: [],
    extractedDecisions: {},
  }
}

// ── mock fixture ──────────────────────────────────────────────────────────────

function mockDecisions(): ArchitectureDecisions {
  return normalizeDecisions({
    appName: 'PawWalk',
    appType: 'marketplace',
    platform: 'both',
    track: 'FAST',
    coreUserJourneys: [
      'Dog owner books a walk and tracks the walker live on a map',
      'Walker accepts a request, completes the walk, and gets paid',
    ],
    userTypes: ['dog owners', 'dog walkers', 'admins'],
    coreFeatures: ['Booking', 'Live GPS tracking', 'In-app payments', 'Ratings & reviews', 'Walker onboarding'],
    outOfScope: ['Veterinary services'],
    targetConcurrentUsers: 5000,
    p95ResponseTime: '300ms',
    uptimeSLA: '99.9%',
    multiTenant: false,
    tenancyModel: null,
    deploymentModel: 'modular-monolith',
    cloudProvider: 'Vercel',
    authMethod: 'JWT',
    socialProviders: ['Google', 'Apple'],
    mfaRequired: false,
    rbacRoles: ['owner', 'walker', 'admin'],
    dbEngine: 'PostgreSQL',
    cacheLayer: 'Redis',
    searchEngine: 'pg-fulltext',
    apiStyle: 'REST',
    needsPublicAPI: false,
    needsRealtime: true,
    realtimeMethod: 'WebSocket',
    needsFileStorage: true,
    fileStorageProvider: 'S3',
    paymentProvider: 'Stripe',
    needsPaymentSplit: true,
    emailProvider: 'Resend',
    thirdPartyApis: ['Google Maps', 'Twilio'],
    componentLibrary: 'shadcn/ui',
    darkModeRequired: true,
    launchRegions: ['US', 'EU'],
    gdprRequired: true,
    hipaaRequired: false,
    pciRequired: false,
    sensitiveDataTypes: ['location', 'payment'],
    multiLanguage: false,
    languages: ['en'],
    confidence: {
      appName: 1.0, appType: 0.7, platform: 0.7, track: 0.7, targetConcurrentUsers: 0.4,
      p95ResponseTime: 0.4, uptimeSLA: 0.4, multiTenant: 0.4, deploymentModel: 0.4,
      cloudProvider: 0.4, authMethod: 0.4, mfaRequired: 0.4, dbEngine: 0.4, cacheLayer: 0.4,
      searchEngine: 0.4, apiStyle: 0.7, needsPublicAPI: 0.4, needsRealtime: 0.7,
      realtimeMethod: 0.4, needsFileStorage: 0.7, fileStorageProvider: 0.4, paymentProvider: 0.7,
      needsPaymentSplit: 0.7, emailProvider: 0.4, componentLibrary: 0.4, darkModeRequired: 0.4,
      gdprRequired: 0.7, hipaaRequired: 0.0, pciRequired: 0.4, multiLanguage: 0.4,
    },
  })
}

// ── content-hash cache (fail-open) ────────────────────────────────────────────
// Identical BRD text → identical decisions, so extraction results are cached
// keyed by a hash of the (trimmed) text. Mirrors the lib/jobs/redis.ts pattern:
// a lazy Upstash singleton, with every Redis touch wrapped so an outage simply
// falls back to parsing normally (fail open) instead of throwing.

const EXTRACT_CACHE_TTL_SECONDS = 60 * 60 * 24 // 24h
const MAX_EXTRACT_CHARS = 12_000

let _redis: Redis | null | undefined = undefined

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    _redis = null
    return null
  }
  try {
    _redis = Redis.fromEnv()
  } catch (err) {
    console.warn('[brd-parser] Redis init failed — extraction cache disabled', err)
    _redis = null
  }
  return _redis
}

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

async function getCachedDecisions(key: string): Promise<ArchitectureDecisions | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const raw = await redis.get<unknown>(key)
    if (raw == null) return null
    // Re-normalise the stored value so the returned shape is guaranteed identical
    // to a fresh parse, regardless of how Upstash deserialised it.
    return normalizeDecisions(raw as Record<string, unknown>)
  } catch (err) {
    console.warn('[brd-parser] extraction cache read failed', err)
    return null
  }
}

async function setCachedDecisions(key: string, decisions: ArchitectureDecisions): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(key, decisions, { ex: EXTRACT_CACHE_TTL_SECONDS })
  } catch (err) {
    console.warn('[brd-parser] extraction cache write failed', err)
  }
}

// The populated fields of a decision set: non-null scalars and non-empty arrays
// (`confidence` is a metadata map, not a decision). Used both to summarise what
// extraction found in logs and to decide whether a result is worth caching.
function populatedFields(d: ArchitectureDecisions): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(d)) {
    if (k === 'confidence' || v == null) continue
    if (Array.isArray(v)) { if (v.length > 0) out[k] = v; continue }
    if (typeof v === 'string' && v.trim() === '') continue
    out[k] = v
  }
  return out
}

// True when extraction found at least one real decision. An all-null/empty result
// is the symptom of a broken upstream run — never cache it, or the empty value
// gets served back as a "hit" and every later parse of that text stays blank.
// Also used by the setup page to choose between the BRD's embedded decisions and
// the DecisionGraph, preferring whichever is actually populated.
export function hasAnyDecision(d: ArchitectureDecisions): boolean {
  return Object.keys(populatedFields(d)).length > 0
}

// ── public API ────────────────────────────────────────────────────────────────

// Rich extraction — the source of truth for confidence-aware downstream stages.
// Local-first: cheap heuristics run before any AI call. If they cover everything,
// the AI call is skipped; otherwise the AI fills the gaps and the two are merged
// (higher confidence wins per field). Identical text is served from a cache.
export async function extractArchitectureDecisions(rawText: string): Promise<ArchitectureDecisions> {
  if (process.env.AI_PROVIDER === 'mock') {
    return mockDecisions()
  }

  const trimmed = rawText.slice(0, MAX_EXTRACT_CHARS)

  // Cache hit on identical text → no extraction work at all.
  const cacheKey = `brd-extract:${hashText(trimmed)}`
  const cached = await getCachedDecisions(cacheKey)
  if (cached) return cached

  // Local heuristics first — they often pin named tech / compliance outright.
  const local = extractLocal(trimmed)

  let result: ArchitectureDecisions
  if (residualFields(local).length === 0) {
    // Nothing left to infer — skip the AI call entirely.
    result = local
  } else {
    const response = await callAI(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Here is the BRD text. Extract all architectural decisions:\n\n${trimmed}` },
      ],
      4096,
      // Greedy decoding so the same BRD always yields the same decisions (and score).
      { temperature: 0, seed: 42 },
    )
    const ai = safeParseDecisions(response.text)
    // Higher-confidence value wins per field (explicit local hits beat AI guesses;
    // AI fills everything local couldn't).
    result = mergeExtractions(local, ai)
  }

  // Only cache a result that actually found something. Caching an all-null/empty
  // result would serve it back as a "hit" and keep every later parse blank — the
  // exact failure that motivated clearing the stale brd-extract:* keys.
  if (hasAnyDecision(result)) {
    await setCachedDecisions(cacheKey, result)
  }
  return result
}

// Backwards-compatible entry point. Signature unchanged; now backed by the rich
// extractor and mapped onto the legacy ParsedBRD shape.
export async function parseBRDWithAI(rawText: string): Promise<ParsedBRD> {
  const decisions = await extractArchitectureDecisions(rawText)
  return decisionsToParsedBRD(decisions)
}
