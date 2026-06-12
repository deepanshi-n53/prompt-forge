export interface Suggestion {
  id: string
  title: string
  description: string
  risk: string
  sections: string[]
  archetype: string
}

interface SuggestionDef {
  id: string
  title: string
  description: string
  risk: string
  sections: string[]
  archetypes: string[]  // 'all' matches every archetype; otherwise substring-matched
}

const SUGGESTIONS: SuggestionDef[] = [
  // ── Marketplace ─────────────────────────────────────────────────────────────
  {
    id: 'dispute-resolution',
    title: 'Dispute Resolution Flow',
    description:
      'A structured process for buyers and sellers to raise and resolve conflicts, with admin escalation and automated refund triggers.',
    risk: 'No way to handle buyer/seller conflicts',
    sections: ['02', '07', '08'],
    archetypes: ['marketplace'],
  },
  {
    id: 'cancellation-policy',
    title: 'Cancellation & Refund Policy',
    description:
      'Configurable cancellation windows, partial-refund rules, and automated processing tied to booking or order lifecycle.',
    risk: 'No policy leads to manual support requests',
    sections: ['17', '08'],
    archetypes: ['marketplace'],
  },
  {
    id: 'background-checks',
    title: 'Background Verification',
    description:
      'Identity and background verification for service providers via third-party APIs (e.g. Stripe Identity, Checkr).',
    risk: 'Trust gap for service providers',
    sections: ['02', '06'],
    archetypes: ['marketplace'],
  },
  {
    id: 'in-app-messaging',
    title: 'In-App Messaging',
    description:
      'Real-time chat channel between buyers and sellers that keeps all communication on-platform with audit trail.',
    risk: 'Users go off-platform, creating liability',
    sections: ['09', '07', '08'],
    archetypes: ['marketplace'],
  },
  // ── B2B SaaS ─────────────────────────────────────────────────────────────────
  {
    id: 'sso-saml',
    title: 'Enterprise SSO / SAML',
    description:
      'SAML 2.0 or OIDC SSO so enterprise customers can log in via their own identity provider (Okta, Azure AD, Google Workspace).',
    risk: 'Enterprise deals lost without SSO',
    sections: ['06', '07', '08'],
    archetypes: ['b2b saas', 'b2b', 'saas'],
  },
  {
    id: 'audit-log',
    title: 'Audit Log',
    description:
      'Immutable, queryable log of all user and admin actions for security forensics, compliance reporting, and debugging.',
    risk: 'Compliance requirement for enterprise',
    sections: ['07', '08', '19'],
    archetypes: ['b2b saas', 'b2b', 'saas'],
  },
  {
    id: 'data-export',
    title: 'Data Export CSV/JSON',
    description:
      'Self-serve export of all user-owned data in standard formats, covering GDPR Article 20 right to data portability.',
    risk: 'GDPR right to portability',
    sections: ['08', '20'],
    archetypes: ['b2b saas', 'b2b', 'saas'],
  },
  // ── All archetypes ───────────────────────────────────────────────────────────
  {
    id: 'soft-delete',
    title: 'Soft Delete & Recovery',
    description:
      'Records are flagged deleted rather than hard-deleted, with a grace-period recovery UI and background purge job.',
    risk: 'Accidental deletion with no recovery',
    sections: ['07'],
    archetypes: ['all'],
  },
  {
    id: 'onboarding-flow',
    title: 'Onboarding & Empty States',
    description:
      'Guided first-run experience, contextual empty states, and a measurable "aha moment" trigger to reduce early churn.',
    risk: 'New user confusion leads to early churn',
    sections: ['02', '14'],
    archetypes: ['all'],
  },
  // ── AI Tool ──────────────────────────────────────────────────────────────────
  {
    id: 'usage-billing',
    title: 'Usage-Based Billing',
    description:
      'Per-token or per-request metering with user-configurable budget caps and overage alerts to prevent cost blow-outs.',
    risk: 'Flat fee destroyed by heavy API users',
    sections: ['17'],
    archetypes: ['ai tool', 'ai', 'ai-powered'],
  },
  {
    id: 'output-history',
    title: 'Output History & Saved Results',
    description:
      'Persistent storage of AI-generated outputs with search, version comparison, and one-click re-run capability.',
    risk: 'Users lose work and get frustrated',
    sections: ['07', '08'],
    archetypes: ['ai tool', 'ai', 'ai-powered'],
  },
]

function matchesArchetype(def: SuggestionDef, archetype: string): boolean {
  if (def.archetypes.includes('all')) return true
  const norm = archetype.toLowerCase()
  return def.archetypes.some((a) => norm.includes(a) || a.includes(norm))
}

/**
 * Returns up to 5 suggestions for the given archetype, excluding those whose
 * IDs appear in currentFeatures (already-added suggestion IDs or feature names).
 */
export function getSuggestionsForArchetype(
  archetype: string,
  currentFeatures: string[],
): Suggestion[] {
  const added = new Set(currentFeatures.map((f) => f.toLowerCase()))

  return SUGGESTIONS.filter(
    (s) => matchesArchetype(s, archetype) && !added.has(s.id),
  )
    .slice(0, 5)
    .map(({ archetypes: omit, ...rest }) => { void omit; return { ...rest, archetype } })
}
