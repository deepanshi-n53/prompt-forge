'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BRDUploader } from '@/components/brd/BRDUploader'
import { Button } from '@/components/ui/button'

interface Props {
  projectId: string
  hasActiveBrd: boolean
}

export function UploadBRDSection({ projectId, hasActiveBrd }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  function handleProcessing() {
    if (hasActiveBrd) {
      // Re-upload: reload page so the new active BRD is reflected
      router.refresh()
    } else {
      // First upload: go to the wizard so the user can answer questions
      // while the BRD is parsed in the background
      router.push(`/project/${projectId}/setup`)
    }
  }

  if (hasActiveBrd) {
    return (
      <div className="space-y-3">
        {!open ? (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Upload New BRD
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">Upload New BRD</h3>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
            <BRDUploader projectId={projectId} onProcessing={handleProcessing} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Upload Your BRD to Get Started</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Upload your Business Requirements Document to generate architecture prompts.
        </p>
      </div>
      <BRDUploader projectId={projectId} onProcessing={handleProcessing} />
    </div>
  )
}
