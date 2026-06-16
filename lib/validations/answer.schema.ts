import { z } from 'zod'

const answerValue = z.string().max(2000)

// q1–q5: core wizard answers (billing, region, timeline, sensitive data, scale)
// q6–q10: section-specific gap answers (deployment, multi-tenant, auth, db, mfa)
// Additional keys are allowed for mid-generation pause answers
export const answersSchema = z.object({
  q1:  answerValue.optional(),  // billing model
  q2:  answerValue.optional(),  // launch region
  q3:  answerValue.optional(),  // timeline → track
  q4:  answerValue.optional(),  // sensitive data (comma-separated or 'None')
  q5:  answerValue.optional(),  // year-1 user count
  q6:  answerValue.optional(),  // deployment target
  q7:  answerValue.optional(),  // multi-tenant
  q8:  answerValue.optional(),  // auth method
  q9:  answerValue.optional(),  // db preference
  q10: answerValue.optional(),  // MFA policy
}).catchall(answerValue.optional())

export type AnswersInput = z.infer<typeof answersSchema>
