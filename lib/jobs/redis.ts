import { Redis } from '@upstash/redis'
import type { JobProgress, PauseQuestion } from '@/types/api'

export type { PauseQuestion }

const JOB_TTL_SECONDS = 3600 // 1 hour

// ── Redis singleton ───────────────────────────────────────────────────────────

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
    console.warn('[jobs/redis] Redis init failed — job progress disabled', err)
    _redis = null
    return null
  }
}

// ── Stored shape (JobProgress + updatedAt timestamp) ─────────────────────────

export interface JobState extends JobProgress {
  updatedAt: number // epoch ms — used as SSE event id
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function setJobState(
  jobId: string,
  state: Omit<JobState, 'updatedAt'>,
): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  const value: JobState = { ...state, updatedAt: Date.now() }
  try {
    await redis.set(`job:${jobId}`, value, { ex: JOB_TTL_SECONDS })
  } catch (err) {
    console.warn('[jobs/redis] setJobState failed', err)
  }
}

export async function getJobState(jobId: string): Promise<JobState | null> {
  const redis = getRedis()
  if (!redis) return null

  try {
    return await redis.get<JobState>(`job:${jobId}`)
  } catch (err) {
    console.warn('[jobs/redis] getJobState failed', err)
    return null
  }
}

// Remove a job's state entirely — used by /cancel so a stale `paused`/`running`
// state can't re-surface a pause modal after the user backs out to setup.
export async function clearJobState(jobId: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await redis.del(`job:${jobId}`)
  } catch (err) {
    console.warn('[jobs/redis] clearJobState failed', err)
  }
}
