import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db/prisma'
import { inngest } from '@/inngest/client'
import { getJobState, setJobState } from '@/lib/jobs/redis'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Context) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify project ownership
  const project = await db.project.findFirst({
    where: { id, ownerId: user.id },
    select: { id: true },
  })
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { field, answer, answers } = body as {
    field?:   string
    answer?:  string
    answers?: Record<string, string>
  }
  // A pause is either single-field (answer) or multi-question (answers map, e.g.
  // §20 compliance). Require the field key plus at least one of the two payloads.
  const hasAnswers = answers && typeof answers === 'object' && Object.keys(answers).length > 0
  if (!field || (!answer && !hasAnswers)) {
    return NextResponse.json({ error: 'field and answer (or answers) are required' }, { status: 422 })
  }

  // Send the event that resumes the paused Inngest function. The waitForEvent in
  // generate-prompts filters on async.data.projectId + async.data.field, so these
  // keys must match exactly (they do). Both answer and answers are forwarded;
  // applyMidGenAnswer picks the right one based on the question shape.
  await inngest.send({
    name: 'brd/pause-answered',
    data: {
      projectId: id,
      field,
      ...(answer  !== undefined ? { answer }  : {}),
      ...(hasAnswers              ? { answers } : {}),
    },
  })

  // Flip the Redis job state out of 'paused' immediately, dropping the stored
  // pauseQuestion. This stops a reconnect (before Inngest processes the event)
  // from re-surfacing the modal the user just answered. The function itself also
  // writes 'running' when it resumes — this just closes the gap sooner.
  const current = await getJobState(id)
  if (current && current.status === 'paused') {
    await setJobState(id, {
      status:  'running',
      percent: current.percent,
      step:    current.step,
      message: 'Answer received — resuming generation…',
    })
  }

  return NextResponse.json({ success: true })
}
