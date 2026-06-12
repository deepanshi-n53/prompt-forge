'use client'

import { useEffect, useState } from 'react'

export function NetworkStatus() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)
    const handleOnline  = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-zinc-900 px-4 py-3 text-sm font-medium text-white"
    >
      <span className="size-2 rounded-full bg-red-400 animate-pulse" aria-hidden="true" />
      Connection lost — changes may not be saved
    </div>
  )
}
