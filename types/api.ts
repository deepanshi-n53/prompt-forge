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

export type JobStatus = 'pending' | 'running' | 'complete' | 'failed' | 'paused'

export interface PauseOption {
  value:       string
  label:       string
  description: string
}

export type PauseInputType = 'select' | 'multiselect' | 'text'

export interface PauseQuestion {
  field:        string
  sectionNum:   string
  sectionName?: string
  question:     string
  subtitle?:    string
  inputType?:   PauseInputType
  options:      PauseOption[]
  defaultValue: string
}

export interface JobProgress {
  status:         JobStatus
  percent:        number
  message:        string
  step:           string
  result?:        unknown
  error?:         string
  pauseQuestion?: PauseQuestion
}
