import Link from 'next/link'
import { SignUpButton } from '@clerk/nextjs'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  FileText,
  BarChart3,
  Search,
  Shield,
  GitMerge,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'

export const metadata = {
  title: 'PromptForge — Upload Your BRD. Get Production-Ready Architecture.',
  description:
    'PromptForge converts any business requirement document into 55 filled architecture prompts ready for Claude Code, Cursor, Lovable, and Bolt.',
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden bg-white px-4 pb-20 pt-16 sm:px-6 lg:px-8">
      {/* subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#f4f4f540_1px,transparent_1px),linear-gradient(to_bottom,#f4f4f540_1px,transparent_1px)] bg-[size:48px_48px]"
      />

      <div className="relative mx-auto max-w-4xl text-center">
        {/* badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-xs font-medium text-blue-700">
          <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500" />
          Now in early access — used by development agencies
        </div>

        {/* headline */}
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl">
          Upload Your BRD.{' '}
          <span className="text-blue-600">Get Production-Ready Architecture.</span>
        </h1>

        {/* subheadline */}
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-500">
          PromptForge converts any business requirement document — even a 2-sentence idea — into{' '}
          <strong className="text-zinc-700">55 filled architecture prompts</strong> ready for Claude
          Code, Cursor, or Lovable.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <SignUpButton mode="redirect">
            <Button size="lg" className="w-full sm:w-auto px-8">
              Start Free
            </Button>
          </SignUpButton>
          <a
            href="#how-it-works"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'w-full sm:w-auto px-8',
            )}
          >
            See How It Works
          </a>
        </div>

        {/* trust signal */}
        <p className="mt-6 text-sm text-zinc-400">
          Used by development agencies to save{' '}
          <span className="font-semibold text-zinc-600">2 days per project</span>
        </p>
      </div>

      {/* mock UI preview */}
      <div className="relative mx-auto mt-16 max-w-3xl">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-200/50">
          {/* window chrome */}
          <div className="flex items-center gap-1.5 border-b border-zinc-100 bg-zinc-50 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-green-400" />
            <span className="ml-3 text-xs font-medium text-zinc-400">
              PromptForge — Project Dashboard
            </span>
          </div>
          {/* three-col layout */}
          <div className="grid grid-cols-3 divide-x divide-zinc-100">
            {/* col 1 — BRD */}
            <div className="p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">BRD</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
                  <FileText className="size-4 shrink-0 text-blue-500" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-zinc-900">product-spec.pdf</p>
                    <p className="text-[10px] text-zinc-400">Health: 87%</p>
                  </div>
                </div>
                <div className="h-8 rounded-lg bg-zinc-100 animate-pulse" />
              </div>
            </div>
            {/* col 2 — sections */}
            <div className="p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Sections</p>
              <div className="space-y-1.5">
                {['§01 Foundation', '§05 Architecture', '§06 Auth', '§07 Database', '§08 API'].map(
                  (s) => (
                    <div key={s} className="flex items-center gap-2 text-xs text-zinc-600">
                      <CheckCircle2 className="size-3 shrink-0 text-green-500" />
                      {s}
                    </div>
                  ),
                )}
                <p className="text-[10px] text-zinc-400 pt-1">+50 more sections</p>
              </div>
            </div>
            {/* col 3 — confidence */}
            <div className="p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Confidence
              </p>
              <div className="space-y-2">
                {[
                  { label: 'Overall', pct: 92 },
                  { label: 'Auth', pct: 95 },
                  { label: 'DB schema', pct: 88 },
                ].map(({ label, pct }) => (
                  <div key={label}>
                    <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                      <span>{label}</span>
                      <span className="font-medium text-zinc-700">{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* fade-out glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-6 bottom-0 h-24 bg-gradient-to-t from-white"
        />
      </div>
    </section>
  )
}

// ── Problem ───────────────────────────────────────────────────────────────────

const PAIN_POINTS = [
  {
    Icon: AlertTriangle,
    title: 'Vague BRDs produce garbage code',
    body: 'AI coding agents are only as good as their context. Vague requirements mean wrong assumptions, missing edge cases, and costly rebuilds before a line of useful code ships.',
  },
  {
    Icon: RefreshCw,
    title: 'Manual context management breaks at scale',
    body: "Pasting fragments into every conversation loses consistency. By section 10, the agent has forgotten the decisions you made in section 2 — and your architecture drifts.",
  },
  {
    Icon: GitMerge,
    title: 'Client changes break everything',
    body: "When requirements change, there's no way to know which of your 55 generated sections needs updating. Without impact analysis, you rebuild from scratch.",
  },
]

function ProblemSection() {
  return (
    <section className="bg-zinc-900 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            The problem
          </p>
          <h2 className="text-3xl font-bold text-white">
            Why most developers struggle with AI-assisted architecture
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {PAIN_POINTS.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="space-y-3 rounded-2xl border border-zinc-700 bg-zinc-800/50 p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                <Icon className="size-5 text-red-400" />
              </div>
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Solution / How it works ───────────────────────────────────────────────────

const STEPS = [
  {
    num: '01',
    title: 'Upload any BRD',
    body: 'Drag in a PDF, Word doc, or paste plain text. Even a 2-sentence product idea is enough to start — PromptForge fills the gaps with intelligent inference.',
    callout: 'Accepts PDF, DOCX, TXT · Up to 50 MB',
  },
  {
    num: '02',
    title: 'AI fills the gaps',
    body: "Claude parses your document, detects the product archetype, maps features to 55 architecture sections, and generates decisions — each with an explicit confidence score so you know what was inferred vs. stated.",
    callout: 'Confidence scored per section',
  },
  {
    num: '03',
    title: 'Get 55 ready-to-use prompts',
    body: 'Download a full architecture prompt package tailored to your chosen AI coding agent. Every section is filled, consistent, and cross-referenced — ready to paste and build.',
    callout: 'Claude Code · Cursor · Lovable · Bolt',
  },
]

function SolutionSection() {
  return (
    <section id="how-it-works" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            How it works
          </p>
          <h2 className="text-3xl font-bold text-zinc-900">
            From requirement to architecture in minutes
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STEPS.map(({ num, title, body, callout }) => (
            <div
              key={num}
              className="relative flex flex-col rounded-2xl border border-zinc-100 bg-zinc-50 p-6 shadow-sm"
            >
              <span className="mb-4 select-none text-5xl font-black leading-none text-zinc-100">
                {num}
              </span>
              <h3 className="mb-2 font-semibold text-zinc-900">{title}</h3>
              <p className="flex-1 text-sm leading-relaxed text-zinc-500">{body}</p>
              <p className="mt-4 text-xs font-medium text-blue-600">{callout}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Feature Cards ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    Icon: BarChart3,
    title: 'BRD Quality Scoring',
    body: "Every uploaded document receives a health score across 7 dimensions — functional clarity, NFRs, compliance hints, and more. Know exactly what's missing before generation starts.",
  },
  {
    Icon: Search,
    title: 'Archetype Detection',
    body: "PromptForge detects whether you're building a Marketplace, B2B SaaS, AI Tool, or social platform — and selects the right subset of the 55 sections automatically.",
  },
  {
    Icon: Shield,
    title: 'Confidence Transparency',
    body: 'Every generated decision is scored 0–100%. Low-confidence sections are flagged with the assumptions made so you can review and override before shipping.',
  },
  {
    Icon: GitMerge,
    title: 'Change Management',
    body: 'Upload a revised BRD or describe what changed. PromptForge detects which sections are BREAKING, REVIEW, or SAFE — and re-generates only the ones that need updating.',
  },
  {
    Icon: Download,
    title: 'Agent-Specific Export',
    body: 'Export your full architecture package in the exact format expected by Claude Code, Cursor, Lovable, or Bolt — one click, zero reformatting.',
  },
]

function FeaturesSection() {
  return (
    <section className="bg-zinc-50 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            What you get
          </p>
          <h2 className="text-3xl font-bold text-zinc-900">Every tool needed to ship with AI</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <Icon className="size-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-zinc-900">{title}</h3>
              <p className="text-sm leading-relaxed text-zinc-500">{body}</p>
            </div>
          ))}
          {/* 6th cell — inline CTA */}
          <div className="flex flex-col justify-between rounded-2xl border border-blue-200 bg-blue-600 p-6 shadow-sm">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">
                Ready to build?
              </p>
              <p className="text-xl font-bold leading-snug text-white">
                Get 55 prompts from your first BRD — free.
              </p>
            </div>
            <SignUpButton mode="redirect">
              <Button
                variant="secondary"
                size="sm"
                className="mt-6 w-full bg-white text-blue-700 hover:bg-blue-50"
              >
                Start Free
              </Button>
            </SignUpButton>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Testimonials ──────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote:
      '"PromptForge saved our agency two full days on every new client project. The confidence scoring alone changed how we review architecture before handing it to Claude Code."',
    name: 'Sarah K.',
    role: 'CTO, Digital Agency',
  },
  {
    quote:
      '"We went from a vague BRD to a fully scaffolded Next.js app in an afternoon. The change detection feature is genuinely magical when clients update requirements mid-sprint."',
    name: 'Marcus T.',
    role: 'Indie Developer',
  },
  {
    quote:
      '"The archetype detection caught that we were building a marketplace, not a SaaS. That alone redirected our entire data model before we wrote a single line of code."',
    name: 'Priya N.',
    role: 'Product Engineer',
  },
]

function TestimonialsSection() {
  return (
    <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            What people say
          </p>
          <h2 className="text-3xl font-bold text-zinc-900">
            Trusted by developers who ship fast
          </h2>
          <p className="mt-2 text-xs font-medium text-amber-600">[PLACEHOLDER — real testimonials pending]</p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map(({ quote, name, role }) => (
            <figure
              key={name}
              className="space-y-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-6"
            >
              <blockquote className="text-sm italic leading-relaxed text-zinc-600">
                {quote}
              </blockquote>
              <figcaption className="border-t border-zinc-100 pt-4">
                <p className="text-sm font-semibold text-zinc-900">[PLACEHOLDER] {name}</p>
                <p className="text-xs text-zinc-400">{role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Pricing Preview ───────────────────────────────────────────────────────────

const PLAN_STRIP = [
  { name: 'Free',       price: '$0',   detail: '1 project · 3 gen/mo',     highlight: false },
  { name: 'Pro',        price: '$49',  detail: '5 projects · 30 gen/mo',   highlight: true  },
  { name: 'Agency',     price: '$199', detail: 'Unlimited · 5 seats',      highlight: false },
  { name: 'Enterprise', price: '$999', detail: 'Unlimited · SSO + SLA',    highlight: false },
] as const

function PricingPreview() {
  return (
    <section className="bg-zinc-50 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8 text-center">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Pricing
          </p>
          <h2 className="text-3xl font-bold text-zinc-900">
            Start free, scale when you need to
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-500">
            The Free plan gives you 1 project and 3 generations per month. Upgrade to Pro ($49/mo)
            for unlimited change detection and all 4 agent formats.
          </p>
        </div>

        {/* plan strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PLAN_STRIP.map(({ name, price, detail, highlight }) => (
            <div
              key={name}
              className={cn(
                'rounded-xl border p-4 text-center',
                highlight ? 'border-blue-200 bg-blue-50' : 'border-zinc-200 bg-white',
              )}
            >
              <p
                className={cn(
                  'mb-1 text-xs font-semibold uppercase tracking-wide',
                  highlight ? 'text-blue-700' : 'text-zinc-500',
                )}
              >
                {name}
              </p>
              <p className={cn('text-2xl font-bold', highlight ? 'text-blue-700' : 'text-zinc-900')}>
                {price}
                {price !== '$0' && (
                  <span className="text-xs font-normal text-zinc-400">/mo</span>
                )}
              </p>
              <p className="mt-1 text-[10px] text-zinc-400">{detail}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/pricing" className={cn(buttonVariants({ size: 'lg' }), 'px-8')}>
            See all plans
          </Link>
          <SignUpButton mode="redirect">
            <Button variant="outline" size="lg" className="px-8">
              Start for free
            </Button>
          </SignUpButton>
        </div>
      </div>
    </section>
  )
}

// ── Final CTA ─────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="bg-zinc-900 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <h2 className="text-3xl font-bold text-white">
          Your next client project starts with a BRD upload.
        </h2>
        <p className="text-zinc-400">
          Free plan · No credit card required · Architecture prompts in minutes.
        </p>
        <SignUpButton mode="redirect">
          <Button size="lg" className="px-10 bg-white text-zinc-900 hover:bg-zinc-100">
            Start Free Today
          </Button>
        </SignUpButton>
      </div>
    </section>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <TestimonialsSection />
      <PricingPreview />
      <FinalCTA />
    </>
  )
}
