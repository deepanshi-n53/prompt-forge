import { describe, it, expect } from 'vitest'
import {
  normalizeDecisions,
  applyAnswersToDecisions,
  emptyDecisions,
  mergeDecisionsPreferringPrior,
} from './brd-parser'

// A "prior" decision set as it exists after the user answered the setup wizard:
// gap answers are pinned to confidence 1.0 by applyAnswersToDecisions.
function priorWithAnswers() {
  return applyAnswersToDecisions(emptyDecisions(), {
    appName:     'PawWalk',
    dbEngine:    'PostgreSQL',
    multiTenant: 'true',
    userTypes:   'owners, walkers',
  })
}

describe('mergeDecisionsPreferringPrior — re-upload answer carry-forward', () => {
  it('keeps a prior user answer when the fresh parse only guesses a different value', () => {
    const prior = priorWithAnswers()
    // Fresh parse weakly guesses a different DB (low confidence).
    const fresh = normalizeDecisions({ dbEngine: 'MySQL', confidence: { dbEngine: 0.6 } })

    const merged = mergeDecisionsPreferringPrior(prior, fresh)
    expect(merged.dbEngine).toBe('PostgreSQL')        // prior answer (conf 1.0) wins
    expect(merged.confidence.dbEngine).toBe(1.0)
  })

  it('adopts the fresh value when the new BRD states it just as explicitly', () => {
    const prior = priorWithAnswers()
    const fresh = normalizeDecisions({ dbEngine: 'MongoDB', confidence: { dbEngine: 1.0 } })

    const merged = mergeDecisionsPreferringPrior(prior, fresh)
    expect(merged.dbEngine).toBe('MongoDB')           // BRD genuinely changed it
  })

  it('fills a never-answered field from the fresh parse', () => {
    const prior = priorWithAnswers()                  // never set cacheLayer
    const fresh = normalizeDecisions({ cacheLayer: 'Redis', confidence: { cacheLayer: 0.8 } })

    const merged = mergeDecisionsPreferringPrior(prior, fresh)
    expect(merged.cacheLayer).toBe('Redis')
  })

  it('does not wipe a prior answer when the fresh parse says nothing', () => {
    const prior = priorWithAnswers()
    const fresh = emptyDecisions()                    // fresh found nothing

    const merged = mergeDecisionsPreferringPrior(prior, fresh)
    expect(merged.appName).toBe('PawWalk')
    expect(merged.multiTenant).toBe(true)
    expect(merged.userTypes).toEqual(['owners', 'walkers'])
  })

  it('leaves an unchanged field (same value) on the prior, preserving its confidence', () => {
    const prior = priorWithAnswers()
    const fresh = normalizeDecisions({ dbEngine: 'PostgreSQL', confidence: { dbEngine: 0.6 } })

    const merged = mergeDecisionsPreferringPrior(prior, fresh)
    expect(merged.dbEngine).toBe('PostgreSQL')
    expect(merged.confidence.dbEngine).toBe(1.0)      // not downgraded to the fresh 0.6
  })
})
