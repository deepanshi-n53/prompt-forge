import { Skeleton } from '@/components/ui/skeleton'

export default function PromptsLoading() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-36" />
        </div>
      </header>

      {/* layer tabs */}
      <div className="flex shrink-0 gap-1 border-b border-zinc-100 bg-white px-4 pt-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-t-md" />
        ))}
      </div>

      {/* prompt list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3"
          >
            <Skeleton className="h-7 w-12 shrink-0 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
            <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
