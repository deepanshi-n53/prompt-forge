'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plan } from '@prisma/client'
import { PLAN_LIMITS } from '@/lib/plan-limits'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface UpgradeModalProps {
  open:        boolean
  onClose:     () => void
  reason:      string
  limitType:   'project' | 'generation' | 'seat'
  currentPlan: Plan
}

const PLAN_ORDER: Plan[] = ['FREE', 'PROFESSIONAL', 'AGENCY', 'ENTERPRISE']

const PLAN_PRICES: Record<Plan, string> = {
  FREE:         '$0',
  PROFESSIONAL: '$49/mo',
  AGENCY:       '$199/mo',
  ENTERPRISE:   '$999/mo',
}

const PLAN_HIGHLIGHTS: Record<Plan, string[]> = {
  FREE:         ['1 project', '3 generations/month', '1 seat'],
  PROFESSIONAL: ['5 projects', '30 generations/month', '1 seat', 'All 4 agent formats', 'Change detection'],
  AGENCY:       ['Unlimited projects', '200 generations/month', '5 seats', 'Everything in Pro', 'Priority support'],
  ENTERPRISE:   ['Unlimited everything', 'Unlimited seats', 'Custom templates', 'Dedicated support', 'SSO / SAML'],
}

export function UpgradeModal({
  open,
  onClose,
  reason,
  limitType,
  currentPlan,
}: UpgradeModalProps) {
  const [loading, setLoading] = useState(false)

  const idx      = PLAN_ORDER.indexOf(currentPlan)
  const nextPlan = PLAN_ORDER[idx + 1] as Plan | undefined

  if (!nextPlan) return null

  const limitLabel: Record<typeof limitType, string> = {
    project:    `your ${PLAN_LIMITS[currentPlan].maxProjects}-project limit`,
    generation: `your ${PLAN_LIMITS[currentPlan].maxGenerationsPerMonth} generations/month limit`,
    seat:       `your ${PLAN_LIMITS[currentPlan].maxSeats}-seat limit`,
  }

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan: nextPlan }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to start checkout')
        return
      }
      window.location.href = data.checkoutUrl
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade your plan</DialogTitle>
          <DialogDescription>
            You hit {limitLabel[limitType]} while trying to {reason}.
          </DialogDescription>
        </DialogHeader>

        {/* next plan card */}
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-sm font-semibold text-blue-800">
                {nextPlan.charAt(0) + nextPlan.slice(1).toLowerCase()}
              </span>
              <p className="text-xs text-blue-600 mt-0.5">Recommended upgrade</p>
            </div>
            <span className="text-lg font-bold text-blue-900">{PLAN_PRICES[nextPlan]}</span>
          </div>
          <ul className="space-y-1.5">
            {PLAN_HIGHLIGHTS[nextPlan].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-xs text-blue-700">
                <svg className="size-3.5 shrink-0 text-blue-500" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter showCloseButton>
          <Button onClick={handleUpgrade} disabled={loading} size="sm">
            {loading ? 'Redirecting to checkout…' : `Upgrade to ${nextPlan.charAt(0) + nextPlan.slice(1).toLowerCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
