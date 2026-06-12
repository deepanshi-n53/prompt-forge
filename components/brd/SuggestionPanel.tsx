'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Suggestion } from '@/lib/ai/suggestion-engine'

interface SuggestionPanelProps {
  projectId: string
}

interface SuggestionsResponse {
  suggestions: Suggestion[]
  archetype: string
  addedIds: string[]
}

const SECTION_NAMES: Record<string, string> = {
  '02': '§02 Functional Requirements',
  '06': '§06 Auth',
  '07': '§07 Database',
  '08': '§08 API Design',
  '09': '§09 Real-Time',
  '14': '§14 UI/UX',
  '17': '§17 Data Integrity',
  '19': '§19 Privacy',
  '20': '§20 Compliance',
}

function sectionLabel(num: string): string {
  return SECTION_NAMES[num] ?? `§${num}`
}

export function SuggestionPanel({ projectId }: SuggestionPanelProps) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'empty'; archetype: string }
    | { status: 'ready'; suggestions: Suggestion[]; archetype: string; addedIds: Set<string> }
    | { status: 'error' }
  >({ status: 'loading' })

  const [adding, setAdding] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  useEffect(() => {
    fetch(`/api/projects/${projectId}/suggestions`)
      .then((r) => r.json() as Promise<SuggestionsResponse>)
      .then(({ suggestions, archetype, addedIds }) => {
        if (suggestions.length === 0) {
          setState({ status: 'empty', archetype })
        } else {
          setState({
            status:    'ready',
            suggestions,
            archetype,
            addedIds:  new Set(addedIds),
          })
        }
      })
      .catch(() => setState({ status: 'error' }))
  }, [projectId])

  function handleAdd(suggestion: Suggestion) {
    if (adding.has(suggestion.id)) return

    setAdding((prev) => new Set([...prev, suggestion.id]))

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/suggestions/${suggestion.id}/add`,
          { method: 'POST' },
        )

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          toast.error(body.error ?? 'Failed to add suggestion')
          setAdding((prev) => {
            const next = new Set(prev)
            next.delete(suggestion.id)
            return next
          })
          return
        }

        // Persist the added state locally
        setState((prev) => {
          if (prev.status !== 'ready') return prev
          return {
            ...prev,
            addedIds: new Set([...prev.addedIds, suggestion.id]),
            // Filter out the added suggestion (it'll no longer appear)
            suggestions: prev.suggestions.filter((s) => s.id !== suggestion.id),
          }
        })

        toast.success(`"${suggestion.title}" added to your architecture`)
      } catch {
        toast.error('Network error — please try again')
        setAdding((prev) => {
          const next = new Set(prev)
          next.delete(suggestion.id)
          return next
        })
      }
    })
  }

  if (state.status === 'loading') {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-zinc-200 bg-zinc-50 animate-pulse" />
        ))}
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <p className="text-sm text-zinc-500">Could not load suggestions. Refresh to retry.</p>
    )
  }

  if (state.status === 'empty') {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center">
        <p className="text-sm font-medium text-zinc-700">All common features covered</p>
        <p className="mt-1 text-xs text-zinc-400">
          No additional suggestions for {state.archetype} apps.
        </p>
      </div>
    )
  }

  const { suggestions, archetype } = state

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">
          Commonly Missed for {archetype} Apps
        </h3>
        <Badge variant="secondary" className="text-xs">
          {suggestions.length}
        </Badge>
      </div>

      <ul className="space-y-3">
        {suggestions.map((s) => {
          const isAdding = adding.has(s.id)

          return (
            <li
              key={s.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{s.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">{s.description}</p>
                </div>
              </div>

              {/* Risk */}
              <div className="flex items-start gap-2">
                <span className="mt-px shrink-0 text-amber-500">⚠</span>
                <p className="text-xs text-amber-700 leading-relaxed">{s.risk}</p>
              </div>

              {/* Affected sections */}
              <div className="flex flex-wrap gap-1.5">
                {s.sections.map((num) => (
                  <span
                    key={num}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-600"
                  >
                    {sectionLabel(num)}
                  </span>
                ))}
              </div>

              {/* Action */}
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                disabled={isAdding}
                onClick={() => handleAdd(s)}
              >
                {isAdding ? 'Adding…' : 'Add to Architecture'}
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
