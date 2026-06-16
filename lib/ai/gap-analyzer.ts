import type { ParsedBRD } from '@/types/brd'

export interface BRDInsight {
  label:      string
  value:      string
  confidence: 'HIGH' | 'MEDIUM' | 'UNKNOWN'
  reason?:    string
}

export interface GapQuestion {
  id:           'q1' | 'q2' | 'q3' | 'q4' | 'q5'
  title:        string
  subtitle:     string
  defaultValue: string
  multiSelect:  boolean
  options:      { value: string; label: string; description: string }[]
  // Present when BRD gave us a clue — pre-selects the answer, user can change
  inferredValue?:  string
  inferredReason?: string
  confidence:  'MEDIUM' | 'UNKNOWN'
}

export interface WizardSetup {
  insights:      BRDInsight[]
  gapQuestions:  GapQuestion[]           // questions to show in the UI
  filledAnswers: Record<string, string>  // answers pre-filled from BRD (not shown)
}

// ── Option lists ──────────────────────────────────────────────────────────────

const BILLING_OPTIONS = [
  { value: 'Per-transaction fee %', label: 'Per-transaction fee',  description: 'Charge a % on each transaction processed' },
  { value: 'Monthly subscription',  label: 'Monthly subscription', description: 'Recurring billing, cancel any time' },
  { value: 'Annual subscription',   label: 'Annual subscription',  description: 'Yearly billing with upfront discount' },
  { value: 'Freemium',              label: 'Freemium',             description: 'Free tier with paid upgrades' },
  { value: 'Not yet decided',       label: 'Not yet decided',      description: "We'll use a sensible default for now" },
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

// ── Inference helpers ─────────────────────────────────────────────────────────

type InferResult = { value: string; reason: string; confidence: 'HIGH' | 'MEDIUM' }

function inferBilling(model: string): InferResult | null {
  if (!model) return null
  const m = model.toLowerCase()

  // HIGH confidence — BRD is unambiguous
  if (m.includes('transaction fee') || m.includes('commission') || m.includes('per booking') || m.includes('% fee'))
    return { value: 'Per-transaction fee %', reason: `BRD: "${model}"`, confidence: 'HIGH' }
  if (m.includes('freemium') || m.includes('free tier') || m.includes('free plan'))
    return { value: 'Freemium', reason: `BRD: "${model}"`, confidence: 'HIGH' }
  if (m.includes('annual') || m.includes('yearly'))
    return { value: 'Annual subscription', reason: `BRD: "${model}"`, confidence: 'HIGH' }
  if (m.includes('monthly subscription') || m.includes('monthly plan') || m.includes('monthly recurring'))
    return { value: 'Monthly subscription', reason: `BRD: "${model}"`, confidence: 'HIGH' }

  // MEDIUM confidence — subscription-like but not explicit
  if (m.includes('subscription') || m.includes('saas') || m.includes('recurring'))
    return { value: 'Monthly subscription', reason: `Inferred from "${model}"`, confidence: 'MEDIUM' }
  if (m.includes('marketplace') || m.includes('platform fee') || m.includes('commission'))
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

// ── Public API ────────────────────────────────────────────────────────────────

export function buildWizardSetup(parsedBRD: ParsedBRD | null): WizardSetup {
  const insights:      BRDInsight[]             = []
  const gapQuestions:  GapQuestion[]            = []
  const filledAnswers: Record<string, string>   = {}

  // ── Build insights summary ────────────────────────────────────────────────

  if (parsedBRD?.archetype) {
    const conf = parsedBRD.archetypeConfidence ?? 0
    const label = parsedBRD.archetype.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    insights.push({
      label:      'App type',
      value:      `${label} (${Math.round(conf * 100)}%)`,
      confidence: conf >= 0.75 ? 'HIGH' : 'MEDIUM',
      reason:     'Detected from BRD',
    })
  }

  if (parsedBRD?.platform) {
    const label = parsedBRD.platform === 'both' ? 'Web + Mobile'
      : parsedBRD.platform === 'web' ? 'Web only' : 'Mobile only'
    insights.push({ label: 'Platform', value: label, confidence: 'HIGH', reason: 'Detected from BRD' })
  }

  if (parsedBRD?.userTypes?.length) {
    insights.push({
      label:      'User types',
      value:      parsedBRD.userTypes.slice(0, 4).join(', '),
      confidence: 'HIGH',
      reason:     'Identified from BRD',
    })
  }

  if (parsedBRD?.coreFeatures?.length) {
    const musts = parsedBRD.coreFeatures.filter(f => f.priority === 'MUST').slice(0, 3)
    if (musts.length) {
      insights.push({
        label:      'Core features',
        value:      musts.map(f => f.name).join(', '),
        confidence: 'HIGH',
        reason:     'Must-have features from BRD',
      })
    }
  }

  // ── Q1: Billing model ─────────────────────────────────────────────────────

  const billing = inferBilling(parsedBRD?.monetizationModel ?? '')
  if (billing?.confidence === 'HIGH') {
    filledAnswers['q1'] = billing.value
    insights.push({ label: 'Revenue model', value: billing.value, confidence: 'HIGH', reason: billing.reason })
  } else if (billing?.confidence === 'MEDIUM') {
    insights.push({ label: 'Revenue model', value: billing.value, confidence: 'MEDIUM', reason: billing.reason })
    gapQuestions.push({
      id: 'q1', title: 'How does your product make money?', subtitle: 'Shapes §17 billing architecture',
      defaultValue: billing.value, multiSelect: false, options: BILLING_OPTIONS,
      inferredValue: billing.value, inferredReason: billing.reason, confidence: 'MEDIUM',
    })
  } else {
    insights.push({ label: 'Revenue model', value: 'Not mentioned in BRD', confidence: 'UNKNOWN' })
    gapQuestions.push({
      id: 'q1', title: 'How does your product make money?', subtitle: 'Shapes §17 billing architecture',
      defaultValue: 'Monthly subscription', multiSelect: false, options: BILLING_OPTIONS, confidence: 'UNKNOWN',
    })
  }

  // ── Q2: Launch region ─────────────────────────────────────────────────────

  const region = inferRegion(parsedBRD?.productPurpose ?? '', parsedBRD?.integrationHints ?? [])
  if (region?.confidence === 'HIGH') {
    filledAnswers['q2'] = region.value
    insights.push({ label: 'Launch region', value: region.value, confidence: 'HIGH', reason: region.reason })
  } else {
    const regionOpts = [
      { value: 'Single city/region', label: 'Single city / region', description: 'Launch in one metro area or region' },
      { value: 'Single country',     label: 'Single country',       description: 'One country only at launch' },
      { value: 'Multiple countries', label: 'Multiple countries',   description: 'Several countries from day 1' },
      { value: 'Global from day 1',  label: 'Global from day 1',    description: 'No geographic restriction at launch' },
    ]
    if (region?.confidence === 'MEDIUM') {
      insights.push({ label: 'Launch region', value: region.value, confidence: 'MEDIUM', reason: region.reason })
      gapQuestions.push({
        id: 'q2', title: 'Where are you launching first?', subtitle: 'Shapes compliance (GDPR if EU) and CDN regions',
        defaultValue: region.value, multiSelect: false, options: regionOpts,
        inferredValue: region.value, inferredReason: region.reason, confidence: 'MEDIUM',
      })
    } else {
      insights.push({ label: 'Launch region', value: 'Not mentioned in BRD', confidence: 'UNKNOWN' })
      gapQuestions.push({
        id: 'q2', title: 'Where are you launching first?', subtitle: 'Shapes compliance (GDPR if EU) and CDN regions',
        defaultValue: 'Single country', multiSelect: false, options: regionOpts, confidence: 'UNKNOWN',
      })
    }
  }

  // ── Q3: Timeline — ALWAYS ask (determines Fast vs Full track) ─────────────

  gapQuestions.push({
    id: 'q3', title: 'When do you need to launch?',
    subtitle: 'Under 4 weeks → Fast Track (essentials only). Otherwise → Full Track',
    defaultValue: '3-6 months', multiSelect: false,
    options: [
      { value: 'Under 4 weeks', label: 'Under 4 weeks', description: 'Fast Track — stripped-down essentials' },
      { value: '1-2 months',    label: '1–2 months',    description: 'Full Track, compressed scope' },
      { value: '3-6 months',    label: '3–6 months',    description: 'Full Track, comfortable timeline' },
      { value: '6+ months',     label: '6+ months',     description: 'Full Track, plenty of runway' },
    ],
    confidence: 'UNKNOWN',
  })

  // ── Q4: Sensitive data ────────────────────────────────────────────────────

  const sensitive = inferSensitive(parsedBRD?.complianceHints ?? [])
  if (sensitive?.confidence === 'HIGH') {
    filledAnswers['q4'] = sensitive.value
    insights.push({ label: 'Sensitive data', value: sensitive.value, confidence: 'HIGH', reason: sensitive.reason })
  } else {
    gapQuestions.push({
      id: 'q4', title: 'Does your app handle sensitive data?',
      subtitle: 'Shapes §18 security level and §20 compliance — select all that apply',
      defaultValue: 'None', multiSelect: true, options: SENSITIVE_OPTIONS,
      ...(sensitive ? { inferredValue: sensitive.value, inferredReason: sensitive.reason, confidence: 'MEDIUM' as const } : { confidence: 'UNKNOWN' as const }),
    })
  }

  // ── Q5: User scale ────────────────────────────────────────────────────────

  const scale = inferScale(parsedBRD?.scalingHints ?? '')
  if (scale?.confidence === 'HIGH') {
    filledAnswers['q5'] = scale.value
    insights.push({ label: 'Expected scale', value: `${scale.value} users in year 1`, confidence: 'HIGH', reason: scale.reason })
  } else {
    gapQuestions.push({
      id: 'q5', title: 'How many users in year one?', subtitle: 'Shapes §03 NFRs and infrastructure sizing',
      defaultValue: scale?.value ?? '1,000-10,000', multiSelect: false, options: SCALE_OPTIONS,
      ...(scale ? { inferredValue: scale.value, inferredReason: scale.reason, confidence: 'MEDIUM' as const } : { confidence: 'UNKNOWN' as const }),
    })
  }

  return { insights, gapQuestions, filledAnswers }
}
