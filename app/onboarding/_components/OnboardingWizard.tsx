'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Upload, Zap, FileSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BRDUploader } from '@/components/brd/BRDUploader'
import type { Plan } from '@prisma/client'

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = ['Welcome', 'Create project', 'Upload BRD'] as const

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const num = i + 1
        const done = num < current
        const active = num === current
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  done
                    ? 'bg-green-500 text-white'
                    : active
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-400',
                ].join(' ')}
              >
                {done ? '✓' : num}
              </div>
              <span
                className={[
                  'text-[10px] font-medium whitespace-nowrap',
                  active ? 'text-zinc-900' : 'text-zinc-400',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={[
                  'mb-4 mx-2 h-px w-16 flex-shrink-0 transition-colors',
                  done ? 'bg-green-400' : 'bg-zinc-200',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1 — Welcome ──────────────────────────────────────────────────────────

const BULLETS = [
  { Icon: Upload,      text: 'Upload any BRD — PDF, Word doc, or even just a 2-sentence idea' },
  { Icon: FileSearch,  text: 'AI fills 55 architecture sections with confidence scoring on every decision' },
  { Icon: Zap,         text: 'Export to Claude Code, Cursor, Lovable, or Bolt — ready to paste and build' },
]

function StepWelcome({ userName, onNext }: { userName: string; onNext: () => void }) {
  return (
    <div className="space-y-6 text-center">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
          Step 1 of 3
        </p>
        <h1 className="text-3xl font-extrabold text-zinc-900">
          Welcome to PromptForge, {userName}!
        </h1>
        <p className="text-zinc-500">Here's what you'll be able to do:</p>
      </div>

      <ul className="space-y-3 text-left">
        {BULLETS.map(({ Icon, text }) => (
          <li
            key={text}
            className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm"
          >
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <Icon className="size-4 text-blue-600" />
            </div>
            <p className="text-sm leading-relaxed text-zinc-700">{text}</p>
          </li>
        ))}
      </ul>

      <Button size="lg" className="w-full" onClick={onNext}>
        Got it, let's go →
      </Button>
    </div>
  )
}

// ── Step 2 — Create project ───────────────────────────────────────────────────

const PLAN_COPY: Record<Plan, string> = {
  FREE:         "You're on FREE — 1 project, 3 generations/month",
  PROFESSIONAL: "You're on Pro — 5 projects, 30 generations/month",
  AGENCY:       "You're on Agency — unlimited projects, 200 generations/month",
  ENTERPRISE:   "You're on Enterprise — unlimited everything",
}

interface StepCreateProjectProps {
  name: string
  description: string
  plan: Plan
  busy: boolean
  onName: (v: string) => void
  onDescription: (v: string) => void
  onNext: () => void
}

function StepCreateProject({
  name, description, plan, busy, onName, onDescription, onNext,
}: StepCreateProjectProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
          Step 2 of 3
        </p>
        <h2 className="text-2xl font-bold text-zinc-900">Name your first project</h2>
        <p className="text-sm text-zinc-500">
          A project holds your BRD, architecture prompts, and change history.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-700" htmlFor="proj-name">
            Project name <span className="text-red-500">*</span>
          </label>
          <input
            id="proj-name"
            type="text"
            autoFocus
            value={name}
            onChange={(e) => onName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onNext() }}
            placeholder="e.g. Marketplace MVP, Client App 2024"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-700" htmlFor="proj-desc">
            Description{' '}
            <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <textarea
            id="proj-desc"
            rows={2}
            value={description}
            onChange={(e) => onDescription(e.target.value)}
            placeholder="One sentence about what you're building"
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* plan badge */}
      <div className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5">
        <span className="h-2 w-2 rounded-full bg-green-400" />
        <p className="text-xs font-medium text-zinc-600">{PLAN_COPY[plan]}</p>
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={!name.trim() || busy}
        onClick={onNext}
      >
        {busy ? 'Creating…' : 'Create project →'}
      </Button>
    </div>
  )
}

// ── Step 3 — Upload BRD ───────────────────────────────────────────────────────

interface StepUploadBRDProps {
  projectId: string
  ideaText: string
  uploadingText: boolean
  onIdeaText: (v: string) => void
  onFileProcessing: (jobId: string, brdId: string) => void
  onTextUpload: () => void
  onSkip: () => void
}

function StepUploadBRD({
  projectId, ideaText, uploadingText,
  onIdeaText, onFileProcessing, onTextUpload, onSkip,
}: StepUploadBRDProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
          Step 3 of 3
        </p>
        <h2 className="text-2xl font-bold text-zinc-900">Upload your BRD or describe your idea</h2>
        <p className="text-sm text-zinc-500">
          Drop in a file — or just tell us what you're building in plain text.
        </p>
      </div>

      {/* file upload */}
      <BRDUploader projectId={projectId} onProcessing={onFileProcessing} />

      {/* divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-zinc-200" />
        <span className="text-xs font-medium text-zinc-400">OR</span>
        <div className="flex-1 border-t border-zinc-200" />
      </div>

      {/* text idea input */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-700">
          Just describe what you're building…
        </label>
        <textarea
          rows={5}
          value={ideaText}
          onChange={(e) => onIdeaText(e.target.value)}
          placeholder="e.g. A two-sided marketplace where dog owners can find and book dog walkers. Walkers create profiles with photos and rates. Owners search by location and book with instant payment. Both sides get in-app messaging and reviews after each walk."
          className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

        <Button
          size="sm"
          className="w-full"
          disabled={!ideaText.trim() || uploadingText}
          onClick={onTextUpload}
        >
          {uploadingText ? 'Uploading…' : 'Analyse my idea →'}
        </Button>
      </div>

      {/* skip */}
      <div className="border-t border-zinc-100 pt-4 text-center">
        <button
          type="button"
          className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-600 transition-colors"
          onClick={onSkip}
        >
          Skip for now — go to dashboard
        </button>
      </div>
    </div>
  )
}

// ── Wizard shell ──────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  userName: string
  plan: Plan
}

export function OnboardingWizard({ userName, plan }: OnboardingWizardProps) {
  const router = useRouter()

  const [step, setStep]           = useState<1 | 2 | 3>(1)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [creating, setCreating]   = useState(false)
  const [ideaText, setIdeaText]   = useState('')
  const [uploadingText, setUploading] = useState(false)

  async function completeOnboarding() {
    await fetch('/api/onboarding/complete', { method: 'POST' })
  }

  // ── Step 2: create project ──────────────────────────────────────────────────
  async function handleCreateProject() {
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { message?: string; error?: string }
        toast.error(data.message ?? data.error ?? 'Failed to create project')
        return
      }

      const { project } = (await res.json()) as { project: { id: string } }
      setProjectId(project.id)

      // Mark onboarded now — user has committed. Prevents redirect loop on refresh.
      await completeOnboarding()
      setStep(3)
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setCreating(false)
    }
  }

  // ── Step 3: file upload complete ────────────────────────────────────────────
  function handleFileProcessing(jobId: string, _brdId: string) {
    if (!projectId) return
    router.push(`/project/${projectId}/generating?jobId=${jobId}&onboarding=1`)
  }

  // ── Step 3: text upload ─────────────────────────────────────────────────────
  async function handleTextUpload() {
    if (!ideaText.trim() || !projectId) return
    setUploading(true)
    try {
      const blob = new Blob([ideaText.trim()], { type: 'text/plain' })
      const file = new File([blob], 'my-idea.txt', { type: 'text/plain' })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', projectId)

      const res = await fetch('/api/brd/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        toast.error(data.error ?? 'Upload failed')
        return
      }

      const { jobId } = (await res.json()) as { jobId: string; brdId: string }
      router.push(`/project/${projectId}/generating?jobId=${jobId}&onboarding=1`)
    } catch {
      toast.error('Upload failed — please try again')
    } finally {
      setUploading(false)
    }
  }

  // ── Step 3: skip ───────────────────────────────────────────────────────────
  function handleSkip() {
    router.push('/dashboard')
  }

  return (
    <div className="space-y-8">
      {/* step indicator */}
      <div className="flex justify-center">
        <StepIndicator current={step} />
      </div>

      {/* card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        {step === 1 && (
          <StepWelcome userName={userName} onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <StepCreateProject
            name={name}
            description={description}
            plan={plan}
            busy={creating}
            onName={setName}
            onDescription={setDesc}
            onNext={handleCreateProject}
          />
        )}
        {step === 3 && projectId && (
          <StepUploadBRD
            projectId={projectId}
            ideaText={ideaText}
            uploadingText={uploadingText}
            onIdeaText={setIdeaText}
            onFileProcessing={handleFileProcessing}
            onTextUpload={handleTextUpload}
            onSkip={handleSkip}
          />
        )}
      </div>
    </div>
  )
}
