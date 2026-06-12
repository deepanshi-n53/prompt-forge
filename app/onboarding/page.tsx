import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { OnboardingWizard } from './_components/OnboardingWizard'

export const metadata = { title: 'Get started — PromptForge' }

export default async function OnboardingPage() {
  const user = await requireAuth()

  // Already onboarded — send to dashboard
  if (!user.isNewUser) redirect('/dashboard')

  return (
    <OnboardingWizard
      userName={user.name?.split(' ')[0] ?? 'there'}
      plan={user.plan}
    />
  )
}
