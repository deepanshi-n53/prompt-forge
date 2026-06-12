'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Plan } from '@prisma/client'

interface BillingActionsProps {
  currentPlan:      Plan
  hasStripeAccount: boolean
}

const PLAN_ORDER: Plan[] = ['FREE', 'PROFESSIONAL', 'AGENCY', 'ENTERPRISE']

export function BillingActions({ currentPlan, hasStripeAccount }: BillingActionsProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const nextPlan = PLAN_ORDER[PLAN_ORDER.indexOf(currentPlan) + 1] as Plan | undefined

  async function handleUpgrade(plan: Plan) {
    setLoading(plan)
    try {
      const res = await fetch('/api/billing/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to start checkout')
        return
      }
      window.location.href = data.checkoutUrl
    } finally {
      setLoading(null)
    }
  }

  async function handlePortal() {
    setLoading('portal')
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to open billing portal')
        return
      }
      window.location.href = data.portalUrl
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {nextPlan && (
        <Button
          onClick={() => handleUpgrade(nextPlan)}
          disabled={loading !== null}
          size="sm"
        >
          {loading === nextPlan ? 'Redirecting…' : `Upgrade to ${nextPlan.charAt(0) + nextPlan.slice(1).toLowerCase()}`}
        </Button>
      )}
      {hasStripeAccount && (
        <Button
          variant="outline"
          onClick={handlePortal}
          disabled={loading !== null}
          size="sm"
        >
          {loading === 'portal' ? 'Opening…' : 'Manage billing'}
        </Button>
      )}
    </div>
  )
}
