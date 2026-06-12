# PromptForge Launch Checklist

Status key:  ✅ Done · ⚠️ Needs action · 🔲 Not verified (requires live infra/manual test)

---

## STEP 1 — Infrastructure

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1.1 | Supabase production DB — run `npm run db:migrate` on Railway | ⚠️ | Requires `DATABASE_URL` + `DIRECT_URL` set in Railway. Schema ready; run `npx prisma migrate deploy` from CI (deploy.yml handles this) |
| 1.2 | Supabase Storage bucket `brds` — private, with signed-URL policy | ⚠️ | Create in Supabase dashboard → Storage → New bucket (`brds`, private). Code references this bucket in `lib/storage/supabase-storage.ts` |
| 1.3 | Upstash Redis — `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set | ⚠️ | Verified via `/api/health` endpoint. Set vars in Railway → shows `"redis":"ok"` |
| 1.4 | Clerk production instance — switch from test (`sk_test_…`) to live (`sk_live_…`) | ⚠️ | Update `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in Railway. **Rotate the test key exposed in chat** |
| 1.5 | Anthropic API key — production key set as `ANTHROPIC_API_KEY` | ⚠️ | Use a project-scoped key from console.anthropic.com |
| 1.6 | Stripe live mode — products + prices created, `STRIPE_PRICE_*` env vars set | ⚠️ | Create 3 products (Pro/Agency/Enterprise) in Stripe live mode. Set `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_AGENCY`, `STRIPE_PRICE_ENTERPRISE`, `STRIPE_SECRET_KEY` (live), `STRIPE_WEBHOOK_SECRET` |
| 1.7 | Inngest production functions deployed | ⚠️ | Deploy via `npx inngest-cli@latest deploy` or connect Railway to Inngest cloud. Set `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` |
| 1.8 | Railway project linked to GitHub repo (`main` branch → auto-deploy) | ⚠️ | Railway dashboard → New Project → Deploy from GitHub repo |
| 1.9 | All env vars set in Railway dashboard | ⚠️ | See full env var list at bottom of this file |
| 1.10 | Custom domain + SSL configured in Railway | ⚠️ | Railway → Settings → Domains. SSL is automatic |

---

## STEP 2 — Full User Journey

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.1 | Sign up → user created in DB | 🔲 | Clerk `user.created` webhook → `app/api/webhooks/clerk/route.ts` → `db.user.create`. Verify in Supabase table viewer |
| 2.2 | Upload BRD → Supabase Storage + Inngest triggered | 🔲 | Uploads to `brds/` bucket. `inngest.send('brd/uploaded')` fires |
| 2.3 | Health score shows after parsing | 🔲 | `calculateHealthScore()` in `lib/ai/health-scorer.ts` |
| 2.4 | Assumption cards with confidence levels | 🔲 | `components/brd/AssumptionCard.tsx` |
| 2.5 | Suggestions panel shows for archetype | 🔲 | `components/brd/SuggestionPanel.tsx` — fetches `/api/projects/[id]/suggestions` |
| 2.6 | 5-question flow saves answers | 🔲 | Wizard in `app/(app)/project/[id]/setup/_components/Wizard.tsx` |
| 2.7 | Prompts generate — all 57 sections | 🔲 | Inngest `generateSection` function; verify in DB + UI |
| 2.8 | Copy to clipboard works | 🔲 | Browser `navigator.clipboard.writeText` |
| 2.9 | Export modal — 3 format tabs | 🔲 | `components/prompts/PromptExporter.tsx` |
| 2.10 | Upload updated BRD → change detection | 🔲 | `app/api/changes/detect/route.ts` |
| 2.11 | Impact analysis shows BREAKING / REVIEW / SAFE | 🔲 | `app/(app)/project/[id]/changes/_components/ChangeManagement.tsx` |
| 2.12 | Delta prompts generate for BREAKING sections | 🔲 | `inngest/generate-delta-prompts.ts` |
| 2.13 | Stripe checkout → plan upgrades in DB | 🔲 | Webhook `checkout.session.completed` → `app/api/webhooks/stripe/route.ts` |
| 2.14 | Stripe portal (manage billing) works | 🔲 | `app/api/billing/portal/route.ts` |

---

## STEP 3 — Security

| # | Item | Status | Notes |
|---|------|--------|-------|
| 3.1 | `npm audit` — no high/critical vulnerabilities | ✅ | **0 high, 0 critical** (17 moderate, all in dev deps). Run `npm audit` to verify |
| 3.2 | `.env.local` in `.gitignore`, no secrets in git history | ✅ | `.gitignore` covers `.env*`. No commits yet — verify before first push with `git log --all` |
| 3.3 | **Rotate exposed Clerk secret key** `sk_test_inkuBaKRG55IzuY6aMzol9wHqrJqCNUY5lfMDULOuD` | ⚠️ | **CRITICAL** — this key appeared in the chat session. Rotate immediately at dashboard.clerk.com |
| 3.4 | **Rotate exposed Supabase service role key** | ⚠️ | **CRITICAL** — Supabase service key was shared in a prior session. Rotate at app.supabase.com |
| 3.5 | **Rotate exposed DB password** `Prompt@n53@123` | ⚠️ | **CRITICAL** — DB password was shared in a prior session. Change at Supabase → Settings → Database |
| 3.6 | All API routes return 401 with no token | ✅ | All 19 protected routes use `requireAuth()`. Clerk webhook uses `verifyWebhook()`. Stripe webhook uses `constructEvent()` |
| 3.7 | Cross-tenant isolation — user A cannot see user B's projects | ✅ | All `findFirst/findMany` queries include `ownerId: user.id`. 10/10 data routes verified |
| 3.8 | File upload rejects wrong MIME type | ✅ | `BRDUploader` validates client-side; `app/api/brd/upload/route.ts` validates server-side against allowlist |
| 3.9 | Rate limiting — 6th AI request in 1 min → 429 | 🔲 | Upstash rate limiter in API routes. Verify with curl loop against `/api/brd/upload` |

---

## STEP 4 — Legal

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.1 | Privacy Policy live at `/privacy` | ✅ | `app/(marketing)/privacy/page.tsx` created. Linked from marketing footer |
| 4.2 | Terms of Service live at `/terms` | ✅ | `app/(marketing)/terms/page.tsx` created. Linked from marketing footer |
| 4.3 | Cookie consent banner works | ✅ | `components/shared/CookieConsent.tsx` — shown on first visit |
| 4.4 | GDPR data export tested | 🔲 | `app/(app)/account/privacy/` → `/api/account/data-export` — test via the UI |
| 4.5 | Email unsubscribe links | ⚠️ | Ensure `sendWelcomeEmail` + `sendPaymentFailedEmail` in `lib/email/` include a footer unsubscribe link pointing to `DELETE /api/account` or a preferences URL |

---

## STEP 5 — Business

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5.1 | Landing page — no typos, CTAs link to sign-up | ✅ | `app/(marketing)/page.tsx` — CTAs use Clerk `SignUpButton`. Testimonials marked `[PLACEHOLDER]` — replace before launch |
| 5.2 | **Replace `[PLACEHOLDER]` testimonials** | ⚠️ | Landing page has placeholder testimonial copy — replace with real quotes |
| 5.3 | Pricing page links to checkout | ✅ | `PricingCTA` component calls `/api/billing/checkout` |
| 5.4 | Support email `support@promptforge.ai` monitored | ⚠️ | Set up email forwarding or a helpdesk inbox |
| 5.5 | At least 1 pilot customer confirmed | 🔲 | Business action — outside codebase |
| 5.6 | Uptime monitor configured (Better Uptime free) | ⚠️ | Point to `https://your-domain.com/api/health`. The `/api/health` endpoint returns `{ status, db, redis }` |
| 5.7 | Slack / Discord alert channel for on-call | ⚠️ | Wire Better Uptime or Sentry alerts to a Slack channel |
| 5.8 | Sentry `SENTRY_ORG` + `SENTRY_PROJECT` configured | ⚠️ | Set in Railway. Sentry already integrated via `@sentry/nextjs` |

---

## STEP 6 — Performance

| # | Item | Status | Notes |
|---|------|--------|-------|
| 6.1 | `npm run build` — clean, no errors | ✅ | **Build passes.** Fixed: Prisma lazy init, pdf-parse lazy require |
| 6.2 | TypeScript — 0 errors | ✅ | `npx tsc --noEmit` — clean |
| 6.3 | Unit tests — 31/31 pass | ✅ | `npm test` — 3 test files, 31 tests |
| 6.4 | No chunks > 500 KB | ✅ | Build output has no large chunk warnings |
| 6.5 | Lighthouse score > 90 on landing page | 🔲 | Run after deploy: `npx lighthouse https://your-domain.com` or Chrome DevTools |
| 6.6 | First Contentful Paint < 2s | 🔲 | Marketing pages are statically rendered (`○`) — should be fast. Verify post-deploy |
| 6.7 | Sentry deprecation warnings in `next.config.ts` | ⚠️ | `disableLogger` and `automaticVercelMonitors` are deprecated. Update to `webpack.treeshake.removeDebugLogging` and `webpack.automaticVercelMonitors` when upgrading Sentry |

---

## Required Railway Environment Variables

Set these in **Railway → Variables** before deploying:

```
# Database (Supabase)
DATABASE_URL=postgresql://postgres.xxx:[password]@aws-0-eu-west-2.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.xxx:[password]@aws-0-eu-west-2.pooler.supabase.com:5432/postgres

# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  ← ROTATE THIS (was exposed in chat)

# Clerk (use LIVE keys, not test)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...  ← ROTATE sk_test_inkuBaKRG55IzuY6aMzol9wHqrJqCNUY5lfMDULOuD
CLERK_WEBHOOK_SECRET=whsec_...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Stripe (LIVE mode)
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_AGENCY=price_...
STRIPE_PRICE_ENTERPRISE=price_...

# Inngest
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=signkey-prod-...

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Sentry (optional but recommended)
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=your-org
SENTRY_PROJECT=prompt-forge

# Analytics (optional)
NEXT_PUBLIC_POSTHOG_KEY=phc_...
```

---

## Security Rotation — URGENT

Three credentials were shared in the AI chat session and **must be rotated immediately**:

1. **Clerk secret key** `sk_test_inkuBaKRG55IzuY6aMzol9wHqrJqCNUY5lfMDULOuY5lfMDULOuD`
   → Rotate at: https://dashboard.clerk.com → API Keys → Roll secret key

2. **Supabase service role key** (shared in a prior session)
   → Rotate at: https://app.supabase.com → Project Settings → API → Roll service_role key

3. **Database password** `Prompt@n53@123`
   → Change at: https://app.supabase.com → Project Settings → Database → Reset database password

---

*Generated: June 2026. Re-run this checklist after every major infrastructure change.*
