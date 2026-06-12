import Link from 'next/link'
import { SignUpButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'About — PromptForge',
  description:
    'Why we built PromptForge — the story behind turning messy BRDs into production-ready AI architecture prompts.',
}

// ── Data ──────────────────────────────────────────────────────────────────────

const VALUES = [
  {
    title: 'Transparency over black boxes',
    body: 'Every architecture decision PromptForge generates comes with a confidence score and explicit assumptions. You should always know what was inferred vs. what came from your BRD — and be able to override it.',
  },
  {
    title: 'Context is the product',
    body: "AI coding agents don't fail because they're stupid. They fail because the developer gave them garbage context. Our job is to make that context excellent, consistent, and complete.",
  },
  {
    title: 'Fast Track ships, Full Track scales',
    body: 'Not every app needs 55 architecture sections on day one. We give you a Fast Track for MVPs and a Full Track for production systems — because shipping matters as much as correctness.',
  },
]

const TIMELINE = [
  {
    period: 'The frustration',
    body: "After the third time an agency rebuilt a client's feature set because the AI agent had lost context by section 8, it became clear the problem wasn't the AI — it was the missing infrastructure for feeding requirements into it consistently.",
  },
  {
    period: 'The insight',
    body: 'Architecture prompts for AI coding agents are a structured problem. There are roughly 55 discrete decisions every production SaaS needs made before coding starts — authentication model, database schema, API design, real-time strategy, and so on. These decisions are learnable, cross-referenceable, and computable from a BRD.',
  },
  {
    period: 'The build',
    body: 'We mapped every major SaaS archetype — Marketplace, B2B SaaS, AI Tool, social platform, mobile app — to the subset of sections that matter, wrote real section prompts from production architecture experience, and built a confidence-scoring pipeline on top of Claude.',
  },
  {
    period: 'Today',
    body: 'PromptForge is in early access. Development agencies use it to save 2 days per new client project. Solo developers use it to go from idea to scaffolded architecture in an afternoon. We\'re iterating fast based on real BRDs and real projects.',
  },
]

// ── Sections ──────────────────────────────────────────────────────────────────

function PageHero() {
  return (
    <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          About PromptForge
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
          We built the tool we needed before every client project.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-500">
          AI coding agents are powerful. But they're only as good as the context you give them.
          PromptForge exists to make that context excellent — structured, confident, and complete
          — before you write a single line of code.
        </p>
      </div>
    </section>
  )
}

function ProblemStory() {
  return (
    <section className="bg-zinc-50 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h2 className="text-2xl font-bold text-zinc-900">The problem we kept hitting</h2>
        <div className="prose prose-zinc max-w-none text-zinc-600 text-base leading-relaxed space-y-4">
          <p>
            Every serious software project starts with a BRD — or something that vaguely resembles
            one. A client email. A Notion doc. A 10-slide deck. A voice memo transcription.
          </p>
          <p>
            When AI coding agents arrived, the dream was obvious: upload your requirements and build
            the software. The reality was messier. A vague BRD fed into Claude Code produced vague
            code. The agent picked the wrong authentication pattern. It skipped rate limiting. It
            assumed a single-tenant model when the product needed multi-tenancy. By the time the
            scaffolding was wrong, the rebuild cost more than starting from scratch.
          </p>
          <p>
            The problem wasn't the AI. The problem was that nobody had given the AI a properly
            structured architecture context to work from.
          </p>
          <p>
            The second problem was consistency. A 55-section architecture document is too big to paste
            into a single conversation. Developers would reference section 7 in a new conversation
            and the agent would re-derive decisions that contradicted section 2. Context drift killed
            projects.
          </p>
          <p>
            And the third problem was change. When a client updated their requirements — as they
            always do — developers had no way to know which of their 55 generated sections needed
            re-running. Without impact analysis, the safe choice was to start over.
          </p>
        </div>
      </div>
    </section>
  )
}

function Solution() {
  return (
    <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h2 className="text-2xl font-bold text-zinc-900">What PromptForge does differently</h2>
        <div className="prose prose-zinc max-w-none text-zinc-600 text-base leading-relaxed space-y-4">
          <p>
            PromptForge doesn't generate architecture by asking the AI to free-form it from a BRD.
            It uses a structured system of{' '}
            <strong className="text-zinc-800">55 architecture sections</strong>, each representing
            one discrete decision a production SaaS must make: authentication model, database schema,
            API design, caching strategy, real-time architecture, compliance posture, and so on.
          </p>
          <p>
            Each section has a prompt template — refined from real production architecture patterns
            — and an explicit agent hint that tells Claude exactly what to output. The result isn't
            a generic AI response. It's a structured, filled template with named fields, concrete
            values, and cross-references to other sections.
          </p>
          <p>
            <strong className="text-zinc-800">Confidence scoring</strong> is first-class. When
            PromptForge fills a field from explicit BRD content, confidence is high. When it infers
            from signals, confidence is medium. When it makes an assumption, confidence is low — and
            the assumption is surfaced for review. You always know what the AI guessed vs. what you
            told it.
          </p>
          <p>
            <strong className="text-zinc-800">Change management</strong> is built in from the start.
            Upload a revised BRD and PromptForge runs a diff against the current architecture.
            Sections are classified as BREAKING (must re-generate), REVIEW (may have changed), or
            SAFE (unaffected). Only the affected sections are re-generated — saving time and
            preserving the decisions you've already validated.
          </p>
        </div>
      </div>
    </section>
  )
}

function StoryTimeline() {
  return (
    <section className="bg-zinc-900 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-12 text-2xl font-bold text-white">How we got here</h2>
        <div className="relative space-y-0">
          {/* vertical line */}
          <div
            aria-hidden
            className="absolute left-3 top-2 bottom-2 w-px bg-zinc-700"
          />
          {TIMELINE.map(({ period, body }, i) => (
            <div key={i} className="relative pl-10 pb-10 last:pb-0">
              {/* dot */}
              <div className="absolute left-0 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                {period}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-300">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ValuesSection() {
  return (
    <section className="bg-zinc-50 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-10 text-center text-2xl font-bold text-zinc-900">What we believe</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {VALUES.map(({ title, body }) => (
            <div key={title} className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-3 shadow-sm">
              <h3 className="font-semibold text-zinc-900">{title}</h3>
              <p className="text-sm leading-relaxed text-zinc-500">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function WhoItIsFor() {
  return (
    <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h2 className="text-2xl font-bold text-zinc-900">Who PromptForge is for</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            {
              who: 'Development agencies',
              need: 'You onboard a new client project every few weeks. The BRD is always different; the architecture setup work is always the same. PromptForge makes the architecture work fast, consistent, and reviewable by the client before a line of code ships.',
            },
            {
              who: 'Solo developers',
              need: "You're building in public or shipping a side project to production. You know what you want to build but not how to structure the architecture context for Claude Code. PromptForge turns your idea into a complete architecture package in an afternoon.",
            },
            {
              who: 'Product engineers at startups',
              need: "Your founder gives you a Notion doc and asks for an MVP in two weeks. PromptForge turns that doc into structured architecture decisions — with assumptions flagged — so you're aligned before you start coding.",
            },
            {
              who: 'CTOs reviewing AI-generated code',
              need: "You need confidence that the AI coding agent had good context before it generated the codebase. PromptForge's confidence scores and surfaced assumptions give you an audit trail of what the AI knew and what it guessed.",
            },
          ].map(({ who, need }) => (
            <div
              key={who}
              className="rounded-xl border border-zinc-100 bg-zinc-50 p-5 space-y-2"
            >
              <h3 className="text-sm font-semibold text-zinc-900">{who}</h3>
              <p className="text-sm leading-relaxed text-zinc-500">{need}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function AboutCTA() {
  return (
    <section className="bg-zinc-900 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <h2 className="text-3xl font-bold text-white">Try it on your next project</h2>
        <p className="text-zinc-400">
          Free plan. No credit card. Upload your BRD and get 55 architecture prompts in minutes.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <SignUpButton mode="redirect">
            <Button size="lg" className="px-8 bg-white text-zinc-900 hover:bg-zinc-100">
              Start for free
            </Button>
          </SignUpButton>
          <Link
            href="/pricing"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'px-8 border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:text-white',
            )}
          >
            View pricing
          </Link>
        </div>
      </div>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <>
      <PageHero />
      <ProblemStory />
      <Solution />
      <StoryTimeline />
      <ValuesSection />
      <WhoItIsFor />
      <AboutCTA />
    </>
  )
}
