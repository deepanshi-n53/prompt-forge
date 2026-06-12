export interface APIError {
  code: string
  message: string
  retryable: boolean
  retryAfter?: number
}

export interface APIResponse<T> {
  data: T
  error?: APIError
}

export type JobStatus = 'pending' | 'running' | 'complete' | 'failed'

export interface JobProgress {
  status: JobStatus
  percent: number
  message: string
  step: string
  result?: unknown
  error?: string
}
