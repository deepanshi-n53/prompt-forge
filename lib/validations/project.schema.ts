import { z } from 'zod'
import { Track } from '@prisma/client'

export const createProjectSchema = z.object({
  name:        z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  // orgId intentionally omitted — resolved from JWT claims, never from client body
})

export const updateProjectSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  track:       z.nativeEnum(Track).optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
