import { describe, it, expect } from 'vitest'
import { checkConsistency, type ConsistencyInput } from './consistency-checker'

function makeInput(overrides: Partial<ConsistencyInput> = {}): ConsistencyInput {
  return {
    lockedDecisions:  {},
    sections:         {},
    expectedSections: [],
    ...overrides,
  }
}

describe('checkConsistency — contradictions', () => {
  it('flags a section that contradicts a locked dbEngine', () => {
    const problems = checkConsistency(makeInput({
      lockedDecisions:  { dbEngine: 'PostgreSQL' },
      sections:         { '07': 'We store records in MongoDB for flexibility.' },
      expectedSections: ['07'],
    }))
    const contradiction = problems.find((p) => p.type === 'contradiction')
    expect(contradiction).toBeDefined()
    expect(contradiction?.field).toBe('dbEngine')
    expect(contradiction?.locked).toBe('PostgreSQL')
    expect(contradiction?.conflicting).toBe('MongoDB')
    expect(contradiction?.sectionNum).toBe('07')
  })

  it('does NOT flag when the section uses the locked value', () => {
    const problems = checkConsistency(makeInput({
      lockedDecisions:  { dbEngine: 'PostgreSQL' },
      sections:         { '07': 'All data lives in PostgreSQL with row-level security.' },
      expectedSections: ['07'],
    }))
    expect(problems.some((p) => p.type === 'contradiction')).toBe(false)
  })

  it('covers authMethod, paymentProvider, apiStyle and cloudProvider', () => {
    const problems = checkConsistency(makeInput({
      lockedDecisions: {
        authMethod:      'JWT',
        paymentProvider: 'Stripe',
        apiStyle:        'REST',
        cloudProvider:   'AWS',
      },
      sections: {
        '06': 'Auth uses opaque tokens stored server-side.',
        '12': 'Checkout is handled by Razorpay.',
        '09': 'The API is built with GraphQL.',
        '02': 'Deployed to Azure App Service.',
      },
      expectedSections: ['02', '06', '09', '12'],
    }))
    const fields = problems
      .filter((p) => p.type === 'contradiction')
      .map((p) => p.field)
      .sort()
    expect(fields).toEqual(['apiStyle', 'authMethod', 'cloudProvider', 'paymentProvider'])
  })

  it('does not flag a field locked to an untracked value (e.g. "none")', () => {
    const problems = checkConsistency(makeInput({
      lockedDecisions:  { paymentProvider: 'none' },
      sections:         { '12': 'Payments via Stripe are out of scope for v1.' },
      expectedSections: ['12'],
    }))
    expect(problems.some((p) => p.type === 'contradiction')).toBe(false)
  })

  it('does not treat plain-English "rest" as a REST mention', () => {
    const problems = checkConsistency(makeInput({
      lockedDecisions:  { apiStyle: 'GraphQL' },
      sections:         { '09': 'The rest of the endpoints follow the same GraphQL schema.' },
      expectedSections: ['09'],
    }))
    expect(problems.some((p) => p.type === 'contradiction')).toBe(false)
  })
})

describe('checkConsistency — unfilled blanks', () => {
  it('flags remaining ___ placeholders', () => {
    const problems = checkConsistency(makeInput({
      sections:         { '01': 'The app name is ___ and it serves ___.' },
      expectedSections: ['01'],
    }))
    const blank = problems.find((p) => p.type === 'unfilled-blank')
    expect(blank).toBeDefined()
    expect(blank?.sectionNum).toBe('01')
    expect(blank?.message).toContain('2')
  })

  it('does not flag content with no blanks', () => {
    const problems = checkConsistency(makeInput({
      sections:         { '01': 'The app name is PawWalk and it serves dog owners.' },
      expectedSections: ['01'],
    }))
    expect(problems.some((p) => p.type === 'unfilled-blank')).toBe(false)
  })
})

describe('checkConsistency — missing sections', () => {
  it('flags an expected section with no content', () => {
    const problems = checkConsistency(makeInput({
      sections:         { '01': 'Present content.' },
      expectedSections: ['01', '02'],
    }))
    const missing = problems.filter((p) => p.type === 'missing-section')
    expect(missing).toHaveLength(1)
    expect(missing[0].sectionNum).toBe('02')
  })

  it('flags an expected section that is present but blank', () => {
    const problems = checkConsistency(makeInput({
      sections:         { '02': '   ' },
      expectedSections: ['02'],
    }))
    expect(problems.some((p) => p.type === 'missing-section' && p.sectionNum === '02')).toBe(true)
  })

  it('returns no problems for a fully consistent run', () => {
    const problems = checkConsistency(makeInput({
      lockedDecisions:  { dbEngine: 'PostgreSQL', authMethod: 'JWT' },
      sections: {
        '01': 'PawWalk is a dog-walking marketplace.',
        '07': 'Data is stored in PostgreSQL.',
        '06': 'Auth uses JWT bearer tokens.',
      },
      expectedSections: ['01', '06', '07'],
    }))
    expect(problems).toEqual([])
  })
})
