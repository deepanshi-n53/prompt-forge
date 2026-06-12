import { PrivacyActions } from './_components/PrivacyActions'

export const metadata = { title: 'Privacy & Data — PromptForge' }

const THIRD_PARTIES = [
  { name: 'Clerk',     purpose: 'Authentication and session management',  link: 'https://clerk.com/privacy' },
  { name: 'Anthropic', purpose: 'AI prompt generation from your BRDs',    link: 'https://www.anthropic.com/privacy' },
  { name: 'Stripe',    purpose: 'Payment processing and billing',         link: 'https://stripe.com/privacy' },
  { name: 'PostHog',   purpose: 'Product analytics (opt-out via banner)', link: 'https://posthog.com/privacy' },
  { name: 'Sentry',    purpose: 'Error monitoring and diagnostics',       link: 'https://sentry.io/privacy/' },
  { name: 'Supabase',  purpose: 'File storage (BRD documents)',           link: 'https://supabase.com/privacy' },
]

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-10">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">Privacy &amp; Data</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Manage your personal data and understand how PromptForge uses it.
        </p>
      </header>

      <PrivacyActions />

      <hr className="border-zinc-200" />

      {/* Data retention */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Data retention</h2>
        <div className="space-y-2 text-sm text-zinc-600">
          <p>
            <strong>Active accounts:</strong> We retain your data for as long as your account
            is active or as needed to provide our service.
          </p>
          <p>
            <strong>After deletion request:</strong> Your account data is permanently deleted
            30 days after you submit a deletion request. During this grace period you can cancel
            the deletion from this page.
          </p>
          <p>
            <strong>Uploaded BRDs:</strong> Document files are stored in Supabase Storage and
            are deleted as part of the account deletion process.
          </p>
          <p>
            <strong>Billing records:</strong> Stripe may retain payment records as required by
            financial regulations, independent of account deletion.
          </p>
        </div>
      </section>

      <hr className="border-zinc-200" />

      {/* Third-party services */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Third-party services</h2>
        <p className="text-sm text-zinc-500 mb-4">
          PromptForge shares limited data with the following processors to deliver its service:
        </p>
        <div className="overflow-x-auto rounded-md border border-zinc-200">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Service</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Purpose</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Privacy policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {THIRD_PARTIES.map((p) => (
                <tr key={p.name}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{p.name}</td>
                  <td className="px-4 py-3 text-zinc-600">{p.purpose}</td>
                  <td className="px-4 py-3">
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
