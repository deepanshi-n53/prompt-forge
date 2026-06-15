import mammoth from 'mammoth'
import { getSupabaseClient } from '@/lib/storage/supabase-storage'

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

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    pdfjsLib.GlobalWorkerOptions.workerSrc = ''

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      useSystemFonts: true,
      isOffscreenCanvasSupported: false,
      disableFontFace: true,
    })

    const pdf = await loadingTask.promise
    const numPages = pdf.numPages
    const textPages: string[] = []

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => ('str' in item ? (item.str as string) : ''))
        .join(' ')
      textPages.push(pageText)
    }

    return textPages.join('\n')
  } catch (error) {
    console.error('PDF extraction error:', error)
    return 'PDF content could not be extracted. Please upload a .txt or .docx file instead.'
  }
}

export async function extractTextFromStorage(
  storagePath: string,
  mimeType: string,
): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase.storage.from('brds').download(storagePath)

  if (error || !data) {
    throw new Error(`Failed to download BRD: ${error?.message}`)
  }

  const arrayBuffer = await data.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  if (mimeType === 'application/pdf') {
    return cleanText(await extractPdfText(buffer))
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer })
    return cleanText(result.value)
  }

  return cleanText(buffer.toString('utf-8'))
}
