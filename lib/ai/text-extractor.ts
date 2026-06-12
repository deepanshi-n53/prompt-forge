import { getBRDDownloadUrl } from '@/lib/storage/supabase-storage'

const MAX_CHARS = 500_000

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, MAX_CHARS)
}

export async function extractTextFromStorage(
  storagePath: string,
  mimeType: string,
): Promise<string> {
  const signedUrl = await getBRDDownloadUrl(storagePath)

  const response = await fetch(signedUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch BRD from storage: ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let raw: string

  if (mimeType === 'application/pdf') {
    // Lazy-require: avoid loading pdf-parse (and its canvas dep) at module
    // evaluation time, which crashes during Next.js build-time static analysis.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
    const result = await pdfParse(buffer)
    raw = result.text
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth') as {
      extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>
    }
    const result = await mammoth.extractRawText({ buffer })
    raw = result.value
  } else {
    // text/plain — UTF-8 decode
    raw = buffer.toString('utf-8')
  }

  return cleanText(raw)
}
