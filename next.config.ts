import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.clerk.com *.clerk.accounts.dev https://challenges.cloudflare.com *.posthog.com",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: *.clerk.com *.supabase.co",
  "connect-src 'self' *.anthropic.com *.openai.com *.inngest.com *.sentry.io *.posthog.com *.supabase.co *.clerk.com *.clerk.accounts.dev https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com *.clerk.com *.clerk.accounts.dev",
].join('; ')

const nextConfig: NextConfig = {
  output: 'standalone',
  webpack(config, { isServer }) {
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      }
    }
    return config
  },
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

  silent:    true,
  telemetry: false,

  widenClientFileUpload: true,

  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: false,
  },
})
