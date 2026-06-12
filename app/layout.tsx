import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from '@/components/ui/sonner'
import { Providers } from '@/components/shared/Providers'
import { CookieConsent } from '@/components/shared/CookieConsent'
import { NetworkStatus } from '@/components/shared/NetworkStatus'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'PromptForge',
  description: 'Turn your BRD into production-ready AI architecture prompts.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col">
          <Providers>{children}</Providers>
          <Toaster richColors position="top-right" />
          <CookieConsent />
          <NetworkStatus />
        </body>
      </html>
    </ClerkProvider>
  )
}
