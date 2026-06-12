import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,
  environment:      process.env.NODE_ENV,

  // Breadcrumb sanitisation — strip email wherever it appears
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

  // Filter low-value errors (404s and auth failures)
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
