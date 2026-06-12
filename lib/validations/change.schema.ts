import { z } from 'zod'

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const

export const changeDetectSchema = z.object({
  projectId: z.string().min(1, 'projectId is required').max(36),
  mimeType:  z.enum(ALLOWED_MIME_TYPES, {
    error: 'Only PDF, DOCX, or plain-text files are accepted',
  }),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(52_428_800, 'File must be under 50 MB'),
})

export type ChangeDetectInput = z.infer<typeof changeDetectSchema>
