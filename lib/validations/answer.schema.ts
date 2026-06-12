import { z } from 'zod'

export const answersSchema = z.object({
  q1: z.string().max(2000).optional(),
  q2: z.string().max(2000).optional(),
  q3: z.string().max(2000).optional(),
  q4: z.string().max(2000).optional(),
  q5: z.string().max(2000).optional(),
})

export type AnswersInput = z.infer<typeof answersSchema>
