'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Shown at the top of the setup screen when a previous generation failed or was
// cancelled (project.status === 'ERROR'). One-click retry re-fires generation
// from the decisions already captured — no need to re-answer the wizard.
export function RetryBanner({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function retry() {
    setRetrying(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/retry`, { method: 'POST' })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'Could not start generation. Please try again.')
        setRetrying(false)
        return
      }
      router.push(`/project/${projectId}/generating?jobId=${projectId}`)
    } catch {
      setError('Network error. Please try again.')
      setRetrying(false)
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-red-500" />
          <p className="text-sm font-medium text-red-800">
            Previous generation failed or was cancelled.
          </p>
        </div>
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {retrying ? 'Starting…' : 'Retry generation →'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
