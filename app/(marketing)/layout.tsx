import Link from 'next/link'
import { SignInButton, SignUpButton, Show, UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* logo + nav links */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center gap-2 text-base font-bold tracking-tight text-zinc-900"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white text-xs font-black">
                PF
              </span>
              PromptForge
            </Link>
            <nav className="hidden items-center gap-5 md:flex">
              <Link
                href="/pricing"
                className="text-sm text-zinc-500 transition-colors hover:text-zinc-900"
              >
                Pricing
              </Link>
              <Link
                href="/about"
                className="text-sm text-zinc-500 transition-colors hover:text-zinc-900"
              >
                About
              </Link>
            </nav>
          </div>

          {/* auth controls */}
          <nav className="flex items-center gap-2">
            <Show when="signed-out">
              <SignInButton mode="redirect">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </SignInButton>
              <SignUpButton mode="redirect">
                <Button size="sm">Get started free</Button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="mr-2 text-sm text-zinc-500 transition-colors hover:text-zinc-900"
              >
                Dashboard
              </Link>
              <UserButton />
            </Show>
          </nav>
        </div>
      </header>

      {/* ── Page content ───────────────────────────────────────────────────── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 md:flex-row md:justify-between">
            {/* brand */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-white text-[10px] font-black">
                  PF
                </span>
                <span className="text-sm font-bold text-zinc-900">PromptForge</span>
              </div>
              <p className="text-xs text-zinc-400 max-w-xs">
                Converts any BRD into 55 production-ready architecture prompts — ready for Claude
                Code, Cursor, Lovable, and Bolt.
              </p>
            </div>

            {/* nav columns */}
            <div className="flex flex-wrap gap-x-16 gap-y-6 text-sm">
              <div className="space-y-3">
                <p className="font-semibold text-zinc-900 text-xs uppercase tracking-wide">
                  Product
                </p>
                <ul className="space-y-2">
                  <li>
                    <Link href="/pricing" className="text-zinc-500 hover:text-zinc-900 transition-colors">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link href="/about" className="text-zinc-500 hover:text-zinc-900 transition-colors">
                      About
                    </Link>
                  </li>
                  <li>
                    <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-900 transition-colors">
                      Dashboard
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <p className="font-semibold text-zinc-900 text-xs uppercase tracking-wide">
                  Legal
                </p>
                <ul className="space-y-2">
                  <li>
                    <Link href="/privacy" className="text-zinc-500 hover:text-zinc-900 transition-colors">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="text-zinc-500 hover:text-zinc-900 transition-colors">
                      Terms of Service
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-zinc-100 pt-6 text-center">
            <p className="text-xs text-zinc-400">
              © {new Date().getFullYear()} PromptForge. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
