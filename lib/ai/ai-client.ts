import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { Ollama } from 'ollama'

interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AIResponse {
  text: string
}

interface AICallOptions {
  temperature?: number
  seed?:        number
}

export async function callAI(
  messages: AIMessage[],
  maxTokens: number = 4000,
  options: AICallOptions = {},
): Promise<AIResponse> {
  const provider = process.env.AI_PROVIDER ?? 'openai'

  if (provider === 'mock') {
    const sectionNum = messages[messages.length - 1]?.content?.match(/SECTION TEMPLATE.*?(\d+)/)?.[1] ?? '01'
    return {
      text: JSON.stringify({
        content: `# Section ${sectionNum} - Generated Architecture\n\nThis is a mock generated prompt for section ${sectionNum}.\nReplace AI_PROVIDER=openai in Railway to get real AI-generated content.`,
        confidence: 0.9,
        assumptions: [],
      }),
    }
  }

  if (provider === 'ollama') {
    const ollama = new Ollama({
      host: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
    })
    const response = await ollama.chat({
      model:    process.env.OLLAMA_MODEL ?? 'llama3.1:8b',
      messages: messages,
    })
    return { text: response.message.content }
  }

  if (provider === 'anthropic') {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
    const systemMsg    = messages.find((m) => m.role === 'system')?.content ?? ''
    const userMessages = messages.filter((m) => m.role !== 'system')
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system:     systemMsg,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      messages:   userMessages.map((m) => ({
        role:    m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })
    return {
      text: response.content[0].type === 'text' ? response.content[0].text : '',
    }
  }

  // Default: OpenAI
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  const response = await openai.chat.completions.create({
    model:      'gpt-4o',
    max_tokens: maxTokens,
    messages:   messages,
    // Greedy, reproducible decoding when the caller asks for it (e.g. BRD
    // extraction) — same input → same output, so health scores stay stable.
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
  })
  return { text: response.choices[0].message.content ?? '' }
}
