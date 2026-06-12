import { auth } from '@clerk/nextjs/server'
import { getCurrentUser } from '@/lib/auth'
import { Plan } from '@prisma/client'
import { PricingCTA } from './_components/PricingCTA'

export const metadata = { title: 'Pricing — PromptForge' }

export default async function PricingPage() {
  const { userId }    = await auth()
  const isSignedIn    = !!userId
  const user          = isSignedIn ? await getCurrentUser() : null
  const currentPlan   = user?.plan ?? null

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      {/* header */}
      <div className="text-center space-y-4 mb-14">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
          Simple, transparent pricing
        </h1>
        <p className="text-lg text-zinc-500 max-w-xl mx-auto">
          Pick the plan that fits your team. All plans include a 7-day free trial on paid tiers.
        </p>
      </div>

      {/* plan cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border p-6 ${
              plan.highlighted
                ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'
                : 'border-zinc-200 bg-white'
            }`}
          >
            {plan.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Most popular
                </span>
              </div>
            )}

            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">
                {plan.name}
              </h2>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-zinc-900">{plan.price}</span>
                {plan.price !== '$0' && (
                  <span className="text-sm text-zinc-500">/mo</span>
                )}
              </div>
              <p className="text-xs text-zinc-500">{plan.description}</p>
            </div>

            <ul className="mt-6 flex-1 space-y-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-zinc-600">
                  <svg
                    className={`mt-0.5 size-4 shrink-0 ${plan.highlighted ? 'text-blue-500' : 'text-zinc-400'}`}
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <PricingCTA
                plan={plan.id}
                isFree={plan.id === 'FREE'}
                isSignedIn={isSignedIn}
                isCurrent={currentPlan === plan.id}
              />
            </div>
          </div>
        ))}
      </div>

      {/* feature comparison table */}
      <div className="mt-20 space-y-4">
        <h2 className="text-xl font-semibold text-zinc-900 text-center">Full feature comparison</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-5 py-3 text-left font-medium text-zinc-500 min-w-48">Feature</th>
                {PLANS.map((plan) => (
                  <th
                    key={plan.id}
                    className={`px-5 py-3 text-center font-semibold ${plan.highlighted ? 'text-blue-600' : 'text-zinc-700'}`}
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.feature} className="hover:bg-zinc-50/50">
                  <td className="px-5 py-3 text-zinc-600">{row.feature}</td>
                  {(['FREE', 'PROFESSIONAL', 'AGENCY', 'ENTERPRISE'] as Plan[]).map((plan) => (
                    <td key={plan} className="px-5 py-3 text-center text-zinc-700">
                      {row[plan]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ / trust note */}
      <div className="mt-16 text-center space-y-2">
        <p className="text-sm text-zinc-500">
          All plans include unlimited BRD storage, access to Claude-powered parsing, and export to
          Claude Code, Cursor, Lovable, and Bolt.
        </p>
        <p className="text-sm text-zinc-400">
          Questions? Email us at{' '}
          <a href="mailto:hello@promptforge.dev" className="underline hover:text-zinc-600">
            hello@promptforge.dev
          </a>
        </p>
      </div>
    </div>
  )
}

// ── Static data ───────────────────────────────────────────────────────────────

const PLANS = [
  {
    id:          'FREE',
    name:        'Free',
    price:       '$0',
    description: 'Everything you need to get started.',
    highlighted: false,
    features: [
      '1 project',
      '3 generations/month',
      '1 seat',
      'Claude Code export',
      'Community support',
    ],
  },
  {
    id:          'PROFESSIONAL',
    name:        'Pro',
    price:       '$49',
    description: 'For solo developers shipping faster.',
    highlighted: true,
    features: [
      '5 projects',
      '30 generations/month',
      '1 seat',
      'All 4 agent formats',
      'Change detection',
      'Email support',
    ],
  },
  {
    id:          'AGENCY',
    name:        'Agency',
    price:       '$199',
    description: 'For teams building client products.',
    highlighted: false,
    features: [
      'Unlimited projects',
      '200 generations/month',
      '5 seats',
      'Everything in Pro',
      'Team collaboration',
      'Priority support',
    ],
  },
  {
    id:          'ENTERPRISE',
    name:        'Enterprise',
    price:       '$999',
    description: 'White-glove for large organisations.',
    highlighted: false,
    features: [
      'Unlimited everything',
      'Unlimited seats',
      'Custom agent templates',
      'SSO / SAML',
      'SLA + dedicated support',
    ],
  },
]

type ComparisonRow = { feature: string } & Record<Plan, string>

const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: 'Projects',          FREE: '1',           PROFESSIONAL: '5',    AGENCY: 'Unlimited',  ENTERPRISE: 'Unlimited'  },
  { feature: 'Generations/month', FREE: '3',           PROFESSIONAL: '30',   AGENCY: '200',        ENTERPRISE: 'Unlimited'  },
  { feature: 'Team seats',        FREE: '1',           PROFESSIONAL: '1',    AGENCY: '5',          ENTERPRISE: 'Unlimited'  },
  { feature: 'Agent formats',     FREE: 'Claude Code', PROFESSIONAL: 'All 4', AGENCY: 'All 4',     ENTERPRISE: 'All 4'      },
  { feature: 'Change detection',  FREE: '—',           PROFESSIONAL: '✓',    AGENCY: '✓',          ENTERPRISE: '✓'          },
  { feature: 'BRD history',       FREE: '✓',           PROFESSIONAL: '✓',    AGENCY: '✓',          ENTERPRISE: '✓'          },
  { feature: 'Custom templates',  FREE: '—',           PROFESSIONAL: '—',    AGENCY: '—',          ENTERPRISE: '✓'          },
  { feature: 'SSO / SAML',        FREE: '—',           PROFESSIONAL: '—',    AGENCY: '—',          ENTERPRISE: '✓'          },
  { feature: 'Support',           FREE: 'Community',   PROFESSIONAL: 'Email', AGENCY: 'Priority',  ENTERPRISE: 'Dedicated'  },
  { feature: 'SLA',               FREE: '—',           PROFESSIONAL: '—',    AGENCY: '—',          ENTERPRISE: '✓'          },
]
