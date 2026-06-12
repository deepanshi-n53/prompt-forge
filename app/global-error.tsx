'use client'

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="max-w-md space-y-4">
        <h2 className="text-xl font-bold">Something went wrong</h2>
        {error.digest && (
          <p className="font-mono text-xs text-zinc-400">Ref: {error.digest}</p>
        )}
        <button
          onClick={unstable_retry}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
