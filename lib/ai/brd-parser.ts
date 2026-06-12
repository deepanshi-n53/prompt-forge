import { callAI } from './ai-client'
import type { ParsedBRD } from '@/types'

function safeParse(text: string): ParsedBRD {
  // Models occasionally wrap JSON in a fence despite instructions
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  return JSON.parse(stripped) as ParsedBRD
}

export async function parseBRDWithAI(rawText: string): Promise<ParsedBRD> {
  const response = await callAI(
    [
      {
        role:    'system',
        content: 'You are a senior software architect. Extract structured information from the BRD. Return ONLY valid JSON matching ParsedBRD schema. No markdown, no explanation, just JSON.',
      },
      {
        role:    'user',
        content: `Parse this BRD:\n\n${rawText.slice(0, 400_000)}`,
      },
    ],
    4096,
  )

  return safeParse(response.text)
}
