import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.clerk.com *.posthog.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: *.clerk.com",
  "connect-src 'self' *.anthropic.com *.inngest.com *.sentry.io *.posthog.com *.supabase.co",
].join('; ')

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy',   value: CSP },
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Suppress Sentry CLI output in local builds
  silent: !process.env.CI,

  // Upload larger source map chunks for better stack traces
  widenClientFileUpload: true,

  // Tree-shake Sentry logger statements in production
  disableLogger: true,

  // Disable Vercel Cron monitoring (we use Inngest)
  automaticVercelMonitors: false,
})
