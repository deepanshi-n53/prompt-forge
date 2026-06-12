import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — PromptForge',
  description: 'Terms governing your use of the PromptForge platform.',
}

const LAST_UPDATED = 'June 2026'
const CONTACT_EMAIL = 'legal@promptforge.ai'

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-10">
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-zinc-900">Terms of Service</h1>
      <p className="mt-2 text-sm text-zinc-400">Last updated: {LAST_UPDATED}</p>

      <div className="prose prose-zinc mt-10 max-w-none text-sm leading-relaxed">
        <Section title="1. Acceptance">
          <p>
            By creating an account or using PromptForge (&quot;Service&quot;), you agree to these
            Terms. If you do not agree, do not use the Service.
          </p>
        </Section>

        <Section title="2. Description of service">
          <p>
            PromptForge converts Business Requirements Documents (BRDs) into structured AI
            architecture prompts. The Service is provided on an &quot;as-is&quot; basis and may be
            modified or discontinued at any time with 30 days&apos; notice where reasonably
            practicable.
          </p>
        </Section>

        <Section title="3. Your account">
          <ul>
            <li>You must be 18 or older to use the Service.</li>
            <li>You are responsible for maintaining the security of your login credentials.</li>
            <li>You may not share your account with others (each seat requires its own account).</li>
            <li>
              We may suspend accounts that violate these Terms or engage in abusive behaviour (e.g.,
              scraping, automated abuse of AI generation limits).
            </li>
          </ul>
        </Section>

        <Section title="4. Your content">
          <p>
            You retain ownership of all BRD documents and other content you upload
            (&quot;Your Content&quot;). By uploading, you grant us a limited licence to process
            Your Content solely to provide the Service. We do not claim any ownership over Your
            Content and will not use it to train AI models.
          </p>
          <p>
            You represent that you have the right to upload Your Content and that it does not
            infringe third-party intellectual property rights.
          </p>
        </Section>

        <Section title="5. Acceptable use">
          <p>You may not use the Service to:</p>
          <ul>
            <li>Generate content that violates applicable law.</li>
            <li>Reverse-engineer or circumvent rate limits or access controls.</li>
            <li>Resell access to the Service without our written consent.</li>
            <li>Upload malicious files or attempt to compromise our infrastructure.</li>
          </ul>
        </Section>

        <Section title="6. Billing and refunds">
          <p>
            Paid plans are billed monthly in advance via Stripe. Upgrades take effect immediately;
            downgrades take effect at the next billing cycle. We offer a 7-day refund if you
            encounter a material bug that prevents use of the core feature set and we are unable to
            resolve it. Refunds are at our discretion for other circumstances.
          </p>
        </Section>

        <Section title="7. Intellectual property">
          <p>
            The PromptForge platform, logo, and generated prompt templates are our intellectual
            property. The architecture prompts generated from your BRDs are yours to use in any
            project.
          </p>
        </Section>

        <Section title="8. Disclaimer of warranties">
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT ANY WARRANTY OF ANY KIND. WE DO NOT
            WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT AI-GENERATED
            OUTPUTS WILL BE ACCURATE OR FIT FOR ANY PARTICULAR PURPOSE.
          </p>
        </Section>

        <Section title="9. Limitation of liability">
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM
            ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE WILL NOT EXCEED THE AMOUNT
            YOU PAID US IN THE 3 MONTHS PRECEDING THE CLAIM.
          </p>
        </Section>

        <Section title="10. Governing law">
          <p>
            These Terms are governed by the laws of England and Wales. Any disputes will be subject
            to the exclusive jurisdiction of the courts of England and Wales.
          </p>
        </Section>

        <Section title="11. Changes">
          <p>
            We may update these Terms. We will notify you by email at least 30 days before material
            changes take effect. Continued use constitutes acceptance of the updated Terms.
          </p>
        </Section>

        <Section title="12. Contact">
          <p>
            Questions about these Terms?{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
              {CONTACT_EMAIL}
            </a>
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
