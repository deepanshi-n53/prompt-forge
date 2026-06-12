import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db/prisma'
import { uploadBRD, validateMagicBytes } from '@/lib/storage/supabase-storage'
import { brdUploadSchema } from '@/lib/validations'
import { fileUploadLimiter, applyRateLimit, RateLimitError } from '@/lib/rate-limit'
import { inngest } from '@/inngest/client'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await applyRateLimit(fileUploadLimiter, userId)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: err.message, retryable: true, retryAfter: err.retryAfter } },
        { status: 429, headers: { 'Retry-After': String(err.retryAfter) } },
      )
    }
    throw err
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const fileField = formData.get('file')
  const projectId = formData.get('projectId')

  if (!(fileField instanceof File) || typeof projectId !== 'string') {
    return NextResponse.json({ error: 'Missing file or projectId' }, { status: 400 })
  }

  // Zod validation on extracted fields
  const validation = brdUploadSchema.safeParse({
    projectId,
    mimeType: fileField.type,
    fileSize: fileField.size,
  })
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.flatten() }, { status: 422 })
  }

  // Verify project ownership before reading the file bytes
  const project = await db.project.findFirst({
    where: { id: projectId, ownerId: user.id },
  })
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Read buffer once, then validate magic bytes
  const arrayBuffer = await fileField.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  try {
    validateMagicBytes(buffer, fileField.type)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid file content' },
      { status: 415 },
    )
  }

  const lastBrd = await db.bRD.findFirst({
    where:   { projectId },
    orderBy: { version: 'desc' },
  })
  const version = (lastBrd?.version ?? 0) + 1

  const brd = await db.bRD.create({
    data: {
      projectId,
      version,
      fileName:    fileField.name,
      storagePath: '',
      fileSize:    fileField.size,
      mimeType:    fileField.type,
    },
  })

  let storagePath: string
  try {
    storagePath = await uploadBRD(buffer, fileField.name, projectId, brd.id, version)
  } catch (err) {
    await db.bRD.delete({ where: { id: brd.id } })
    console.error('[brd/upload] storage upload failed', err)
    return NextResponse.json({ error: 'File upload failed' }, { status: 500 })
  }

  await db.bRD.update({
    where: { id: brd.id },
    data:  { storagePath },
  })

  const { ids } = await inngest.send({
    name: 'brd/uploaded',
    data: { brdId: brd.id, projectId, storagePath, mimeType: fileField.type },
  })

  return NextResponse.json({ jobId: ids[0], brdId: brd.id }, { status: 201 })
}
