PROJECT: PromptForge
DESCRIPTION: AI-powered SaaS platform that converts Business Requirement Documents (BRDs)
into production-ready architecture prompts for AI coding agents (Claude Code, Cursor, Lovable, Bolt).
The platform parses any quality BRD, detects app archetype, infers decisions with confidence scoring,
asks 5 targeted questions, generates 55 filled architecture prompts, and tracks changes over time
with surgical delta regeneration.

TECH STACK:
- Frontend: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- State: TanStack Query v5 (server), Zustand (client), React Hook Form + Zod (forms)
- Backend: Next.js API Routes (monolith MVP)
- ORM: Prisma 5.x
- Database: PostgreSQL via Supabase
- File Storage: Supabase Storage (private bucket 'brds', signed URLs for download)
- Cache / Rate Limit: Upstash Redis (REST API, free tier)
- AI: OpenAI GPT-4o (production) / Ollama llama3.1:8b (local development) / Anthropic claude-sonnet-4-6 (optional fallback)
- Background Jobs: Inngest (serverless-native, free tier)
- Auth: Clerk (JWT, social login, org support)
- Payments: Stripe (subscriptions)
- Email: Nodemailer (SMTP via Gmail or Brevo — no third-party SDK)
- Error Tracking: Sentry (optional, free tier)
- Analytics: PostHog (optional, free tier)
- Deployment: Railway

ARCHITECTURE DECISIONS:
- Auth model: Clerk JWT (stateless)
- Multi-tenancy: Row-level isolation by orgId (from JWT claims)
- DB engine: PostgreSQL (Supabase) with JSONB for decision graphs
- Prisma datasource: uses DATABASE_URL (pooled port 6543) and DIRECT_URL (port 5432)
- API style: REST with Zod validation
- Background jobs: Inngest (async AI processing — avoids Railway timeout on long Claude calls)
- File upload: Direct to Supabase Storage via API route (Railway has no body size limit)
- Real-time: Server-Sent Events (SSE) for job progress, polling fallback
- Email: Nodemailer with inline HTML templates

PLANS:
- FREE: 1 project, 3 generations/month
- PROFESSIONAL: $49/mo, 5 projects, 30 generations/month
- AGENCY: $199/mo, unlimited projects, 200 generations/month, 5 seats
- ENTERPRISE: $999/mo, unlimited everything, SSO

FOLDER STRUCTURE:
promptforge/
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx
│   │   ├── pricing/
│   │   ├── sign-in/
│   │   ├── sign-up/
│   │   └── layout.tsx
│   ├── (app)/
│   │   ├── dashboard/
│   │   ├── project/[id]/
│   │   │   ├── page.tsx
│   │   │   ├── prompts/
│   │   │   ├── changes/
│   │   │   ├── setup/
│   │   │   ├── generating/
│   │   │   └── settings/
│   │   ├── account/
│   │   │   ├── billing/
│   │   │   └── privacy/
│   │   ├── onboarding/
│   │   └── layout.tsx
│   ├── api/
│   │   ├── brd/
│   │   │   ├── upload/
│   │   │   └── health/[id]/
│   │   ├── projects/
│   │   │   └── [id]/
│   │   │       ├── answers/
│   │   │       └── suggestions/
│   │   ├── prompts/[projectId]/
│   │   ├── changes/
│   │   ├── billing/
│   │   │   ├── checkout/
│   │   │   └── portal/
│   │   ├── jobs/[jobId]/
│   │   │   └── stream/
│   │   ├── webhooks/
│   │   │   ├── clerk/
│   │   │   └── stripe/
│   │   ├── inngest/
│   │   └── health/
│   └── layout.tsx
├── components/
│   ├── ui/
│   ├── brd/
│   │   ├── BRDUploader.tsx
│   │   ├── HealthScore.tsx
│   │   ├── AssumptionCard.tsx
│   │   └── SuggestionPanel.tsx
│   ├── prompts/
│   │   ├── PromptSection.tsx
│   │   ├── PromptExporter.tsx
│   │   └── ChangeImpact.tsx
│   └── shared/
│       ├── Sidebar.tsx
│       ├── ProjectCard.tsx
│       ├── UpgradeModal.tsx
│       ├── JobProgressBar.tsx
│       ├── ErrorBoundary.tsx
│       └── CookieConsent.tsx
├── lib/
│   ├── ai/
│   │   ├── brd-parser.ts
│   │   ├── archetype-detector.ts
│   │   ├── health-scorer.ts
│   │   ├── prompt-generator.ts
│   │   ├── change-detector.ts
│   │   ├── decision-builder.ts
│   │   └── suggestion-engine.ts
│   ├── db/
│   │   └── prisma.ts
│   ├── storage/
│   │   └── supabase-storage.ts
│   ├── stripe/
│   │   └── stripe.ts
│   ├── email/
│   │   ├── mailer.ts
│   │   ├── index.ts
│   │   └── templates/
│   │       ├── welcome.ts
│   │       ├── prompts-ready.ts
│   │       ├── change-detected.ts
│   │       └── payment-failed.ts
│   ├── auth.ts
│   ├── rate-limit.ts
│   ├── plan-limits.ts
│   ├── analytics.ts
│   ├── logger.ts
│   └── validations/
│       ├── brd.schema.ts
│       ├── project.schema.ts
│       ├── answer.schema.ts
│       └── change.schema.ts
├── inngest/
│   ├── client.ts
│   ├── parse-brd.ts
│   ├── generate-prompts.ts
│   ├── detect-changes.ts
│   ├── generate-delta-prompts.ts
│   └── gdpr-deletion.ts
├── hooks/
│   └── useJobProgress.ts
├── prisma/
│   └── schema.prisma
├── types/
│   ├── brd.ts
│   ├── decision.ts
│   ├── project.ts
│   ├── api.ts
│   └── index.ts
├── middleware.ts
├── railway.json
└── next.config.js

ENV VARIABLES:
- DATABASE_URL — Supabase pooled connection (port 6543, pgbouncer=true)
- DIRECT_URL — Supabase direct connection (port 5432, for migrations)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY — server-side storage operations
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
- CLERK_SECRET_KEY
- CLERK_WEBHOOK_SECRET
- ANTHROPIC_API_KEY
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- STRIPE_PRO_PRICE_ID, STRIPE_AGENCY_PRICE_ID, STRIPE_ENTERPRISE_PRICE_ID
- INNGEST_SIGNING_KEY, INNGEST_EVENT_KEY
- EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
- NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST (optional)
- SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN (optional)
- NEXT_PUBLIC_APP_URL
- NODE_ENV