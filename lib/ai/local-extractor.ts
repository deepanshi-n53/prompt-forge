// Local, AI-free extraction of architectural decisions from raw BRD text.
//
// Cheap, deterministic regex/keyword heuristics fill the fields a BRD usually
// states outright (named tech, compliance acronyms, platform). The output shape
// is identical to the AI extractor's (ArchitectureDecisions), so the two can be
// merged field-by-field — the higher-confidence value winning per field.
//
// Heuristics are intentionally conservative: a field is only set when there's a
// clear textual signal, and explicit acronyms (GDPR/HIPAA/JWT) score higher than
// soft domain inferences. Anything left unset is reported by residualFields and
// handed to the AI.

import type { ArchitectureDecisions } from '@/types/brd'

// ── canonical field lists ─────────────────────────────────────────────────────

const SCALAR_FIELDS = [
  'appName', 'appType', 'platform', 'track',
  'targetConcurrentUsers', 'p95ResponseTime', 'uptimeSLA',
  'multiTenant', 'tenancyModel', 'deploymentModel', 'cloudProvider',
  'authMethod', 'mfaRequired',
  'dbEngine', 'cacheLayer', 'searchEngine',
  'apiStyle', 'needsPublicAPI', 'needsRealtime', 'realtimeMethod',
  'needsFileStorage', 'fileStorageProvider',
  'paymentProvider', 'needsPaymentSplit',
  'emailProvider', 'componentLibrary', 'darkModeRequired',
  'gdprRequired', 'hipaaRequired', 'pciRequired', 'multiLanguage',
] as const

const ARRAY_FIELDS = [
  'coreUserJourneys', 'userTypes', 'coreFeatures', 'outOfScope',
  'socialProviders', 'rbacRoles', 'thirdPartyApis', 'launchRegions',
  'sensitiveDataTypes', 'languages',
] as const

const ALL_FIELDS: readonly string[] = [...SCALAR_FIELDS, ...ARRAY_FIELDS]

// ── blank decision set ────────────────────────────────────────────────────────

function blank(): ArchitectureDecisions {
  return {
    appName: null, appType: null, platform: null, track: null,
    coreUserJourneys: [], userTypes: [], coreFeatures: [], outOfScope: [],
    targetConcurrentUsers: null, p95ResponseTime: null, uptimeSLA: null,
    multiTenant: null, tenancyModel: null, deploymentModel: null, cloudProvider: null,
    authMethod: null, socialProviders: [], mfaRequired: null, rbacRoles: [],
    dbEngine: null, cacheLayer: null, searchEngine: null,
    apiStyle: null, needsPublicAPI: null, needsRealtime: null, realtimeMethod: null,
    needsFileStorage: null, fileStorageProvider: null,
    paymentProvider: null, needsPaymentSplit: null,
    emailProvider: null, thirdPartyApis: [], componentLibrary: null, darkModeRequired: null,
    launchRegions: [], gdprRequired: null, hipaaRequired: null, pciRequired: null,
    sensitiveDataTypes: [], multiLanguage: null, languages: [],
    confidence: {},
  }
}

function setField<K extends keyof ArchitectureDecisions>(
  d: ArchitectureDecisions,
  field: K,
  value: ArchitectureDecisions[K],
  conf: number,
): void {
  d[field] = value
  d.confidence[field as string] = conf
}

// Pick the first enum option whose regex matches the text.
function firstMatch(
  text: string,
  table: ReadonlyArray<[RegExp, string]>,
): string | null {
  for (const [re, value] of table) {
    if (re.test(text)) return value
  }
  return null
}

// ── extractLocal ──────────────────────────────────────────────────────────────

export function extractLocal(rawText: string): ArchitectureDecisions {
  const d = blank()
  const text = rawText ?? ''
  const set = <K extends keyof ArchitectureDecisions>(
    field: K, value: ArchitectureDecisions[K], conf: number,
  ) => setField(d, field, value, conf)

  // Compliance — explicit acronyms are unambiguous, so score them at 1.0.
  if (/\bGDPR\b/i.test(text))        set('gdprRequired', true, 1.0)
  if (/\bHIPAA\b/i.test(text)) {     set('hipaaRequired', true, 1.0); d.sensitiveDataTypes.push('health') }
  if (/\bPCI(?:[ -]?DSS)?\b/i.test(text)) set('pciRequired', true, 1.0)

  // Database engine.
  const db = firstMatch(text, [
    [/\bpostgres(?:ql)?\b/i, 'PostgreSQL'],
    [/\bmysql\b/i,           'MySQL'],
    [/\bmongo(?:db)?\b/i,    'MongoDB'],
    [/\bsqlite\b/i,          'SQLite'],
  ])
  if (db) set('dbEngine', db as ArchitectureDecisions['dbEngine'], 0.85)

  // Cache layer.
  const cache = firstMatch(text, [
    [/\bredis\b/i,     'Redis'],
    [/\bmemcached\b/i, 'Memcached'],
  ])
  if (cache) set('cacheLayer', cache as ArchitectureDecisions['cacheLayer'], 0.8)

  // Search engine.
  const search = firstMatch(text, [
    [/\belastic ?search\b/i, 'Elasticsearch'],
    [/\balgolia\b/i,         'Algolia'],
  ])
  if (search) set('searchEngine', search as ArchitectureDecisions['searchEngine'], 0.8)

  // Payments.
  const pay = firstMatch(text, [
    [/\bstripe\b/i,   'Stripe'],
    [/\brazorpay\b/i, 'Razorpay'],
    [/\bpaypal\b/i,   'PayPal'],
  ])
  if (pay) set('paymentProvider', pay as ArchitectureDecisions['paymentProvider'], 0.85)

  // Cloud provider.
  const cloud = firstMatch(text, [
    [/\bvercel\b/i,                    'Vercel'],
    [/\brailway\b/i,                   'Railway'],
    [/\b(?:aws|amazon web services)\b/i, 'AWS'],
    [/\b(?:gcp|google cloud)\b/i,      'GCP'],
    [/\bazure\b/i,                     'Azure'],
  ])
  if (cloud) set('cloudProvider', cloud as ArchitectureDecisions['cloudProvider'], 0.75)

  // Auth method.
  const auth = firstMatch(text, [
    [/\bjwt\b|json web token/i, 'JWT'],
    [/\bopaque token/i,         'opaque-tokens'],
    [/\bsessions?\b|session[- ]based/i, 'sessions'],
  ])
  if (auth) set('authMethod', auth as ArchitectureDecisions['authMethod'], 0.75)

  if (/\bmfa\b|two[- ]factor|2fa|multi[- ]factor/i.test(text)) set('mfaRequired', true, 0.8)

  // API style.
  const api = firstMatch(text, [
    [/\bgraphql\b/i,           'GraphQL'],
    [/\btrpc\b/i,              'tRPC'],
    [/\brest(?:ful)?\b|rest api/i, 'REST'],
  ])
  if (api) set('apiStyle', api as ArchitectureDecisions['apiStyle'], 0.7)

  if (/\bpublic api\b|developer api|api access/i.test(text)) set('needsPublicAPI', true, 0.65)

  // Realtime.
  const realtime = firstMatch(text, [
    [/\bweb ?sockets?\b/i,            'WebSocket'],
    [/\bserver[- ]sent events?\b|\bsse\b/i, 'SSE'],
    [/\blong[- ]?polling\b/i,         'polling'],
  ])
  if (realtime) {
    set('realtimeMethod', realtime as ArchitectureDecisions['realtimeMethod'], 0.65)
    set('needsRealtime', true, 0.7)
  } else if (/\breal[- ]?time\b|live updates|live tracking/i.test(text)) {
    set('needsRealtime', true, 0.6)
  }

  // File storage.
  const fileStore = firstMatch(text, [
    [/\bamazon s3\b|\bs3 bucket\b|\bs3\b/i, 'S3'],
    [/\bcloudinary\b/i,                     'Cloudinary'],
    [/\bsupabase storage\b/i,               'Supabase Storage'],
  ])
  if (fileStore) {
    set('fileStorageProvider', fileStore as ArchitectureDecisions['fileStorageProvider'], 0.75)
    set('needsFileStorage', true, 0.7)
  } else if (/\bfile upload|image upload|document upload|photo upload\b/i.test(text)) {
    set('needsFileStorage', true, 0.6)
  }

  // Email provider.
  const email = firstMatch(text, [
    [/\bresend\b/i,                'Resend'],
    [/\bsendgrid\b/i,              'SendGrid'],
    [/\bpostmark\b/i,              'Postmark'],
    [/\bmailgun\b/i,               'Mailgun'],
    [/\b(?:amazon ses|aws ses)\b/i, 'Amazon SES'],
  ])
  if (email) set('emailProvider', email, 0.75)

  // UI component library.
  const ui = firstMatch(text, [
    [/\bshadcn\b/i,                 'shadcn/ui'],
    [/\bmaterial[- ]ui\b|\bmui\b/i, 'MUI'],
    [/\bchakra\b/i,                 'Chakra UI'],
  ])
  if (ui) set('componentLibrary', ui as ArchitectureDecisions['componentLibrary'], 0.7)

  if (/\bdark mode\b/i.test(text)) set('darkModeRequired', true, 0.7)

  if (/\bmulti[- ]?tenant\b|multitenancy\b/i.test(text)) set('multiTenant', true, 0.65)

  if (/\bi18n\b|multi[- ]?lingual|multi[- ]?language|localis?ation\b/i.test(text)) {
    set('multiLanguage', true, 0.6)
  }

  // Platform.
  const web    = /\bweb app|web[- ]based|website|browser|responsive web\b/i.test(text)
  const mobile = /\bios\b|\bandroid\b|mobile app|react native|flutter\b/i.test(text)
  if (web && mobile)   set('platform', 'both',  0.7)
  else if (web)        set('platform', 'web',    0.6)
  else if (mobile)     set('platform', 'mobile', 0.6)

  // Track signals.
  const fullSignal = /\benterprise\b|\bcompliance\b|\bsso\b|\baudit\b|high[- ]scale\b/i.test(text)
  const fastSignal = /\bmvp\b|prototype|proof of concept|\bquick\b|validate (?:an |the )?idea/i.test(text)
  if (fullSignal && !fastSignal)      set('track', 'FULL', 0.6)
  else if (fastSignal && !fullSignal) set('track', 'FAST', 0.6)

  // App type — first strong domain signal wins.
  const appType = firstMatch(text, [
    [/\bhealth(?:care|tech)\b|\bpatient\b|\bclinical\b|\behr\b|telemedicine/i, 'healthtech'],
    [/\bfintech\b|\blending\b|\bbanking\b|\btrading\b|\be[- ]?wallet\b|payments platform/i, 'fintech'],
    [/\bmarketplace\b|two[- ]sided|buyers and sellers|vendors and customers/i, 'marketplace'],
    [/\be[- ]?commerce\b|online store|shopping cart|\bcheckout\b|product catalog/i, 'ecommerce'],
    [/\bbooking\b|\bappointments?\b|\breservations?\b|scheduling platform/i, 'booking'],
    [/\bsocial network\b|news feed|\bfollowers?\b|social media platform/i, 'social'],
    [/\bai[- ]powered\b|\bllm\b|machine learning|generative ai\b/i, 'ai-tool'],
    [/\bproject management\b|task management|productivity tool|collaboration tool/i, 'productivity'],
    [/\bb2b\b|\bsaas\b|admin dashboard|admin panel/i, 'b2b-saas'],
    [/\bconsumer app\b/i, 'consumer'],
  ])
  if (appType) set('appType', appType as ArchitectureDecisions['appType'], 0.6)

  // Social login providers (only when a login/oauth context is present nearby).
  if (/\boauth\b|social login|sign[- ]in with|log[- ]?in with/i.test(text)) {
    const providers: string[] = []
    if (/\bgoogle\b/i.test(text))   providers.push('Google')
    if (/\bapple\b/i.test(text))    providers.push('Apple')
    if (/\bfacebook\b/i.test(text)) providers.push('Facebook')
    if (/\bgithub\b/i.test(text))   providers.push('GitHub')
    if (providers.length > 0) set('socialProviders', providers, 0.6)
  }

  return d
}

// ── residualFields ────────────────────────────────────────────────────────────
// Fields the local pass left unfilled (null scalar / empty array). When none
// remain, the caller can skip the AI extraction entirely.

export function residualFields(d: ArchitectureDecisions): string[] {
  const out: string[] = []
  for (const f of SCALAR_FIELDS) {
    if (d[f] == null) out.push(f)
  }
  for (const f of ARRAY_FIELDS) {
    const v = d[f]
    if (!Array.isArray(v) || v.length === 0) out.push(f)
  }
  return out
}

// ── mergeExtractions ──────────────────────────────────────────────────────────
// Combine two extractions field-by-field, keeping the value from whichever side
// is more confident about that field. Ties favour `ai` when it has a real value
// (it's generally the richer pass), otherwise `local` is retained.

function hasValue(v: unknown): boolean {
  if (v == null) return false
  if (Array.isArray(v)) return v.length > 0
  return true
}

export function mergeExtractions(
  local: ArchitectureDecisions,
  ai: ArchitectureDecisions,
): ArchitectureDecisions {
  const out = blank()
  const outRec = out as unknown as Record<string, unknown>
  const aiRec  = ai as unknown as Record<string, unknown>
  const confidence: Record<string, number> = {}

  for (const f of ALL_FIELDS) {
    const lc = local.confidence[f] ?? 0
    const ac = ai.confidence[f] ?? 0
    const takeAi = ac > lc || (ac === lc && hasValue(aiRec[f]))

    const srcRec  = takeAi ? aiRec : (local as unknown as Record<string, unknown>)
    const srcConf = takeAi ? ac : lc

    outRec[f] = srcRec[f]
    if (srcConf > 0) confidence[f] = srcConf
  }

  out.confidence = confidence
  return out
}
