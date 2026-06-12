import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — PromptForge',
  description: 'How PromptForge collects, uses, and protects your data.',
}

const LAST_UPDATED = 'June 2026'
const CONTACT_EMAIL = 'privacy@promptforge.ai'
const COMPANY_NAME = 'PromptForge'

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-10">
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-zinc-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-400">Last updated: {LAST_UPDATED}</p>

      <div className="prose prose-zinc mt-10 max-w-none text-sm leading-relaxed">
        <Section title="1. Who we are">
          <p>
            {COMPANY_NAME} (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates the PromptForge
            platform at promptforge.ai. This policy explains how we handle your personal data when
            you use our service.
          </p>
          <p>
            Questions? Contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="2. Data we collect">
          <ul>
            <li>
              <strong>Account data:</strong> email address, name, and profile information provided
              through Clerk authentication (Google OAuth or email/password).
            </li>
            <li>
              <strong>BRD documents:</strong> files you upload are stored in Supabase Storage,
              encrypted at rest, and accessible only to you.
            </li>
            <li>
              <strong>Usage data:</strong> pages visited, features used, and errors encountered
              (via PostHog and Sentry), used only to improve the product.
            </li>
            <li>
              <strong>Billing data:</strong> payment information is handled exclusively by Stripe.
              We store only your Stripe customer ID — we never see or store card numbers.
            </li>
          </ul>
        </Section>

        <Section title="3. How we use your data">
          <ul>
            <li>Provide and improve the PromptForge service.</li>
            <li>Generate AI architecture prompts from your uploaded BRDs using Anthropic&apos;s Claude API.</li>
            <li>Send transactional emails (welcome, payment receipts, security alerts).</li>
            <li>Detect and fix bugs via error monitoring.</li>
          </ul>
          <p>
            We do <strong>not</strong> sell your data to third parties, and we do not use your BRD
            content to train AI models.
          </p>
        </Section>

        <Section title="4. Data sharing">
          <p>We share data with the following sub-processors:</p>
          <ul>
            <li><strong>Clerk</strong> — authentication and user management</li>
            <li><strong>Supabase</strong> — database and file storage (EU region available)</li>
            <li><strong>Anthropic</strong> — AI prompt generation (your BRD text is sent for processing)</li>
            <li><strong>Stripe</strong> — payment processing</li>
            <li><strong>Inngest</strong> — background job orchestration</li>
            <li><strong>PostHog</strong> — product analytics (anonymised)</li>
            <li><strong>Sentry</strong> — error monitoring</li>
            <li><strong>Upstash</strong> — rate limiting (Redis, no personal data stored)</li>
          </ul>
        </Section>

        <Section title="5. Data retention">
          <p>
            We retain your account and project data for as long as your account is active, plus 30
            days after deletion to enable recovery. BRD files are deleted immediately when you
            request account deletion.
          </p>
        </Section>

        <Section title="6. Your rights (GDPR)">
          <p>If you are in the European Economic Area, you have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you.</li>
            <li>Correct inaccurate data.</li>
            <li>Request deletion of your account and data.</li>
            <li>Export your data in a machine-readable format.</li>
            <li>Object to processing for marketing purposes.</li>
          </ul>
          <p>
            Exercise these rights from your{' '}
            <Link href="/account/privacy" className="text-blue-600 hover:underline">
              Privacy &amp; Data
            </Link>{' '}
            page, or email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="7. Cookies">
          <p>
            We use strictly necessary cookies for authentication (Clerk session tokens) and
            optional analytics cookies (PostHog). You can manage your cookie preferences via the
            banner on your first visit.
          </p>
        </Section>

        <Section title="8. Security">
          <p>
            All data is transmitted over HTTPS. BRD files are stored encrypted at rest in Supabase.
            We run automated security audits weekly. If you discover a security issue, please email{' '}
            <a href="mailto:security@promptforge.ai" className="text-blue-600 hover:underline">
              security@promptforge.ai
            </a>
            .
          </p>
        </Section>

        <Section title="9. Changes to this policy">
          <p>
            We will notify you by email at least 30 days before making material changes. Continued
            use after the effective date constitutes acceptance.
          </p>
        </Section>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-base font-semibold text-zinc-900">{title}</h2>
      <div className="space-y-3 text-zinc-600">{children}</div>
    </section>
  )
}
