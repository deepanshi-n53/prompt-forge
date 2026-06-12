'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'

interface PricingCTAProps {
  plan:       string
  isFree:     boolean
  isSignedIn: boolean
  isCurrent:  boolean
}

export function PricingCTA({ plan, isFree, isSignedIn, isCurrent }: PricingCTAProps) {
  const [loading, setLoading] = useState(false)

  if (isCurrent) {
    return (
      <Link
        href="/account/billing"
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-center')}
      >
        Current plan
      </Link>
    )
  }

  if (isFree) {
    if (isSignedIn) {
      return (
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ size: 'sm' }), 'w-full justify-center')}
        >
          Go to dashboard
        </Link>
      )
    }
    return (
      <Link
        href="/sign-up"
        className={cn(buttonVariants({ size: 'sm' }), 'w-full justify-center')}
      >
        Get started free
      </Link>
    )
  }

  if (!isSignedIn) {
    return (
      <Link
        href={`/sign-up?redirect=/pricing`}
        className={cn(buttonVariants({ size: 'sm' }), 'w-full justify-center')}
      >
        Get started
      </Link>
    )
  }

  async function handleCheckout() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Failed to start checkout')
        return
      }
      window.location.href = data.checkoutUrl
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      size="sm"
      className="w-full"
      onClick={handleCheckout}
      disabled={loading}
    >
      {loading ? 'Redirecting…' : 'Get started'}
    </Button>
  )
}
