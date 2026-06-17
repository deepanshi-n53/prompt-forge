'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface PromptsLiveControlsProps {
  projectId:    string
  status:       string
  sectionCount: number
  lastUpdated:  string // ISO
}

const POLL_MS = 5_000

// Two jobs:
//  1. While the project is still PROCESSING, poll every 5s and refresh the server
//     component so newly-generated sections appear without a manual reload.
//  2. Render a collapsible debug panel (status / DB section count / last updated).
export function PromptsLiveControls({
  projectId,
  status,
  sectionCount,
  lastUpdated,
}: PromptsLiveControlsProps) {
  const router = useRouter()
  const [showDebug, setShowDebug] = useState(false)

  useEffect(() => {
    if (status !== 'PROCESSING') return
    const timer = setInterval(() => router.refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [status, router])

  return (
    <div className="fixed bottom-3 right-3 z-20 text-right">
      {showDebug && (
        <div className="mb-2 w-60 rounded-lg border border-zinc-200 bg-white p-3 text-left text-[11px] shadow-lg">
          <p className="mb-1 font-semibold text-zinc-700">Debug</p>
          <dl className="space-y-0.5 text-zinc-500">
            <div className="flex justify-between gap-2">
              <dt>Project ID</dt>
              <dd className="truncate font-mono text-zinc-700">{projectId}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Status</dt>
              <dd className="font-mono text-zinc-700">{status}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Sections in DB</dt>
              <dd className="font-mono text-zinc-700">{sectionCount}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Last updated</dt>
              <dd className="font-mono text-zinc-700">{new Date(lastUpdated).toLocaleString()}</dd>
            </div>
          </dl>
          {status === 'PROCESSING' && (
            <p className="mt-2 text-[10px] text-amber-600">Polling every 5s…</p>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setShowDebug((v) => !v)}
        className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-medium text-zinc-400 shadow-sm hover:text-zinc-700"
      >
        {showDebug ? 'Hide debug' : 'Debug'}
      </button>
    </div>
  )
}
