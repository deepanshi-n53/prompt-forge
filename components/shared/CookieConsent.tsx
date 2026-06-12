'use client'

import { useState } from 'react'

const STORAGE_KEY = 'pf-cookie-consent'

function isEuTimezone(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return tz.startsWith('Europe/')
  } catch {
    return false
  }
}

export function CookieConsent() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    if (!isEuTimezone()) return false
    return !localStorage.getItem(STORAGE_KEY)
  })

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'all')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, 'essential')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
    >
      <p className="text-sm text-zinc-700 mb-4">
        We use cookies to remember your session and, with your consent, to measure how people
        use PromptForge so we can improve it. No advertising cookies are used.
      </p>
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={decline}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          Essential only
        </button>
        <button
          type="button"
          onClick={accept}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          Accept all
        </button>
      </div>
    </div>
  )
}
