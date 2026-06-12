import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      {/* minimal header — no nav distractions during onboarding */}
      <header className="border-b border-zinc-100 bg-white">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white text-xs font-black">
              PF
            </span>
            <span className="font-bold text-zinc-900">PromptForge</span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">{children}</div>
      </main>
    </div>
  )
}
