import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { PLAN_LIMITS } from '@/lib/plan-limits'
import { Plan } from '@prisma/client'
import { BillingActions } from './_components/BillingActions'

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>
}) {
  const user     = await requireAuth()
  const { upgraded } = await searchParams

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [projectCount, generationCount] = await Promise.all([
    db.project.count({ where: { ownerId: user.id } }),
    db.generatedPrompt.count({
      where: { project: { ownerId: user.id }, createdAt: { gte: monthStart } },
    }),
  ])

  const limits      = PLAN_LIMITS[user.plan]
  const planOrder   = ['FREE', 'PROFESSIONAL', 'AGENCY', 'ENTERPRISE'] as Plan[]
  const planIndex   = planOrder.indexOf(user.plan)

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-10">
      {/* success banner */}
      {upgraded === 'true' && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
          Your plan has been upgraded. Welcome to {user.plan.charAt(0) + user.plan.slice(1).toLowerCase()}!
        </div>
      )}

      {/* page header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Billing</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage your plan and payment details.</p>
      </div>

      {/* current plan card */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${planBadgeClass(user.plan)}`}>
                {user.plan}
              </span>
              {user.plan === 'FREE' && (
                <span className="text-xs text-zinc-400">No credit card required</span>
              )}
            </div>
            <p className="mt-2 text-sm text-zinc-500">{planDescription(user.plan)}</p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-2xl font-bold text-zinc-900">{planPrice(user.plan)}</span>
            {user.plan !== 'FREE' && <span className="text-sm text-zinc-400"> / mo</span>}
          </div>
        </div>

        {/* usage meters */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UsageMeter
            label="Projects"
            used={projectCount}
            max={limits.maxProjects}
          />
          <UsageMeter
            label="Generations this month"
            used={generationCount}
            max={limits.maxGenerationsPerMonth}
          />
        </div>

        <BillingActions
          currentPlan={user.plan}
          hasStripeAccount={!!user.stripeCustomerId}
        />
      </section>

      {/* plan comparison table */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Compare plans</h2>
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left font-medium text-zinc-500 w-48">Feature</th>
                {planOrder.map((plan) => (
                  <th
                    key={plan}
                    className={`px-4 py-3 text-center font-semibold ${plan === user.plan ? 'text-blue-600' : 'text-zinc-700'}`}
                  >
                    {plan.charAt(0) + plan.slice(1).toLowerCase()}
                    {plan === user.plan && (
                      <span className="ml-1 text-xs font-normal text-blue-400">(current)</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.feature} className="hover:bg-zinc-50/50">
                  <td className="px-4 py-3 text-zinc-600">{row.feature}</td>
                  {planOrder.map((plan, i) => (
                    <td
                      key={plan}
                      className={`px-4 py-3 text-center ${i > planIndex ? 'text-blue-600 font-medium' : 'text-zinc-600'}`}
                    >
                      {row[plan]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function UsageMeter({ label, used, max }: { label: string; used: number; max: number }) {
  const isUnlimited = max === Infinity
  const pct         = isUnlimited ? 0 : Math.min(100, Math.round((used / max) * 100))
  const nearLimit   = !isUnlimited && pct >= 80

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span className={nearLimit ? 'text-amber-600 font-medium' : ''}>
          {used} / {isUnlimited ? '∞' : max}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 w-full rounded-full bg-zinc-100">
          <div
            className={`h-full rounded-full transition-all ${nearLimit ? 'bg-amber-500' : 'bg-blue-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ── Static data ───────────────────────────────────────────────────────────────

type PlanRow = { feature: string } & Record<Plan, string>

const COMPARISON_ROWS: PlanRow[] = [
  { feature: 'Projects',          FREE: '1',         PROFESSIONAL: '5',    AGENCY: 'Unlimited',  ENTERPRISE: 'Unlimited'  },
  { feature: 'Generations/month', FREE: '3',         PROFESSIONAL: '30',   AGENCY: '200',        ENTERPRISE: 'Unlimited'  },
  { feature: 'Team seats',        FREE: '1',         PROFESSIONAL: '1',    AGENCY: '5',          ENTERPRISE: 'Unlimited'  },
  { feature: 'Agent formats',     FREE: 'Claude Code', PROFESSIONAL: 'All 4', AGENCY: 'All 4',   ENTERPRISE: 'All 4'      },
  { feature: 'Change detection',  FREE: '—',         PROFESSIONAL: '✓',    AGENCY: '✓',          ENTERPRISE: '✓'          },
  { feature: 'Priority support',  FREE: '—',         PROFESSIONAL: 'Email', AGENCY: 'Priority',  ENTERPRISE: 'Dedicated'  },
  { feature: 'Custom templates',  FREE: '—',         PROFESSIONAL: '—',    AGENCY: '—',          ENTERPRISE: '✓'          },
]

function planBadgeClass(plan: Plan): string {
  return {
    FREE:         'bg-zinc-100 text-zinc-600',
    PROFESSIONAL: 'bg-blue-50 text-blue-700',
    AGENCY:       'bg-purple-50 text-purple-700',
    ENTERPRISE:   'bg-amber-50 text-amber-700',
  }[plan]
}

function planDescription(plan: Plan): string {
  return {
    FREE:         'Everything you need to get started.',
    PROFESSIONAL: 'For solo developers shipping faster.',
    AGENCY:       'For teams building client products.',
    ENTERPRISE:   'White-glove support for large organisations.',
  }[plan]
}

function planPrice(plan: Plan): string {
  return { FREE: '$0', PROFESSIONAL: '$49', AGENCY: '$199', ENTERPRISE: '$999' }[plan]
}
