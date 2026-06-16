import type { ParsedBRD } from '@/types/brd'

// ── Public interfaces ─────────────────────────────────────────────────────────

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'UNKNOWN'

export interface BRDInsight {
  label:      string
  value:      string
  confidence: ConfidenceLevel
  reason?:    string
}

export interface InsightGroup {
  title:    string
  insights: BRDInsight[]
}

export interface GapQuestion {
  id:           'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7' | 'q8' | 'q9' | 'q10'
  title:        string
  subtitle:     string
  defaultValue: string
  multiSelect:  boolean
  options:      { value: string; label: string; description: string }[]
  inferredValue?:  string
  inferredReason?: string
  confidence:   'MEDIUM' | 'UNKNOWN'
}

export interface WizardSetup {
  insightGroups: InsightGroup[]
  gapQuestions:  GapQuestion[]
  filledAnswers: Record<string, string>
  confirmed:     number
  inferred:      number
  unknown:       number
}

// ── Option lists ──────────────────────────────────────────────────────────────

const BILLING_OPTIONS = [
  { value: 'Per-transaction fee %', label: 'Per-transaction fee',  description: 'Charge a % on each transaction processed' },
  { value: 'Monthly subscription',  label: 'Monthly subscription', description: 'Recurring billing, cancel any time' },
  { value: 'Annual subscription',   label: 'Annual subscription',  description: 'Yearly billing with upfront discount' },
  { value: 'Freemium',              label: 'Freemium',             description: 'Free tier with paid upgrades' },
  { value: 'Not yet decided',       label: 'Not yet decided',      description: "We'll use a sensible default for now" },
]

const REGION_OPTIONS = [
  { value: 'Single city/region',  label: 'Single city / region', description: 'Launch in one metro area or region' },
  { value: 'Single country',      label: 'Single country',       description: 'One country only at launch' },
  { value: 'Multiple countries',  label: 'Multiple countries',   description: 'Several countries from day 1' },
  { value: 'Global from day 1',   label: 'Global from day 1',    description: 'No geographic restriction at launch' },
]

const SENSITIVE_OPTIONS = [
  { value: 'Health/medical',    label: 'Health / medical records',  description: 'Patient data, diagnostics, prescriptions' },
  { value: 'Financial records', label: 'Financial records',         description: 'Bank accounts, transactions, tax data' },
  { value: 'Children under 13', label: 'Children under 13',         description: 'Data from users who may be minors' },
  { value: 'Location tracking', label: 'Precise location tracking', description: 'Real-time or stored GPS/location data' },
  { value: 'None',              label: 'None of the above',         description: 'Standard sensitivity — no special requirements' },
]

const SCALE_OPTIONS = [
  { value: 'Under 1,000',    label: 'Under 1,000',      description: 'Early access / niche product' },
  { value: '1,000-10,000',   label: '1,000 – 10,000',   description: 'Small but growing user base' },
  { value: '10,000-100,000', label: '10,000 – 100,000', description: 'Growth-stage product' },
  { value: '100,000+',       label: '100,000+',          description: 'Scale from launch' },
  { value: 'No idea',        label: 'No idea',           description: "We'll default to mid-tier infra" },
]

const DEPLOYMENT_OPTIONS = [
  { value: 'Railway',         label: 'Railway',          description: 'Docker-based, easy deploys, great for startups' },
  { value: 'Vercel',          label: 'Vercel',           description: 'Serverless, best for Next.js & frontend-heavy apps' },
  { value: 'AWS',             label: 'AWS',              description: 'Full control, higher ops overhead' },
  { value: 'GCP',             label: 'Google Cloud',     description: 'Strong for ML workloads and global scale' },
  { value: 'Not decided yet', label: 'Not decided yet',  description: "AI will recommend based on your architecture" },
]

const MULTITENANT_OPTIONS = [
  { value: 'No',                         label: 'No — single business / marketplace', description: 'One company or community uses this platform' },
  { value: 'Yes — B2B multi-tenant',     label: 'Yes — B2B multi-tenant',             description: 'Multiple companies each get their own isolated workspace' },
]

const AUTH_OPTIONS = [
  { value: 'Email + password',       label: 'Email + password',   description: 'Traditional credentials, you manage auth' },
  { value: 'Google / social only',   label: 'Google / social',    description: 'OAuth only — no password to manage' },
  { value: 'Email + social',         label: 'Email + social',     description: 'Both email/password and OAuth login' },
  { value: 'Enterprise SSO (SAML)',  label: 'Enterprise SSO',     description: 'SAML / OIDC for corporate identity providers' },
  { value: 'Magic link (no password)', label: 'Magic link',       description: 'Passwordless email sign-in' },
]

// ── Inference helpers ─────────────────────────────────────────────────────────

type InferResult = { value: string; reason: string; confidence: 'HIGH' | 'MEDIUM' }

function inferBilling(model: string): InferResult | null {
  if (!model) return null
  const m = model.toLowerCase()
  if (m.includes('transaction fee') || m.includes('commission') || m.includes('per booking') || m.includes('% fee'))
    return { value: 'Per-transaction fee %', reason: `BRD: "${model}"`, confidence: 'HIGH' }
  if (m.includes('freemium') || m.includes('free tier') || m.includes('free plan'))
    return { value: 'Freemium', reason: `BRD: "${model}"`, confidence: 'HIGH' }
  if (m.includes('annual') || m.includes('yearly'))
    return { value: 'Annual subscription', reason: `BRD: "${model}"`, confidence: 'HIGH' }
  if (m.includes('monthly subscription') || m.includes('monthly plan') || m.includes('monthly recurring'))
    return { value: 'Monthly subscription', reason: `BRD: "${model}"`, confidence: 'HIGH' }
  if (m.includes('subscription') || m.includes('saas') || m.includes('recurring'))
    return { value: 'Monthly subscription', reason: `Inferred from "${model}"`, confidence: 'MEDIUM' }
  if (m.includes('marketplace') || m.includes('platform fee'))
    return { value: 'Per-transaction fee %', reason: `Inferred from "${model}"`, confidence: 'MEDIUM' }
  return null
}

function inferSensitive(hints: string[]): InferResult | null {
  if (!hints.length) return null
  const text = hints.join(' ').toLowerCase()
  if (text.includes('health') || text.includes('medical') || text.includes('patient') || text.includes('hipaa'))
    return { value: 'Health/medical', reason: 'BRD mentions health / medical data', confidence: 'HIGH' }
  if (text.includes('financial') || text.includes('pci') || text.includes('banking') || text.includes('tax record'))
    return { value: 'Financial records', reason: 'BRD mentions financial data', confidence: 'HIGH' }
  if (text.includes('child') || text.includes('minor') || text.includes('coppa'))
    return { value: 'Children under 13', reason: 'BRD mentions minor users', confidence: 'HIGH' }
  if (text.includes('location tracking') || text.includes('gps') || text.includes('real-time location'))
    return { value: 'Location tracking', reason: 'BRD mentions location tracking', confidence: 'HIGH' }
  return null
}

function inferScale(hints: string): InferResult | null {
  if (!hints) return null
  const s = hints.toLowerCase()
  if (s.includes('million') || s.includes('100k') || s.includes('100,000+'))
    return { value: '100,000+', reason: 'BRD mentions large scale', confidence: 'HIGH' }
  if (s.includes('10k') || s.includes('10,000') || s.includes('tens of thousand'))
    return { value: '10,000-100,000', reason: 'BRD mentions medium scale', confidence: 'HIGH' }
  if (/\b1[,.]?000\b/.test(s) || s.includes('1k users') || s.includes('few hundred'))
    return { value: '1,000-10,000', reason: 'BRD mentions small scale', confidence: 'MEDIUM' }
  return null
}

function inferRegion(purpose: string, hints: string[]): InferResult | null {
  const text = [purpose, ...hints].join(' ').toLowerCase()
  if (text.includes('worldwide') || text.includes('global') || text.includes('international from'))
    return { value: 'Global from day 1', reason: 'BRD mentions global launch', confidence: 'HIGH' }
  if (text.includes('europe') || text.includes(' eu ') || (text.includes('gdpr') && text.includes('uk')))
    return { value: 'Multiple countries', reason: 'BRD mentions EU / multi-country', confidence: 'MEDIUM' }
  return null
}

function inferMultiTenant(archetype: string, purpose: string, features: { name: string; description: string }[]): InferResult | null {
  const text = (purpose + ' ' + features.map(f => f.name + ' ' + f.description).join(' ')).toLowerCase()

  // Consumer apps and marketplaces are NOT multi-tenant
  if (archetype === 'consumer-app' || archetype === 'marketplace' || archetype === 'ecommerce')
    return { value: 'No', reason: `${archetype} apps are single-tenant by nature`, confidence: 'HIGH' }

  // B2B SaaS signals
  if (text.includes('multi-tenant') || text.includes('multi tenant') || text.includes('workspace') && text.includes('organization'))
    return { value: 'Yes — B2B multi-tenant', reason: 'BRD explicitly mentions multi-tenancy', confidence: 'HIGH' }

  if (archetype === 'b2b-saas')
    return { value: 'Yes — B2B multi-tenant', reason: 'B2B SaaS apps are typically multi-tenant', confidence: 'MEDIUM' }

  if (text.includes('company') || text.includes('organization') || text.includes('enterprise') || text.includes('business account'))
    return { value: 'Yes — B2B multi-tenant', reason: 'BRD mentions business accounts', confidence: 'MEDIUM' }

  return null
}

function inferRealtime(features: { name: string; description: string }[], purpose: string): string {
  const text = (purpose + ' ' + features.map(f => f.name + ' ' + f.description).join(' ')).toLowerCase()
  if (text.includes('chat') || text.includes('messaging') || text.includes('live') || text.includes('websocket') || text.includes('real-time') || text.includes('realtime') || text.includes('feed') || text.includes('stream'))
    return 'Yes'
  if (text.includes('notification') || text.includes('alert') || text.includes('update'))
    return 'Likely'
  return 'Unknown'
}

function inferFileStorage(features: { name: string; description: string }[], purpose: string): string {
  const text = (purpose + ' ' + features.map(f => f.name + ' ' + f.description).join(' ')).toLowerCase()
  if (text.includes('upload') || text.includes('attachment') || text.includes('file') || text.includes('image') || text.includes('document') || text.includes('photo') || text.includes('media'))
    return 'Yes'
  return 'Unknown'
}

function inferGDPR(region: string | null, hints: string[]): string {
  const text = hints.join(' ').toLowerCase()
  if (text.includes('gdpr') || text.includes('europe') || text.includes(' eu ') || region?.includes('Europe') || region?.includes('Multiple'))
    return 'Yes'
  if (region === 'Global from day 1') return 'Yes'
  return 'Unknown'
}

function inferHIPAA(hints: string[]): string {
  const text = hints.join(' ').toLowerCase()
  if (text.includes('hipaa') || text.includes('health') || text.includes('medical') || text.includes('patient'))
    return 'Yes'
  return 'No'
}

function inferAuthHint(purpose: string, archetype: string, integrations: string[]): InferResult | null {
  const text = (purpose + ' ' + integrations.join(' ')).toLowerCase()
  if (text.includes('google') && (text.includes('login') || text.includes('sign in') || text.includes('oauth')))
    return { value: 'Email + social', reason: 'BRD mentions Google login', confidence: 'MEDIUM' }
  if (text.includes('saml') || text.includes('sso') || text.includes('enterprise identity'))
    return { value: 'Enterprise SSO (SAML)', reason: 'BRD mentions enterprise SSO', confidence: 'HIGH' }
  if (text.includes('magic link') || text.includes('passwordless'))
    return { value: 'Magic link (no password)', reason: 'BRD mentions passwordless auth', confidence: 'HIGH' }
  if (archetype === 'b2b-saas')
    return { value: 'Email + social', reason: 'B2B apps typically support email + Google OAuth', confidence: 'MEDIUM' }
  return null
}

function extractProductName(purpose: string): string {
  if (!purpose) return 'Not mentioned'
  // Look for quoted names or capitalized multi-word product names
  const quoted = purpose.match(/"([^"]+)"/)?.[1]
  if (quoted) return quoted
  // Look for "an app called X" or "platform called X" patterns
  const called = purpose.match(/(?:app|platform|product|system|tool|service)\s+(?:called|named)\s+"?([A-Z][a-zA-Z0-9]+)"?/i)?.[1]
  if (called) return called
  // First significant capitalized word sequence
  const words = purpose.split(' ')
  const proper = words.filter(w => w.length > 3 && /^[A-Z]/.test(w)).slice(0, 2).join(' ')
  return proper || 'Not mentioned'
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildWizardSetup(parsedBRD: ParsedBRD | null): WizardSetup {
  const gapQuestions:  GapQuestion[]            = []
  const filledAnswers: Record<string, string>   = {}

  // Confidence counters
  let confirmed = 0
  let inferred  = 0
  let unknown   = 0

  function track(c: ConfidenceLevel) {
    if (c === 'HIGH') confirmed++
    else if (c === 'MEDIUM') inferred++
    else unknown++
  }

  // ── Group 1: App Overview ─────────────────────────────────────────────────

  const g1: BRDInsight[] = []

  // Product name
  const productName = extractProductName(parsedBRD?.productPurpose ?? '')
  const nameConf: ConfidenceLevel = productName !== 'Not mentioned' ? 'MEDIUM' : 'UNKNOWN'
  g1.push({ label: 'App name', value: productName === 'Not mentioned' ? 'Not found in BRD' : productName, confidence: nameConf })
  track(nameConf)

  // App type
  if (parsedBRD?.archetype) {
    const conf = parsedBRD.archetypeConfidence ?? 0
    const label = parsedBRD.archetype.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const aConf: ConfidenceLevel = conf >= 0.75 ? 'HIGH' : 'MEDIUM'
    g1.push({ label: 'App type', value: `${label} (${Math.round(conf * 100)}% confidence)`, confidence: aConf })
    track(aConf)
  } else {
    g1.push({ label: 'App type', value: 'Not detected', confidence: 'UNKNOWN' })
    track('UNKNOWN')
  }

  // Platform
  if (parsedBRD?.platform) {
    const label = parsedBRD.platform === 'both' ? 'Web + Mobile' : parsedBRD.platform === 'web' ? 'Web only' : 'Mobile only'
    g1.push({ label: 'Platform', value: label, confidence: 'HIGH' })
    track('HIGH')
  } else {
    g1.push({ label: 'Platform', value: 'Not mentioned', confidence: 'UNKNOWN' })
    track('UNKNOWN')
  }

  // Purpose summary
  if (parsedBRD?.productPurpose) {
    const summary = parsedBRD.productPurpose.length > 120
      ? parsedBRD.productPurpose.slice(0, 117) + '…'
      : parsedBRD.productPurpose
    g1.push({ label: 'Purpose', value: summary, confidence: 'HIGH' })
    track('HIGH')
  }

  // ── Group 2: Users & Features ─────────────────────────────────────────────

  const g2: BRDInsight[] = []

  if (parsedBRD?.userTypes?.length) {
    g2.push({ label: 'User types', value: parsedBRD.userTypes.join(', '), confidence: 'HIGH' })
    track('HIGH')
  } else {
    g2.push({ label: 'User types', value: 'Not identified', confidence: 'UNKNOWN' })
    track('UNKNOWN')
  }

  const mustFeatures = parsedBRD?.coreFeatures?.filter(f => f.priority === 'MUST') ?? []
  const shouldFeatures = parsedBRD?.coreFeatures?.filter(f => f.priority === 'SHOULD') ?? []
  if (mustFeatures.length) {
    g2.push({ label: 'Must-have features', value: mustFeatures.slice(0, 5).map(f => f.name).join(', '), confidence: 'HIGH' })
    track('HIGH')
  }
  if (shouldFeatures.length) {
    g2.push({ label: 'Should-have features', value: shouldFeatures.slice(0, 4).map(f => f.name).join(', '), confidence: 'MEDIUM' })
    track('MEDIUM')
  }
  if (!mustFeatures.length && !shouldFeatures.length) {
    g2.push({ label: 'Core features', value: 'Not listed in BRD', confidence: 'UNKNOWN' })
    track('UNKNOWN')
  }

  // ── Group 3: Architecture Signals ────────────────────────────────────────

  const g3: BRDInsight[] = []

  const multiTenant = inferMultiTenant(
    parsedBRD?.archetype ?? '',
    parsedBRD?.productPurpose ?? '',
    parsedBRD?.coreFeatures ?? [],
  )
  if (multiTenant) {
    g3.push({ label: 'Multi-tenant', value: multiTenant.value === 'Yes — B2B multi-tenant' ? 'Yes — B2B' : 'No', confidence: multiTenant.confidence as ConfidenceLevel, reason: multiTenant.reason })
    track(multiTenant.confidence as ConfidenceLevel)
  } else {
    g3.push({ label: 'Multi-tenant', value: 'Unknown', confidence: 'UNKNOWN' })
    track('UNKNOWN')
  }

  const paymentType = inferBilling(parsedBRD?.monetizationModel ?? '')
  if (paymentType) {
    g3.push({ label: 'Payment model', value: paymentType.value, confidence: paymentType.confidence as ConfidenceLevel, reason: paymentType.reason })
    track(paymentType.confidence as ConfidenceLevel)
  } else {
    g3.push({ label: 'Payment model', value: 'Not mentioned', confidence: 'UNKNOWN' })
    track('UNKNOWN')
  }

  const realtimeSignal = inferRealtime(parsedBRD?.coreFeatures ?? [], parsedBRD?.productPurpose ?? '')
  const rtConf: ConfidenceLevel = realtimeSignal === 'Yes' ? 'HIGH' : realtimeSignal === 'Likely' ? 'MEDIUM' : 'UNKNOWN'
  g3.push({ label: 'Real-time needed', value: realtimeSignal, confidence: rtConf })
  track(rtConf)

  const fileSignal = inferFileStorage(parsedBRD?.coreFeatures ?? [], parsedBRD?.productPurpose ?? '')
  const fsConf: ConfidenceLevel = fileSignal === 'Yes' ? 'HIGH' : 'UNKNOWN'
  g3.push({ label: 'File storage needed', value: fileSignal, confidence: fsConf })
  track(fsConf)

  if (parsedBRD?.integrationHints?.length) {
    g3.push({ label: 'Integrations', value: parsedBRD.integrationHints.slice(0, 4).join(', '), confidence: 'HIGH' })
    track('HIGH')
  }

  // ── Group 4: Compliance ───────────────────────────────────────────────────

  const g4: BRDInsight[] = []

  const regionInfer = inferRegion(parsedBRD?.productPurpose ?? '', parsedBRD?.integrationHints ?? [])
  const launchRegionValue = regionInfer?.value ?? null
  if (regionInfer) {
    g4.push({ label: 'Launch region', value: regionInfer.value, confidence: regionInfer.confidence as ConfidenceLevel, reason: regionInfer.reason })
    track(regionInfer.confidence as ConfidenceLevel)
  } else {
    g4.push({ label: 'Launch region', value: 'Not specified', confidence: 'UNKNOWN' })
    track('UNKNOWN')
  }

  const sensitiveInfer = inferSensitive(parsedBRD?.complianceHints ?? [])
  if (sensitiveInfer) {
    g4.push({ label: 'Sensitive data', value: sensitiveInfer.value, confidence: sensitiveInfer.confidence as ConfidenceLevel, reason: sensitiveInfer.reason })
    track(sensitiveInfer.confidence as ConfidenceLevel)
  } else {
    g4.push({ label: 'Sensitive data', value: 'None detected', confidence: 'UNKNOWN' })
    track('UNKNOWN')
  }

  const gdprSignal = inferGDPR(launchRegionValue, parsedBRD?.complianceHints ?? [])
  const gdprConf: ConfidenceLevel = gdprSignal === 'Yes' ? 'HIGH' : 'UNKNOWN'
  g4.push({ label: 'GDPR required', value: gdprSignal, confidence: gdprConf })
  track(gdprConf)

  const hipaaSignal = inferHIPAA(parsedBRD?.complianceHints ?? [])
  const hipaaConf: ConfidenceLevel = hipaaSignal === 'Yes' ? 'HIGH' : 'MEDIUM'
  g4.push({ label: 'HIPAA required', value: hipaaSignal, confidence: hipaaConf })
  track(hipaaConf)

  // ── Build gap questions ───────────────────────────────────────────────────

  // Q1: Billing model
  const billing = inferBilling(parsedBRD?.monetizationModel ?? '')
  if (billing?.confidence === 'HIGH') {
    filledAnswers['q1'] = billing.value
  } else if (billing?.confidence === 'MEDIUM') {
    gapQuestions.push({
      id: 'q1', title: 'How does your product make money?', subtitle: 'Shapes §17 billing architecture',
      defaultValue: billing.value, multiSelect: false, options: BILLING_OPTIONS,
      inferredValue: billing.value, inferredReason: billing.reason, confidence: 'MEDIUM',
    })
  } else {
    gapQuestions.push({
      id: 'q1', title: 'How does your product make money?', subtitle: 'Shapes §17 billing architecture',
      defaultValue: 'Monthly subscription', multiSelect: false, options: BILLING_OPTIONS, confidence: 'UNKNOWN',
    })
  }

  // Q2: Launch region
  const region = inferRegion(parsedBRD?.productPurpose ?? '', parsedBRD?.integrationHints ?? [])
  if (region?.confidence === 'HIGH') {
    filledAnswers['q2'] = region.value
  } else if (region?.confidence === 'MEDIUM') {
    gapQuestions.push({
      id: 'q2', title: 'Where are you launching first?', subtitle: 'Shapes §20 compliance (GDPR if EU) and CDN regions',
      defaultValue: region.value, multiSelect: false, options: REGION_OPTIONS,
      inferredValue: region.value, inferredReason: region.reason, confidence: 'MEDIUM',
    })
  } else {
    gapQuestions.push({
      id: 'q2', title: 'Which regions are you launching in first?', subtitle: 'Shapes §20 compliance and CDN regions',
      defaultValue: 'Single country', multiSelect: false, options: REGION_OPTIONS, confidence: 'UNKNOWN',
    })
  }

  // Q3: Timeline — ALWAYS ask (determines Fast vs Full track)
  gapQuestions.push({
    id: 'q3', title: 'When do you need to launch?',
    subtitle: 'Under 4 weeks → Fast Track (essentials only). Otherwise → Full Track',
    defaultValue: '3-6 months', multiSelect: false,
    options: [
      { value: 'Under 4 weeks', label: 'Under 4 weeks', description: 'Fast Track — stripped-down essentials only' },
      { value: '1-2 months',    label: '1–2 months',    description: 'Full Track, compressed scope' },
      { value: '3-6 months',    label: '3–6 months',    description: 'Full Track, comfortable timeline' },
      { value: '6+ months',     label: '6+ months',     description: 'Full Track, plenty of runway' },
    ],
    confidence: 'UNKNOWN',
  })

  // Q4: Sensitive data
  const sensitive = inferSensitive(parsedBRD?.complianceHints ?? [])
  if (sensitive?.confidence === 'HIGH') {
    filledAnswers['q4'] = sensitive.value
  } else {
    gapQuestions.push({
      id: 'q4', title: 'Does your app handle sensitive data?',
      subtitle: 'Shapes §18 security level and §20 compliance — select all that apply',
      defaultValue: 'None', multiSelect: true, options: SENSITIVE_OPTIONS,
      ...(sensitive ? { inferredValue: sensitive.value, inferredReason: sensitive.reason, confidence: 'MEDIUM' as const } : { confidence: 'UNKNOWN' as const }),
    })
  }

  // Q5: User scale
  const scale = inferScale(parsedBRD?.scalingHints ?? '')
  if (scale?.confidence === 'HIGH') {
    filledAnswers['q5'] = scale.value
  } else {
    gapQuestions.push({
      id: 'q5', title: 'How many users in year one?', subtitle: 'Shapes §03 NFRs and infrastructure sizing',
      defaultValue: scale?.value ?? '1,000-10,000', multiSelect: false, options: SCALE_OPTIONS,
      ...(scale ? { inferredValue: scale.value, inferredReason: scale.reason, confidence: 'MEDIUM' as const } : { confidence: 'UNKNOWN' as const }),
    })
  }

  // Q6: Deployment target — almost always useful since BRDs never mention this
  gapQuestions.push({
    id: 'q6', title: 'Where will you deploy?',
    subtitle: 'Shapes §24 infrastructure and §05 high-level architecture',
    defaultValue: 'Railway', multiSelect: false, options: DEPLOYMENT_OPTIONS, confidence: 'UNKNOWN',
  })

  // Q7: Multi-tenant — if not deterministic
  if (!multiTenant || multiTenant.confidence !== 'HIGH') {
    gapQuestions.push({
      id: 'q7', title: 'Will multiple separate businesses use this platform?',
      subtitle: 'Shapes §05 architecture, §07 database isolation, and §06 auth model',
      defaultValue: 'No',
      multiSelect: false, options: MULTITENANT_OPTIONS,
      ...(multiTenant ? { inferredValue: multiTenant.value === 'Yes — B2B multi-tenant' ? 'Yes — B2B multi-tenant' : 'No', inferredReason: multiTenant.reason, confidence: 'MEDIUM' as const } : { confidence: 'UNKNOWN' as const }),
    })
  } else {
    filledAnswers['q7'] = multiTenant.value
  }

  // Q8: Auth method — if not obvious from BRD
  const authHint = inferAuthHint(parsedBRD?.productPurpose ?? '', parsedBRD?.archetype ?? '', parsedBRD?.integrationHints ?? [])
  if (authHint?.confidence === 'HIGH') {
    filledAnswers['q8'] = authHint.value
  } else {
    gapQuestions.push({
      id: 'q8', title: 'How will users log in?',
      subtitle: 'Shapes §06 authentication architecture and session management',
      defaultValue: 'Email + social',
      multiSelect: false, options: AUTH_OPTIONS,
      ...(authHint ? { inferredValue: authHint.value, inferredReason: authHint.reason, confidence: 'MEDIUM' as const } : { confidence: 'UNKNOWN' as const }),
    })
  }

  return {
    insightGroups: [
      { title: 'App Overview',          insights: g1 },
      { title: 'Users & Features',      insights: g2 },
      { title: 'Architecture Signals',  insights: g3 },
      { title: 'Compliance',            insights: g4 },
    ],
    gapQuestions,
    filledAnswers,
    confirmed,
    inferred,
    unknown,
  }
}
