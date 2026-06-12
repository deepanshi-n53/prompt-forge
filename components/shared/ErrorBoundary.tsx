'use client'

import { Component, type ReactNode, type ErrorInfo } from 'react'
import * as Sentry from '@sentry/nextjs'

interface Props {
  children: ReactNode
  fallback?: (props: { error: Error; eventId: string | null; reset: () => void }) => ReactNode
}

interface State {
  error:   Error | null
  eventId: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, eventId: null }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const eventId = Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    })
    this.setState({ error, eventId: eventId ?? null })
  }

  reset = () => this.setState({ error: null, eventId: null })

  render() {
    const { error, eventId } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) {
      return this.props.fallback({ error, eventId, reset: this.reset })
    }

    return <ErrorFallback error={error} eventId={eventId} onReset={this.reset} />
  }
}

// ── Default fallback UI ───────────────────────────────────────────────────────

function ErrorFallback({
  error,
  eventId,
  onReset,
}: {
  error:   Error
  eventId: string | null
  onReset: () => void
}) {
  return (
    <div
      role="alert"
      className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-xl border border-red-100 bg-red-50 p-8 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
        <svg className="size-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>

      <div className="space-y-1">
        <p className="font-semibold text-red-800">Something went wrong</p>
        <p className="text-sm text-red-600">{error.message || 'An unexpected error occurred.'}</p>
      </div>

      {eventId && (
        <p className="font-mono text-[11px] text-red-400">Error ID: {eventId}</p>
      )}

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors"
        >
          Try refreshing
        </button>
        <a
          href="mailto:support@promptforge.ai"
          className="text-xs text-red-500 underline underline-offset-4 hover:text-red-700"
        >
          Contact support
        </a>
      </div>
    </div>
  )
}
