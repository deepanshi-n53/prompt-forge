import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { getCurrentUser } from '@/lib/auth'
import type { Plan } from '@prisma/client'

const NAV_LINKS = [
  { href: '/dashboard',        label: 'Projects' },
  { href: '/account/billing',  label: 'Billing'  },
  { href: '/account/privacy',  label: 'Privacy'  },
]

const PLAN_BADGE: Record<Plan, { label: string; classes: string }> = {
  FREE:         { label: 'Free',         classes: 'bg-zinc-100 text-zinc-600' },
  PROFESSIONAL: { label: 'Pro',          classes: 'bg-blue-100 text-blue-700' },
  AGENCY:       { label: 'Agency',       classes: 'bg-violet-100 text-violet-700' },
  ENTERPRISE:   { label: 'Enterprise',   classes: 'bg-amber-100 text-amber-700' },
}

export async function Sidebar() {
  const user = await getCurrentUser()
  const plan = user?.plan ?? 'FREE'
  const badge = PLAN_BADGE[plan]

  return (
    <aside
      id="app-sidebar"
      aria-label="Main navigation"
      className="flex h-full w-60 flex-col border-r border-zinc-200 bg-white px-4 py-6"
    >
      {/* logo */}
      <Link
        href="/dashboard"
        aria-label="PromptForge dashboard"
        className="mb-8 flex items-center gap-2 text-base font-bold tracking-tight text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 rounded-md"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white text-xs font-black">
          PF
        </span>
        PromptForge
      </Link>

      {/* nav */}
      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Site pages">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center rounded-md px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 transition-colors min-h-11"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* plan + upgrade */}
      <div className="mt-auto space-y-3 border-t border-zinc-100 pt-4">
        {plan === 'FREE' && (
          <div className="rounded-lg bg-linear-to-br from-zinc-900 to-zinc-700 p-3 text-white">
            <p className="text-xs font-semibold">Unlock more</p>
            <p className="mt-0.5 text-xs text-zinc-300 leading-snug">
              Get unlimited projects, change detection &amp; team seats.
            </p>
            <Link
              href="/pricing"
              className="mt-2 inline-flex rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 transition-colors"
            >
              Upgrade →
            </Link>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <UserButton />
            <div className="min-w-0">
              {user?.name && (
                <p className="truncate text-xs font-medium text-zinc-700">{user.name}</p>
              )}
              <span className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${badge.classes}`}>
                {badge.label}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
