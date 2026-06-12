import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ── Custom error ──────────────────────────────────────────────────────────────

export class RateLimitError extends Error {
  readonly retryAfter: number

  constructor(retryAfter: number, message = 'Too many requests. Please slow down.') {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

// ── Redis singleton — lazy, fails gracefully if env vars are absent ───────────

let _redis: Redis | null | undefined = undefined

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    _redis = null
    return null
  }
  try {
    _redis = Redis.fromEnv()
    return _redis
  } catch (err) {
    console.warn('[rate-limit] Redis init failed — rate limiting disabled', err)
    _redis = null
    return null
  }
}

// ── Limiter factory ───────────────────────────────────────────────────────────

type Duration = `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`

function makeLimiter(
  requests: number,
  window: Duration,
  prefix: string,
): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix,
    ephemeralCache: new Map(),
  })
}

// ── Named limiters ────────────────────────────────────────────────────────────

/** 60 req/min per userId — standard API calls */
export const generalAPILimiter = makeLimiter(60, '1 m', 'rl:general')

/** 5 req/min per userId — AI/generation endpoints */
export const aiEndpointLimiter = makeLimiter(5, '1 m', 'rl:ai')

/** 10 uploads/hour per userId */
export const fileUploadLimiter = makeLimiter(10, '1 h', 'rl:upload')

/** 10 req/min per IP — auth endpoints */
export const authEndpointLimiter = makeLimiter(10, '1 m', 'rl:auth')

// Backward-compat alias used by brd/upload route (will be migrated)
/** @deprecated use fileUploadLimiter + applyRateLimit */
export const uploadRateLimit = fileUploadLimiter

// ── applyRateLimit ────────────────────────────────────────────────────────────

/**
 * Runs the given limiter for `identifier`. Throws RateLimitError if exceeded.
 * Fails open (allows the request) if Redis is unavailable.
 */
export async function applyRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<void> {
  if (!limiter) {
    // Redis unavailable — fail open
    console.warn('[rate-limit] No limiter available, skipping rate limit check')
    return
  }

  let result: Awaited<ReturnType<Ratelimit['limit']>>
  try {
    result = await limiter.limit(identifier)
  } catch (err) {
    // Redis call failed — fail open
    console.warn('[rate-limit] Redis call failed, allowing request', err)
    return
  }

  if (!result.success) {
    const retryAfter = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000),
    )
    throw new RateLimitError(retryAfter)
  }
}
