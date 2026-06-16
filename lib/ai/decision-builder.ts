import type { ParsedBRD } from '@/types/brd'
import type { SectionDecision } from '@/types/decision'

export type UserAnswers = {
  q1?:  string  // billing model
  q2?:  string  // launch region
  q3?:  string  // timeline → track
  q4?:  string  // sensitive data (comma-separated or 'None')
  q5?:  string  // year-1 user count
  q6?:  string  // deployment target
  q7?:  string  // multi-tenant
  q8?:  string  // auth method
  q9?:  string  // db preference
  q10?: string  // MFA policy
  [key: string]: string | undefined  // mid-gen pause answers
}

export const ANSWER_DEFAULTS: Record<string, string> = {
  q1:  'Monthly subscription',
  q2:  'Single country — GDPR flagged as assumption',
  q3:  '3-6 months',
  q4:  'None',
  q5:  '1,000-10,000',
  q6:  'Railway',
  q7:  'No',
  q8:  'Email + social',
  q9:  'PostgreSQL',
  q10: 'Optional for users',
}

export function trackFromTimeline(q3: string): 'FAST' | 'FULL' {
  return q3.startsWith('Under 4 weeks') ? 'FAST' : 'FULL'
}

function securityLevel(q4: string): 'STANDARD' | 'ELEVATED' | 'HIGH' {
  if (q4 === 'None') return 'STANDARD'
  if (q4.includes('Health') || q4.includes('Financial') || q4.includes('Children')) return 'HIGH'
  return 'ELEVATED'
}

function complianceFlags(q2: string, q4: string): string[] {
  const flags: string[] = []
  if (
    q2.includes('Multiple countries') ||
    q2.includes('Global') ||
    q2.includes('Europe') ||
    q2.includes('EU') ||
    q2.includes('GDPR')
  ) flags.push('GDPR')
  if (q4.includes('Health')) flags.push('HIPAA')
  if (q4.includes('Financial')) flags.push('PCI-DSS')
  if (q4.includes('Children')) flags.push('COPPA')
  return flags.length ? flags : ['none-identified']
}

function infraTier(q5: string): { tier: string; db_tier: string; cdn: boolean } {
  if (q5.startsWith('Under 1,000'))   return { tier: 'micro',   db_tier: 'shared',           cdn: false }
  if (q5.startsWith('1,000-10,000'))  return { tier: 'starter', db_tier: 'dedicated-small',   cdn: true  }
  if (q5.startsWith('10,000-100,000'))return { tier: 'growth',  db_tier: 'dedicated-medium',  cdn: true  }
  return                                     { tier: 'scale',   db_tier: 'dedicated-large',   cdn: true  }
}

export function buildDecisionGraph(
  parsedBRD: ParsedBRD,
  userAnswers: UserAnswers,
): { sections: Record<string, SectionDecision>; track: 'FAST' | 'FULL' } {
  // User answers win; fill blanks with defaults
  const a: Record<string, string> = {
    ...ANSWER_DEFAULTS,
    ...Object.fromEntries(
      Object.entries(userAnswers).filter(([, v]) => v != null && v !== '') as [string, string][],
    ),
  }

  const track  = trackFromTimeline(a.q3)
  const sec    = securityLevel(a.q4)
  const flags  = complianceFlags(a.q2, a.q4)
  const infra  = infraTier(a.q5)
  const now    = new Date().toISOString()
  const brdBase = parsedBRD.extractedDecisions ?? {}

  const sections: Record<string, SectionDecision> = {
    '§05': {
      sectionNum:  '§05',
      sectionName: 'High-Level Architecture',
      completedAt: now,
      decisions: {
        deployment_target: a.q6,
        multi_tenant:      a.q7,
        architecture_style: a.q7 === 'Yes — B2B multi-tenant' ? 'modular-monolith-multitenant' : 'modular-monolith',
      },
      downstreamDependencies: ['§07', '§09', '§23', '§24'],
      confidence: 0.85,
      assumptions: [],
    },

    '§06': {
      sectionNum:  '§06',
      sectionName: 'Authentication & Authorization',
      completedAt: now,
      decisions: {
        auth_method:       a.q8,
        mfa_policy:        a.q10,
        db_preference:     a.q9,
      },
      downstreamDependencies: ['§09', '§18'],
      confidence: 0.9,
      assumptions: [],
    },

    '§03': {
      sectionNum:  '§03',
      sectionName: 'Non-Functional Requirements',
      completedAt: now,
      decisions: {
        ...brdBase,
        delivery_timeline:    a.q3,
        launch_track:         track,
        expected_users_year1: a.q5,
        infra_tier:           infra.tier,
        db_tier:              infra.db_tier,
        cdn_required:         infra.cdn,
      },
      downstreamDependencies: ['§26', '§27', '§34', '§35'],
      confidence: a.q5 === 'No idea' ? 0.6 : 0.9,
      assumptions: a.q5 === 'No idea'
        ? [{ field: 'user_scale', value: '1k-10k', reason: 'No estimate provided — defaulting to mid-tier', confidence: 'MEDIUM' }]
        : [],
    },

    '§17': {
      sectionNum:  '§17',
      sectionName: 'Billing & Monetisation',
      completedAt: now,
      decisions: {
        billing_model:    a.q1,
        inferred_billing: parsedBRD.monetizationModel ?? null,
      },
      downstreamDependencies: ['§18', '§23', '§24'],
      confidence: a.q1 === 'Not yet decided' ? 0.5 : 0.95,
      assumptions: a.q1 === 'Not yet decided'
        ? [{ field: 'billing_model', value: 'monthly-subscription', reason: 'Not yet decided — architecture uses monthly subscription as default', confidence: 'LOW' }]
        : [],
    },

    '§18': {
      sectionNum:  '§18',
      sectionName: 'Security Architecture',
      completedAt: now,
      decisions: {
        security_level:             sec,
        sensitive_data_types:       a.q4,
        encryption_at_rest:         sec !== 'STANDARD',
        audit_log_required:         sec === 'HIGH',
        mfa_required:               sec !== 'STANDARD',
      },
      downstreamDependencies: ['§19', '§20', '§21'],
      confidence: a.q4 === 'None' ? 0.6 : 0.95,
      assumptions: a.q4 === 'None'
        ? [{ field: 'sensitive_data', value: 'none', reason: 'No sensitive data confirmed — revisit before launch', confidence: 'MEDIUM' }]
        : [],
    },

    '§20': {
      sectionNum:  '§20',
      sectionName: 'Compliance & Regulatory',
      completedAt: now,
      decisions: {
        launch_regions:      a.q2,
        compliance_flags:    flags,
        gdpr_required:       flags.includes('GDPR'),
        hipaa_required:      flags.includes('HIPAA'),
        pci_required:        flags.includes('PCI-DSS'),
        coppa_required:      flags.includes('COPPA'),
        cdn_regions:         flags.includes('GDPR') ? ['eu-west-1', 'us-east-1'] : ['us-east-1'],
      },
      downstreamDependencies: ['§21', '§22', '§26'],
      confidence: 0.85,
      assumptions: a.q2.includes('assumption')
        ? [{ field: 'gdpr_scope', value: 'pending', reason: 'Single country default — GDPR flagged pending confirmation of target market', confidence: 'MEDIUM' }]
        : [],
    },
  }

  return { sections, track }
}
