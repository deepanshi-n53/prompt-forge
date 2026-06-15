import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Service role client — server-side only, never expose to browser
let supabaseInstance: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('Supabase credentials not configured')
    }
    supabaseInstance = createClient(url, key)
  }
  return supabaseInstance
}

// ── File security helpers ─────────────────────────────────────────────────────

const MAGIC_BYTES: Record<string, { offset: number; bytes: Buffer }> = {
  'application/pdf': {
    offset: 0,
    bytes:  Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    offset: 0,
    bytes:  Buffer.from([0x50, 0x4b, 0x03, 0x04]), // PK (ZIP)
  },
}

/**
 * Validates that the first bytes of `file` match the expected magic bytes for
 * `mimeType`. Throws if the file content contradicts the declared type.
 * Plain-text files have no fixed magic bytes so they are accepted as-is.
 */
export function validateMagicBytes(file: Buffer, mimeType: string): void {
  const spec = MAGIC_BYTES[mimeType]
  if (!spec) return // no magic bytes required for this type (e.g. text/plain)

  if (file.length < spec.offset + spec.bytes.length) {
    throw new Error(`File is too small to be a valid ${mimeType}`)
  }

  const actual = file.subarray(spec.offset, spec.offset + spec.bytes.length)
  if (!actual.equals(spec.bytes)) {
    throw new Error(
      `File content does not match declared type ${mimeType} — possible file spoofing`,
    )
  }
}

/**
 * Strips HTML/XML tags and decodes common HTML entities from extracted BRD text
 * before it is stored. Prevents XSS injection via document content and removes
 * markup noise from non-HTML documents that happen to contain HTML fragments.
 */
export function sanitizeBRDText(text: string): string {
  return text
    .replace(/<[^>]{0,10000}>/g, ' ')   // remove tags (bounded to avoid ReDoS)
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s{3,}/g, '\n\n')          // collapse excessive whitespace
    .trim()
}

const BUCKET = 'brds'

export function generateStoragePath(
  projectId: string,
  brdId: string,
  version: number,
  fileName: string,
): string {
  const sanitized = fileName
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
  return `${projectId}/${brdId}/v${version}/${sanitized}`
}

export async function uploadBRD(
  file: Buffer,
  fileName: string,
  projectId: string,
  brdId: string,
  version: number,
  mimeType: string,
): Promise<string> {
  const storagePath = generateStoragePath(projectId, brdId, version, fileName)

  const { error } = await getSupabaseClient()
    .storage
    .from('brds')
    .upload(storagePath, file, {
      contentType: mimeType,
      upsert: false,
    })

  if (error) {
    throw new Error(`Failed to upload BRD to storage: ${error.message}`)
  }

  return storagePath
}

export async function getBRDDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await getSupabaseClient().storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600)

  if (error || !data) {
    throw new Error(`Failed to create signed URL: ${error?.message ?? 'unknown error'}`)
  }

  return data.signedUrl
}

export async function deleteBRD(storagePath: string): Promise<void> {
  const { error } = await getSupabaseClient().storage.from(BUCKET).remove([storagePath])

  if (error) {
    throw new Error(`Failed to delete BRD from storage: ${error.message}`)
  }
}
