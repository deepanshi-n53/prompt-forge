'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'

export default function GlobalError({
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
    <html lang="en">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
          <div className="max-w-md space-y-6">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full border-4 border-red-100 bg-red-50">
              <svg className="size-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-zinc-900">Something went wrong</h1>
              <p className="text-sm text-zinc-500">
                An unexpected error occurred. We&apos;ve been notified and are looking into it.
              </p>
              {error.digest && (
                <p className="font-mono text-xs text-zinc-400">
                  Error ID: {error.digest}
                </p>
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
                href="/"
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 transition-colors"
              >
                Go home
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
        </main>
      </body>
    </html>
  )
}
