'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function PrivacyActions() {
  const router = useRouter()
  const [deleteInput, setDeleteInput]   = useState('')
  const [deleting, setDeleting]         = useState(false)
  const [deleteError, setDeleteError]   = useState<string | null>(null)

  function handleExport() {
    window.location.href = '/api/account/data-export'
  }

  async function handleDelete() {
    if (deleteInput !== 'DELETE') return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/account/delete', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ confirmation: 'DELETE' }),
      })
      const data = await res.json() as { error?: string; scheduledFor?: string }
      if (!res.ok) {
        setDeleteError(data.error ?? 'Deletion request failed.')
        return
      }
      // Session revoked server-side — redirect to sign-in
      router.push('/sign-in?deleted=true')
    } catch {
      setDeleteError('An unexpected error occurred. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-10">
      {/* Data export */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-900 mb-1">Download your data</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Export a copy of all data PromptForge holds about you — your profile, projects, and
          generated prompts — as a JSON file.
        </p>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          Download my data
        </button>
      </section>

      <hr className="border-zinc-200" />

      {/* Account deletion */}
      <section>
        <h2 className="text-lg font-semibold text-red-700 mb-1">Delete account</h2>
        <p className="text-sm text-zinc-500 mb-2">
          Permanently delete your account and all associated data. This is irreversible after the
          30-day grace period.
        </p>
        <ul className="text-sm text-zinc-500 list-disc list-inside mb-4 space-y-1">
          <li>Your session will be revoked immediately</li>
          <li>All projects, BRDs, and prompts will be deleted in 30 days</li>
          <li>Any active Stripe subscription will be cancelled</li>
        </ul>
        <div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-3 max-w-md">
          <label className="block text-sm font-medium text-red-800">
            Type <strong>DELETE</strong> to confirm
          </label>
          <input
            type="text"
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
            placeholder="DELETE"
            className="block w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {deleteError && (
            <p className="text-sm text-red-700">{deleteError}</p>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteInput !== 'DELETE' || deleting}
            className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {deleting ? 'Scheduling deletion…' : 'Delete my account'}
          </button>
        </div>
      </section>
    </div>
  )
}
