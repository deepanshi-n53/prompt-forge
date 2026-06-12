import { NextResponse } from 'next/server'
import { db } from '@/lib/db/prisma'
import { Redis } from '@upstash/redis'

export const dynamic = 'force-dynamic'

const VERSION = process.env.npm_package_version ?? '0.0.0'

async function checkDb(): Promise<'ok' | 'error'> {
  try {
    await db.$queryRaw`SELECT 1`
    return 'ok'
  } catch {
    return 'error'
  }
}

async function checkRedis(): Promise<'ok' | 'error'> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return 'error'
  }
  try {
    const redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    await redis.ping()
    return 'ok'
  } catch {
    return 'error'
  }
}

export async function GET() {
  const deadline = Date.now() + 450 // enforce < 500ms total

  const [dbStatus, redisStatus] = await Promise.all([
    Promise.race([
      checkDb(),
      new Promise<'error'>((resolve) =>
        setTimeout(() => resolve('error'), deadline - Date.now()),
      ),
    ]),
    Promise.race([
      checkRedis(),
      new Promise<'error'>((resolve) =>
        setTimeout(() => resolve('error'), deadline - Date.now()),
      ),
    ]),
  ])

  // DB down → error; Redis down → degraded (app still functions without it)
  const status =
    dbStatus === 'error'
      ? 'error'
      : redisStatus === 'error'
        ? 'degraded'
        : 'ok'

  const httpStatus = status === 'error' ? 503 : 200

  return NextResponse.json(
    {
      status,
      db:        dbStatus,
      redis:     redisStatus,
      timestamp: new Date().toISOString(),
      version:   VERSION,
    },
    { status: httpStatus },
  )
}
