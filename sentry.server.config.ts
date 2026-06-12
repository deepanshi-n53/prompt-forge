import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,
  environment:      process.env.NODE_ENV,

  // Breadcrumb sanitisation
  beforeBreadcrumb(breadcrumb) {
    if (!breadcrumb.data) return breadcrumb

    if (breadcrumb.data.email) {
      breadcrumb.data.email = '[STRIPPED]'
    }
    if (typeof breadcrumb.data.url === 'string') {
      breadcrumb.data.url = breadcrumb.data.url.replace(
        /([?&])email=[^&]*/gi,
        '$1email=[STRIPPED]',
      )
    }
    return breadcrumb
  },

  // Drop 404 / 401 — expected HTTP noise, not actionable errors
  beforeSend(event, hint) {
    const err = hint?.originalException
    if (err && typeof err === 'object' && 'status' in err) {
      const status = (err as { status: number }).status
      if (status === 401 || status === 404) return null
    }
    const httpStatus = event.contexts?.response?.status_code as number | undefined
    if (httpStatus === 401 || httpStatus === 404) return null
    return event
  },
})

/**
 * Attach userId and orgId to the current Sentry scope.
 * Call this in any authenticated server handler or server component.
 */
export function setSentryContext(userId: string, orgId?: string): void {
  Sentry.setUser({ id: userId })
  if (orgId) Sentry.setTag('orgId', orgId)
}
