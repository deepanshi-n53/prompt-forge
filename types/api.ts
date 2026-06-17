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

// One field inside a multi-question pause (e.g. the §20 compliance confirmation).
export interface PauseSubQuestion {
  field:        string
  question:     string
  inputType:    PauseInputType
  options:      PauseOption[]
  defaultValue: string
}

export interface PauseQuestion {
  field:        string
  sectionNum:   string
  sectionName?: string
  question:     string
  subtitle?:    string
  inputType?:   PauseInputType
  options:      PauseOption[]
  defaultValue: string
  // When present, this pause asks several fields at once; `field`/`options`/etc.
  // above are unused and the modal renders one input per sub-question.
  questions?:   PauseSubQuestion[]
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
