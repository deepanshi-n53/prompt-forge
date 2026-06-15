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

// pdf-parse v2 uses a class-based API. Disable canvas/image flags that require
// browser globals (DOMMatrix, OffscreenCanvas) which are absent in some Node.js
// environments and all edge runtimes.
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({
      data: new Uint8Array(buffer),
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      disableFontFace: true,
    })
    const result = await parser.getText({ pageJoiner: '\n\n' })
    await parser.destroy()
    return result.text
  } catch (error) {
    console.error('PDF extraction error:', error)
    return 'PDF content could not be extracted. Please try a .txt or .docx file instead.'
  }
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

  if (mimeType === 'application/pdf') {
    return cleanText(await extractPdfText(buffer))
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth') as {
      extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>
    }
    const result = await mammoth.extractRawText({ buffer })
    return cleanText(result.value)
  }

  return cleanText(buffer.toString('utf-8'))
}
