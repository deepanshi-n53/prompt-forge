import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/shared/Sidebar'
import { AppShell } from '@/components/shared/AppShell'
import { GenerationBanner } from '@/components/shared/GenerationBanner'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  return (
    <AppShell sidebar={<Sidebar />}>
      <GenerationBanner />
      {children}
    </AppShell>
  )
}
