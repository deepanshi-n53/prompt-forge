'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12 text-center">
      <div className="max-w-md space-y-6">
        <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full border-4 border-red-100 bg-red-50">
          <svg className="size-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-zinc-900">Something went wrong</h2>
          <p className="text-sm text-zinc-500">
            An error occurred while rendering this page. We&apos;ve been notified.
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-zinc-400">Ref: {error.digest}</p>
          )}
        </div>

        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 transition-colors"
          >
            Back to dashboard
          </Link>
        </div>

        <p className="text-xs text-zinc-400">
          Need help?{' '}
          <a
            href="mailto:support@promptforge.ai"
            className="underline underline-offset-4 hover:text-zinc-600"
          >
            support@promptforge.ai
          </a>
        </p>
      </div>
    </div>
  )
}
