import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="max-w-md space-y-6">
        {/* numeric indicator */}
        <div className="text-8xl font-black tracking-tighter text-zinc-200 select-none" aria-hidden="true">
          404
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-zinc-900">Page not found</h1>
          <p className="text-sm text-zinc-500">
            The page you&#39;re looking for doesn&#39;t exist, has moved, or you don&#39;t have access.
          </p>
        </div>

        <div className="flex justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 transition-colors"
          >
            Go to dashboard
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  )
}
