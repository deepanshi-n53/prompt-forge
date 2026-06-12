import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.clerk.com *.clerk.accounts.dev https://challenges.cloudflare.com *.posthog.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: *.clerk.com *.clerk.accounts.dev",
  "connect-src 'self' *.clerk.com *.clerk.accounts.dev https://challenges.cloudflare.com *.inngest.com *.sentry.io *.posthog.com *.supabase.co",
  "frame-src 'self' *.clerk.com *.clerk.accounts.dev https://challenges.cloudflare.com",
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

  silent: !process.env.CI,

  widenClientFileUpload: true,

  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: false,
  },
})
