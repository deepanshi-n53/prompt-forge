import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { parseBRDJob } from '@/inngest/parse-brd'
import { generatePromptsJob } from '@/inngest/generate-prompts'
import { detectChangesJob } from '@/inngest/detect-changes'
import { generateDeltaPromptsJob } from '@/inngest/generate-delta-prompts'
import { gdprDeletionJob } from '@/inngest/gdpr-deletion'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [parseBRDJob, generatePromptsJob, detectChangesJob, generateDeltaPromptsJob, gdprDeletionJob],
})
