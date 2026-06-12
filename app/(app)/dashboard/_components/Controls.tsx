'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

// ── filter tabs ───────────────────────────────────────────────────────────────

const TABS = [
  { label: 'All', value: '' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Ready', value: 'READY' },
  { label: 'Error', value: 'ERROR' },
]

export function FilterTabs() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('status') ?? ''

  function setStatus(value: string) {
    const p = new URLSearchParams(searchParams.toString())
    if (value) p.set('status', value)
    else p.delete('status')
    p.delete('page')
    router.push(`/dashboard?${p.toString()}`)
  }

  return (
    <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => setStatus(tab.value)}
          className={[
            'rounded-md px-3 py-1 text-sm font-medium transition-colors',
            current === tab.value
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ── search input ──────────────────────────────────────────────────────────────

export function ProjectSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get('q') ?? '')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const p = new URLSearchParams(searchParams.toString())
      if (value.trim()) p.set('q', value.trim())
      else p.delete('q')
      p.delete('page')
      router.push(`/dashboard?${p.toString()}`)
    }, 350)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <Input
      type="search"
      placeholder="Search projects…"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-56"
    />
  )
}

// ── new project dialog ────────────────────────────────────────────────────────

export function NewProjectButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleCreate() {
    if (!name.trim()) { setError('Name is required'); return }
    setError('')

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
    })

    const data = (await res.json()) as { project?: { id: string }; code?: string; message?: string }

    if (!res.ok) {
      if (data.code === 'PLAN_LIMIT_REACHED') {
        setError('Free plan allows 1 project. Upgrade to create more.')
      } else {
        setError('Failed to create project. Please try again.')
      }
      return
    }

    startTransition(() => {
      setOpen(false)
      setName('')
      setDescription('')
      router.push(`/project/${data.project!.id}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        New project
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new project</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Project name <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="My SaaS App"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Description <span className="text-zinc-400">(optional)</span>
            </label>
            <Input
              placeholder="Brief description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button onClick={handleCreate} disabled={isPending}>
            {isPending ? 'Creating…' : 'Create project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
