import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'

// Compare the prompts a re-upload regenerated: old version (left) vs new (right).
// Both versions coexist in GeneratedPrompt, keyed by brdVersion, so we load the
// regenerated sections at the change's old and new BRD versions and diff them.
export default async function ComparePage({
  params,
}: {
  params: Promise<{ id: string; changeId: string }>
}) {
  const user = await requireAuth()
  const { id, changeId } = await params

  const project = await db.project.findFirst({
    where:  { id, ownerId: user.id },
    select: { id: true, name: true },
  })
  if (!project) notFound()

  const change = await db.changeEvent.findFirst({
    where:  { id: changeId, projectId: id },
    select: { id: true, oldBrdId: true, newBrdId: true, deltaPrompts: true, status: true, appliedAt: true },
  })
  if (!change) notFound()

  const [oldBrd, newBrd] = await Promise.all([
    db.bRD.findUnique({ where: { id: change.oldBrdId }, select: { version: true } }),
    db.bRD.findUnique({ where: { id: change.newBrdId }, select: { version: true } }),
  ])
  const oldVersion = oldBrd?.version ?? 1
  const newVersion = newBrd?.version ?? oldVersion + 1

  const delta       = (change.deltaPrompts ?? {}) as { sectionNums?: string[] }
  const sectionNums = delta.sectionNums ?? []

  const prompts = sectionNums.length
    ? await db.generatedPrompt.findMany({
        where: {
          projectId:  id,
          sectionNum: { in: sectionNums },
          brdVersion: { in: [oldVersion, newVersion] },
        },
        select: { sectionNum: true, sectionName: true, content: true, brdVersion: true },
      })
    : []

  const bySection = new Map<string, { name: string; before?: string; after?: string }>()
  for (const p of prompts) {
    const entry = bySection.get(p.sectionNum) ?? { name: p.sectionName }
    entry.name = p.sectionName
    if (p.brdVersion === oldVersion) entry.before = p.content
    if (p.brdVersion === newVersion) entry.after  = p.content
    bySection.set(p.sectionNum, entry)
  }
  const sections = sectionNums.map((num) => ({ num, ...(bySection.get(num) ?? { name: num }) }))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href={`/project/${id}/changes`} className="text-sm text-zinc-400 hover:text-zinc-600">
            ← Changes
          </Link>
          <span className="text-zinc-200">/</span>
          <span className="text-sm font-medium text-zinc-800">Compare versions</span>
        </div>
        <span className="text-xs text-zinc-400">
          v{oldVersion} → v{newVersion} · {sections.length} regenerated section{sections.length !== 1 ? 's' : ''}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {change.status !== 'APPLIED' ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center">
            <p className="font-medium text-zinc-700">Nothing to compare yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Apply this change first — only then are the new section versions generated.
            </p>
          </div>
        ) : sections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center">
            <p className="font-medium text-zinc-700">No sections were regenerated</p>
            <p className="mt-1 text-sm text-zinc-500">This change had no breaking impact.</p>
          </div>
        ) : (
          <div className="mx-auto max-w-6xl space-y-6">
            {sections.map((s) => (
              <div key={s.num} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2">
                  <span className="text-sm font-semibold text-zinc-800">§{s.num} — {s.name}</span>
                </div>
                <div className="grid grid-cols-1 gap-px bg-zinc-200 md:grid-cols-2">
                  <ColumnPane label={`Previous (v${oldVersion})`} content={s.before} tone="old" />
                  <ColumnPane label={`Current (v${newVersion})`}  content={s.after}  tone="new" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ColumnPane({ label, content, tone }: { label: string; content?: string; tone: 'old' | 'new' }) {
  const head = tone === 'new' ? 'text-green-700' : 'text-zinc-500'
  return (
    <div className="bg-white">
      <div className={`px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide ${head}`}>{label}</div>
      {content ? (
        <pre className="max-h-[28rem] overflow-auto px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap break-words text-zinc-700">
          {content}
        </pre>
      ) : (
        <p className="px-4 py-3 text-xs italic text-zinc-400">
          {tone === 'old' ? 'Not present in the previous version.' : 'Not regenerated.'}
        </p>
      )}
    </div>
  )
}
