'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BRDUploader } from '@/components/brd/BRDUploader'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  hasActiveBrd: boolean
}

export function UploadBRDSection({ projectId, hasActiveBrd }: Props) {
  const router = useRouter()

  // Re-upload (an active BRD already exists) goes through the change-detection
  // flow on the Changes page: it diffs the new BRD against the current one and
  // regenerates ONLY the affected sections (generate-delta-prompts), instead of
  // re-running the first-upload path (full parse → setup wizard → full
  // generate-prompts). One clean flow on the existing project — no second upload
  // UI and no wizard restart.
  if (hasActiveBrd) {
    return (
      <Link
        href={`/project/${projectId}/changes`}
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
      >
        Upload New BRD
      </Link>
    )
  }

  // First upload: go to the wizard so the user can answer questions while the
  // BRD is parsed in the background.
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Upload Your BRD to Get Started</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Upload your Business Requirements Document to generate architecture prompts.
        </p>
      </div>
      <BRDUploader
        projectId={projectId}
        onProcessing={() => router.push(`/project/${projectId}/setup`)}
      />
    </div>
  )
}
