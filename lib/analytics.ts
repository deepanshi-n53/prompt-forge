// ── Client-side (browser only) ────────────────────────────────────────────────

let _phInitialized = false

async function getPostHogClient() {
  if (typeof window === 'undefined') return null
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null
  // Respect cookie consent — only initialise if the user explicitly accepted analytics
  if (localStorage.getItem('pf-cookie-consent') !== 'all') return null

  const { default: posthog } = await import('posthog-js')
  if (!_phInitialized) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host:        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      capture_pageview: false,
      capture_pageleave: false,
    })
    _phInitialized = true
  }
  return posthog
}

/** Client-side event tracking (browser only, no userId required). */
export function trackClientEvent(event: string, props?: Record<string, unknown>): void {
  void getPostHogClient().then((p) => p?.capture(event, props))
}

// ── Server-side analytics via PostHog REST API ────────────────────────────────

const POSTHOG_HOST = process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com'

// Standard event catalogue — never include PII or BRD content
export type AnalyticsEvent =
  | 'brd_uploaded'
  | 'health_score_viewed'
  | 'questions_completed'
  | 'prompts_generated'
  | 'prompt_exported'
  | 'change_detected'
  | 'upgrade_clicked'

export interface EventProperties {
  brd_uploaded:        { projectId: string; fileType: string; fileSize: number }
  health_score_viewed: { projectId: string; score: number }
  questions_completed: { projectId: string }
  prompts_generated:   { projectId: string; count: number; track: string }
  prompt_exported:     { projectId: string; section: string; format: string }
  change_detected:     { projectId: string; breakingCount: number }
  upgrade_clicked:     { fromPlan: string; trigger: string }
}

/**
 * Server-side analytics — fire-and-forget, never blocks the request.
 * Do NOT pass PII, BRD content, or API keys in properties.
 */
export function trackEvent<E extends AnalyticsEvent>(
  event:      E,
  userId:     string,
  properties: EventProperties[E],
): void {
  const apiKey = process.env.POSTHOG_API_KEY
  if (!apiKey || !userId) return

  const payload = {
    api_key:     apiKey,
    event,
    distinct_id: userId,
    timestamp:   new Date().toISOString(),
    properties: {
      ...(properties as Record<string, unknown>),
      $lib: 'posthog-node-fetch',
    },
  }

  fetch(`${POSTHOG_HOST}/capture/`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  }).catch((err: unknown) => {
    console.error('[analytics] PostHog capture failed', { event, err })
  })
}
