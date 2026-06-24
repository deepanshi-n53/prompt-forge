import { describe, it, expect } from 'vitest'
import { CostMeter } from './cost-estimator'

// Price 1M input + 1M output tokens so the metered cents equal the model's
// per-1M input + output rate directly (gpt-4o-mini = 15 + 60 = 75¢; gpt-4o = 1250¢).
function centsFor(model: string): number {
  const meter = new CostMeter()
  meter.meter({ usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, model } })
  return meter.runTotalCents
}

describe('cost meter — model pricing normalization', () => {
  it('prices the exact base model', () => {
    expect(centsFor('gpt-4o-mini')).toBeCloseTo(75)
    expect(centsFor('gpt-4o')).toBeCloseTo(1250)
  })

  it('prices a dated gpt-4o-mini snapshot at gpt-4o-mini rates (not gpt-4o)', () => {
    // The bug: "gpt-4o-mini-2024-07-18" missed the table and fell back to gpt-4o
    // (1250¢) — a ~16x overcount. It must resolve to gpt-4o-mini (75¢).
    expect(centsFor('gpt-4o-mini-2024-07-18')).toBeCloseTo(75)
  })

  it('prices a dated gpt-4o snapshot at gpt-4o rates', () => {
    expect(centsFor('gpt-4o-2024-08-06')).toBeCloseTo(1250)
  })

  it('prefers the most specific prefix (mini over 4o)', () => {
    // "gpt-4o-mini-…" starts with BOTH "gpt-4o" and "gpt-4o-mini"; the longer
    // (more specific) key must win.
    expect(centsFor('gpt-4o-mini-2099-01-01')).toBeCloseTo(75)
  })

  it('falls back to the default model for a genuinely unknown name', () => {
    expect(centsFor('some-unknown-model')).toBeCloseTo(1250)
  })
})
