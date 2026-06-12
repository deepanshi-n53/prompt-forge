import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import type { User } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import {
  applyRateLimit,
  RateLimitError,
  generalAPILimiter,
  aiEndpointLimiter,
  fileUploadLimiter,
  authEndpointLimiter,
} from '@/lib/rate-limit'
import {
  checkProjectLimit,
  checkGenerationLimit,
  PlanLimitError,
} from '@/lib/plan-limits'
import type { Ratelimit } from '@upstash/ratelimit'

// ── Handler types ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteCtx = any

export type RouteHandler<C = RouteCtx> = (
  req: NextRequest,
  ctx: C,
) => Promise<NextResponse>

export type AuthedHandler<C = RouteCtx> = (
  req: NextRequest,
  ctx: C,
  user: User,
) => Promise<NextResponse>

export type LimiterType = 'general' | 'ai' | 'upload' | 'auth'
export type CheckType   = 'project' | 'generation'

// ── Helper: map limiter type → Ratelimit instance ────────────────────────────

function getLimiter(type: LimiterType): Ratelimit | null {
  switch (type) {
    case 'general': return generalAPILimiter
    case 'ai':      return aiEndpointLimiter
    case 'upload':  return fileUploadLimiter
    case 'auth':    return authEndpointLimiter
  }
}

// ── Helper: extract client IP ─────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

// ── Error response builders ───────────────────────────────────────────────────

function rateLimitResponse(err: RateLimitError): NextResponse {
  return NextResponse.json(
    {
      error: {
        code:       'RATE_LIMIT_EXCEEDED',
        message:    err.message,
        retryable:  true,
        retryAfter: err.retryAfter,
      },
    },
    {
      status: 429,
      headers: { 'Retry-After': String(err.retryAfter) },
    },
  )
}

function planLimitResponse(err: PlanLimitError): NextResponse {
  return NextResponse.json(
    {
      error: {
        code:       'PLAN_LIMIT_REACHED',
        message:    err.message,
        retryable:  false,
        upgradeUrl: err.upgradeUrl,
      },
    },
    { status: 403 },
  )
}

// ── withRateLimit ─────────────────────────────────────────────────────────────

/**
 * Wraps any route handler with rate limiting.
 * - `auth` limiter type → identifies by client IP
 * - all other types    → identifies by Clerk userId (falls back to IP)
 */
export function withRateLimit<C = RouteCtx>(
  handler: RouteHandler<C>,
  limiterType: LimiterType,
): RouteHandler<C> {
  return async (req: NextRequest, ctx: C): Promise<NextResponse> => {
    try {
      let identifier: string
      if (limiterType === 'auth') {
        identifier = getClientIp(req)
      } else {
        const { userId } = await auth()
        identifier = userId ?? getClientIp(req)
      }
      await applyRateLimit(getLimiter(limiterType), identifier)
    } catch (err) {
      if (err instanceof RateLimitError) return rateLimitResponse(err)
      throw err
    }
    return handler(req, ctx)
  }
}

// ── withAuth ──────────────────────────────────────────────────────────────────

/**
 * Wraps an authed handler: resolves the DB User and injects it as a third arg.
 * Returns 401 if unauthenticated.
 */
export function withAuth<C = RouteCtx>(
  handler: AuthedHandler<C>,
): RouteHandler<C> {
  return async (req: NextRequest, ctx: C): Promise<NextResponse> => {
    let user: User
    try {
      user = await requireAuth()
    } catch {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required', retryable: false } },
        { status: 401 },
      )
    }
    return handler(req, ctx, user)
  }
}

// ── withPlanCheck ─────────────────────────────────────────────────────────────

/**
 * Wraps an authed handler with a plan limit check.
 * Must be composed inside withAuth (receives User as third arg).
 */
export function withPlanCheck<C = RouteCtx>(
  handler: AuthedHandler<C>,
  checkType: CheckType,
): AuthedHandler<C> {
  return async (req: NextRequest, ctx: C, user: User): Promise<NextResponse> => {
    try {
      if (checkType === 'project') {
        await checkProjectLimit(user.id, user.plan)
      } else {
        await checkGenerationLimit(user.id, user.plan)
      }
    } catch (err) {
      if (err instanceof PlanLimitError) return planLimitResponse(err)
      throw err
    }
    return handler(req, ctx, user)
  }
}
