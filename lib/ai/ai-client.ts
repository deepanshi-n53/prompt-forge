import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { Ollama } from 'ollama'
import type { TokenUsage } from './cost-estimator'

// Startup guard — runs once at module load. Production must serve real,
// hosted-model prompts: never fake ('mock') or a local model ('ollama'), and
// never an unset provider (which would silently fall through to a default).
// Fail fast and loud so a misconfigured deploy can't ship generic prompts.
if (process.env.NODE_ENV === 'production') {
  const provider = process.env.AI_PROVIDER
  if (provider === 'mock' || provider === 'ollama' || !provider) {
    throw new Error(
      `Invalid AI_PROVIDER "${provider ?? '(unset)'}" in production. ` +
        'Set AI_PROVIDER=openai (or anthropic) — mock and ollama are dev-only.',
    )
  }
}

interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AIResponse {
  text: string
  // Real provider token counts when available — used for cost metering. Omitted
  // by the mock provider, which has no usage; callers fall back to estimating.
  usage?: TokenUsage
}

interface AICallOptions {
  temperature?: number
  seed?:        number
  // Override the OpenAI model for this call (default 'gpt-4o'). Lets cheap,
  // high-volume calls (section generation) run on a smaller model while BRD
  // parsing / change detection stay on the default. Ignored by other providers.
  model?:       string
  // Per-request OpenAI timeout (ms) and retry count. A hung socket aborts at the
  // timeout and the SDK retries, so one stalled call can't block a whole
  // generation wave until the SDK's 10-minute default. Ignored by other providers.
  timeoutMs?:   number
  maxRetries?:  number
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
    const ollamaModel = process.env.OLLAMA_MODEL ?? 'llama3.1:8b'
    const ollama = new Ollama({
      host: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
    })
    const response = await ollama.chat({
      model:    ollamaModel,
      messages: messages,
    })
    return {
      text:  response.message.content,
      usage: {
        inputTokens:  response.prompt_eval_count ?? 0,
        outputTokens: response.eval_count        ?? 0,
        model:        ollamaModel,
      },
    }
  }

  if (provider === 'anthropic') {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
    const systemMsg    = messages.find((m) => m.role === 'system')?.content ?? ''
    const userMessages = messages.filter((m) => m.role !== 'system')
    const anthropicModel = 'claude-sonnet-4-6'
    const response = await anthropic.messages.create({
      model:      anthropicModel,
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
      usage: {
        inputTokens:  response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model:        anthropicModel,
      },
    }
  }

  // Default: OpenAI
  const openaiModel = options.model ?? 'gpt-4o'
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  const response = await openai.chat.completions.create(
    {
      model:      openaiModel,
      max_tokens: maxTokens,
      messages:   messages,
      // Greedy, reproducible decoding when the caller asks for it (e.g. BRD
      // extraction) — same input → same output, so health scores stay stable.
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.seed !== undefined ? { seed: options.seed } : {}),
    },
    // Per-request timeout + retry: a stalled call aborts and is retried instead
    // of hanging the wave. Defaults leave the SDK's built-in behaviour untouched.
    {
      ...(options.timeoutMs !== undefined ? { timeout: options.timeoutMs } : {}),
      ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
    },
  )
  return {
    text:  response.choices[0].message.content ?? '',
    ...(response.usage ? {
      usage: {
        inputTokens:  response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        // Prefer the model the API echoes back; fall back to what we requested.
        model:        response.model ?? openaiModel,
      },
    } : {}),
  }
}
