// Post-generation consistency check.
//
// A pure function (no AI, no I/O) that cross-references the locked decisions
// against the generated section contents and reports problems. It's purely
// diagnostic — the orchestrator surfaces the results but does NOT block on them.
//
// Three problem classes:
//   - contradiction:   a section mentions a value that conflicts with a locked
//                       decision (e.g. dbEngine=PostgreSQL but a section says MongoDB).
//   - unfilled-blank:  a section still contains an unfilled ___ placeholder.
//   - missing-section: an expected section produced no content.

export type ConsistencyProblemType = 'contradiction' | 'unfilled-blank' | 'missing-section'

export interface ConsistencyProblem {
  type:        ConsistencyProblemType
  sectionNum?: string
  field?:      string
  locked?:     string
  conflicting?: string
  message:     string
}

export interface ConsistencyInput {
  // Flat locked-decisions map (field → canonical value), as the orchestrator
  // accumulates it across sections.
  lockedDecisions:  Record<string, string>
  // sectionNum → generated content.
  sections:         Record<string, string>
  // Every section number that was expected to be generated this run.
  expectedSections: string[]
}

// ── conflict registry ─────────────────────────────────────────────────────────
// For each decision field we track every possible value and a regex that detects
// a real mention of it in section prose. When a field is locked to one value, a
// match for ANY of the other values in that field is a contradiction.
//
// REST is matched case-sensitively (uppercase) so plain English "the rest of …"
// doesn't trip a false positive; the rest are case-insensitive.

interface FieldValue {
  value:    string
  detector: RegExp
}

const CONFLICT_REGISTRY: Record<string, FieldValue[]> = {
  dbEngine: [
    { value: 'PostgreSQL', detector: /\bpostgres(?:ql)?\b/i },
    { value: 'MySQL',      detector: /\bmysql\b/i },
    { value: 'MongoDB',    detector: /\bmongo(?:db)?\b/i },
    { value: 'SQLite',     detector: /\bsqlite\b/i },
  ],
  authMethod: [
    { value: 'JWT',           detector: /\bjwt\b|json web tokens?/i },
    { value: 'sessions',      detector: /\bsessions?\b|session[- ]based/i },
    { value: 'opaque-tokens', detector: /\bopaque tokens?\b/i },
  ],
  paymentProvider: [
    { value: 'Stripe',   detector: /\bstripe\b/i },
    { value: 'Razorpay', detector: /\brazorpay\b/i },
    { value: 'PayPal',   detector: /\bpaypal\b/i },
  ],
  apiStyle: [
    { value: 'REST',    detector: /\bREST(?:ful)?\b/ },
    { value: 'GraphQL', detector: /\bgraphql\b/i },
    { value: 'tRPC',    detector: /\btrpc\b/i },
  ],
  cloudProvider: [
    { value: 'AWS',     detector: /\baws\b|amazon web services/i },
    { value: 'GCP',     detector: /\bgcp\b|google cloud/i },
    { value: 'Azure',   detector: /\bazure\b/i },
    { value: 'Vercel',  detector: /\bvercel\b/i },
    { value: 'Railway', detector: /\brailway\b/i },
  ],
}

// Resolve a locked value (any casing) to the canonical FieldValue for a field.
function resolveLocked(field: string, lockedValue: string): FieldValue | null {
  const values = CONFLICT_REGISTRY[field]
  if (!values) return null
  const lower = lockedValue.trim().toLowerCase()
  return values.find((v) => v.value.toLowerCase() === lower) ?? null
}

// ── checks ────────────────────────────────────────────────────────────────────

function checkContradictions(input: ConsistencyInput): ConsistencyProblem[] {
  const problems: ConsistencyProblem[] = []

  for (const field of Object.keys(CONFLICT_REGISTRY)) {
    const lockedValue = input.lockedDecisions[field]
    if (!lockedValue) continue

    const locked = resolveLocked(field, lockedValue)
    if (!locked) continue // locked to something we don't track (e.g. "none")

    const conflicts = CONFLICT_REGISTRY[field].filter((v) => v.value !== locked.value)

    for (const [sectionNum, content] of Object.entries(input.sections)) {
      if (!content) continue
      for (const candidate of conflicts) {
        if (candidate.detector.test(content)) {
          problems.push({
            type:        'contradiction',
            sectionNum,
            field,
            locked:      locked.value,
            conflicting: candidate.value,
            message:
              `§${sectionNum} mentions ${candidate.value} but ${field} is locked to ${locked.value}.`,
          })
        }
      }
    }
  }

  return problems
}

const BLANK_PATTERN = /_{3,}/g

function checkUnfilledBlanks(input: ConsistencyInput): ConsistencyProblem[] {
  const problems: ConsistencyProblem[] = []

  for (const [sectionNum, content] of Object.entries(input.sections)) {
    if (!content) continue
    const matches = content.match(BLANK_PATTERN)
    if (matches && matches.length > 0) {
      problems.push({
        type:       'unfilled-blank',
        sectionNum,
        message:    `§${sectionNum} has ${matches.length} unfilled blank${matches.length === 1 ? '' : 's'} (___).`,
      })
    }
  }

  return problems
}

function checkMissingSections(input: ConsistencyInput): ConsistencyProblem[] {
  const problems: ConsistencyProblem[] = []

  for (const sectionNum of input.expectedSections) {
    const content = input.sections[sectionNum]
    if (content == null || content.trim() === '') {
      problems.push({
        type:       'missing-section',
        sectionNum,
        message:    `§${sectionNum} was expected but produced no content.`,
      })
    }
  }

  return problems
}

// ── public API ────────────────────────────────────────────────────────────────

export function checkConsistency(input: ConsistencyInput): ConsistencyProblem[] {
  return [
    ...checkMissingSections(input),
    ...checkContradictions(input),
    ...checkUnfilledBlanks(input),
  ]
}
