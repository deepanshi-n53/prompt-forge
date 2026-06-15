import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth'
import { uploadBRD, validateMagicBytes } from '@/lib/storage/supabase-storage'
import { changeDetectSchema } from '@/lib/validations'
import { inngest } from '@/inngest/client'
import { ChangeEventStatus } from '@prisma/client'

export async function POST(request: NextRequest) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  const validation = changeDetectSchema.safeParse({
    projectId,
    mimeType: fileField.type,
    fileSize: fileField.size,
  })
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.flatten() }, { status: 422 })
  }

  // Verify project ownership before reading file bytes
  const project = await db.project.findFirst({
    where: { id: projectId, ownerId: user.id },
  })
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const oldBrd = await db.bRD.findFirst({
    where:   { projectId, isActive: true },
    orderBy: { version: 'desc' },
  })
  if (!oldBrd) {
    return NextResponse.json(
      { error: 'No active BRD to compare against. Upload your first BRD via the standard upload.' },
      { status: 422 },
    )
  }

  const lastBrd = await db.bRD.findFirst({
    where:   { projectId },
    orderBy: { version: 'desc' },
    select:  { version: true },
  })
  const version = (lastBrd?.version ?? 0) + 1

  const newBrd = await db.bRD.create({
    data: {
      projectId,
      version,
      fileName:    fileField.name,
      storagePath: '',
      fileSize:    fileField.size,
      mimeType:    fileField.type,
      isActive:    false,
    },
  })

  // Read buffer and validate magic bytes before upload
  const arrayBuffer = await fileField.arrayBuffer()
  const buffer      = Buffer.from(arrayBuffer)

  try {
    validateMagicBytes(buffer, fileField.type)
  } catch (err) {
    await db.bRD.delete({ where: { id: newBrd.id } })
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid file content' },
      { status: 415 },
    )
  }

  let storagePath: string
  try {
    storagePath = await uploadBRD(buffer, fileField.name, projectId, newBrd.id, version, fileField.type)
  } catch (err) {
    await db.bRD.delete({ where: { id: newBrd.id } })
    console.error('[changes/detect] storage upload failed', err)
    return NextResponse.json({ error: 'File upload failed' }, { status: 500 })
  }

  await db.bRD.update({ where: { id: newBrd.id }, data: { storagePath } })
  await db.bRD.update({ where: { id: oldBrd.id }, data: { isActive: false } })

  const changeEvent = await db.changeEvent.create({
    data: {
      projectId,
      oldBrdId:       oldBrd.id,
      newBrdId:       newBrd.id,
      changeAnalysis: {},
      status:         ChangeEventStatus.PENDING,
    },
  })

  const { ids } = await inngest.send({
    name: 'brd/changed',
    data: {
      projectId,
      oldBrdId:      oldBrd.id,
      newBrdId:      newBrd.id,
      changeEventId: changeEvent.id,
    },
  })

  return NextResponse.json(
    { jobId: projectId, changeEventId: changeEvent.id, inngestId: ids[0] },
    { status: 202 },
  )
}
