'use client'

import { useRef, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]
const MAX_SIZE = 52_428_800 // 50 MB

type UploadState =
  | { status: 'idle' }
  | { status: 'dragging' }
  | { status: 'uploading'; percent: number }
  | { status: 'processing'; jobId: string; brdId: string }
  | { status: 'error'; message: string }

interface BRDUploaderProps {
  projectId: string
  onProcessing: (jobId: string, brdId: string) => void
}

export function BRDUploader({ projectId, onProcessing }: BRDUploaderProps) {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)

  function validate(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Only PDF, Word, or text files accepted'
    }
    if (file.size > MAX_SIZE) {
      return 'File must be under 50MB'
    }
    return null
  }

  function upload(file: File) {
    const error = validate(file)
    if (error) {
      setState({ status: 'error', message: error })
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('projectId', projectId)

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setState({ status: 'uploading', percent: Math.round((e.loaded / e.total) * 100) })
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status === 201) {
        const body = JSON.parse(xhr.responseText) as { jobId: string; brdId: string }
        setState({ status: 'processing', jobId: body.jobId, brdId: body.brdId })
        onProcessing(body.jobId, body.brdId)
      } else {
        let message = 'Upload failed — please try again'
        try {
          const body = JSON.parse(xhr.responseText) as { error?: string }
          if (body.error) message = body.error
        } catch {}
        setState({ status: 'error', message })
      }
    })

    xhr.addEventListener('error', () => {
      setState({ status: 'error', message: 'Upload failed — please try again' })
    })

    xhr.open('POST', '/api/brd/upload')
    xhr.send(formData)

    setState({ status: 'uploading', percent: 0 })
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setState({ status: 'idle' })
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload(file)
    // Reset input so the same file can be re-selected after an error
    e.target.value = ''
  }

  const isDragging = state.status === 'dragging'

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setState({ status: 'dragging' }) }}
        onDragLeave={() => setState({ status: 'idle' })}
        onDrop={onDrop}
        className={[
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors',
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-zinc-300 bg-zinc-50 hover:border-zinc-400',
          state.status === 'uploading' || state.status === 'processing' ? 'pointer-events-none' : '',
        ].join(' ')}
      >
        {state.status === 'idle' || state.status === 'dragging' ? (
          <>
            <p className="mb-1 text-sm font-medium text-zinc-700">
              {isDragging ? 'Drop your BRD here' : 'Drag & drop your BRD here'}
            </p>
            <p className="mb-4 text-xs text-zinc-400">PDF, Word (.docx), or plain text — max 50 MB</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              Browse file
            </Button>
          </>
        ) : state.status === 'uploading' ? (
          <div className="w-full max-w-xs space-y-2">
            <p className="text-center text-sm font-medium text-zinc-700">
              Uploading… {state.percent}%
            </p>
            <Progress value={state.percent} className="h-2" />
          </div>
        ) : state.status === 'processing' ? (
          <p className="text-sm font-medium text-zinc-700">
            Upload complete — parsing your BRD…
          </p>
        ) : (
          <div className="space-y-2 text-center">
            <p className="text-sm font-medium text-red-600">{state.message}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setState({ status: 'idle' })}
            >
              Try again
            </Button>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  )
}
