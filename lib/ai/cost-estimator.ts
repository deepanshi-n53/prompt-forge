// Cost metering for AI generation runs.
//
// One CostMeter is created per generation run. Each AI call is metered — using
// the provider's real token usage when available, otherwise estimated from the
// prompt + response text — and the run's total cost (in integer cents) is folded
// into the project's accumulated cost via addRunToTotal.

// ── Token usage ───────────────────────────────────────────────────────────────

export interface TokenUsage {
  inputTokens:  number
  outputTokens: number
  // The model that actually produced this call — used to price the call. Absent
  // for providers/paths without a real model (e.g. the mock provider).
  model?:       string
}

// One metered sample. Provide `usage` (real provider counts) when available; the
// `*Text` / `*Chars` fields are the fallback used to estimate tokens otherwise.
// `model` (or usage.model) drives per-call pricing; both absent → the meter's
// default model is used.
export interface MeterSample {
  usage?:       TokenUsage | null
  model?:       string
  inputText?:   string
  outputText?:  string
  inputChars?:  number
  outputChars?: number
}

// ── Pricing ───────────────────────────────────────────────────────────────────
// USD list price per 1M tokens, expressed in cents (so $2.50 → 250). Unknown
// models fall back to gpt-4o pricing — never free, so cost is never undercounted.

interface ModelPrice {
  inputCentsPerM:  number
  outputCentsPerM: number
}

const PRICING: Record<string, ModelPrice> = {
  'gpt-4o':            { inputCentsPerM: 250, outputCentsPerM: 1000 },
  'gpt-4o-mini':       { inputCentsPerM: 15,  outputCentsPerM: 60   },
  'claude-sonnet-4-6': { inputCentsPerM: 300, outputCentsPerM: 1500 },
}

const DEFAULT_MODEL = 'gpt-4o'

// Base-model keys, longest first, so prefix matching prefers the most specific
// (e.g. "gpt-4o-mini" before "gpt-4o" — both are prefixes of "gpt-4o-mini-…").
const PRICING_KEYS = Object.keys(PRICING).sort((a, b) => b.length - a.length)

function priceFor(model: string): ModelPrice {
  // Exact hit first.
  const exact = PRICING[model]
  if (exact) return exact
  // Providers echo dated snapshots ("gpt-4o-mini-2024-07-18", "gpt-4o-2024-08-06")
  // that aren't table keys. Match the longest base-model key the name starts with
  // so a snapshot is priced as its base model — NOT silently charged at the
  // pricier gpt-4o default (the bug that overcounted gpt-4o-mini runs ~16x).
  const base = PRICING_KEYS.find((k) => model.startsWith(k))
  return PRICING[base ?? DEFAULT_MODEL] ?? PRICING[DEFAULT_MODEL]
}

// Rough token estimate when no real usage is available: ~4 characters per token.
const CHARS_PER_TOKEN = 4

function estimateTokensFromChars(chars: number): number {
  return Math.ceil(Math.max(0, chars) / CHARS_PER_TOKEN)
}

function sampleTokens(sample: MeterSample): TokenUsage {
  const u = sample.usage
  if (u && (u.inputTokens > 0 || u.outputTokens > 0)) {
    return { inputTokens: Math.max(0, u.inputTokens), outputTokens: Math.max(0, u.outputTokens) }
  }
  const inChars  = sample.inputChars  ?? sample.inputText?.length  ?? 0
  const outChars = sample.outputChars ?? sample.outputText?.length ?? 0
  return {
    inputTokens:  estimateTokensFromChars(inChars),
    outputTokens: estimateTokensFromChars(outChars),
  }
}

// Cost of a given token count, in (fractional) cents.
function costCents(model: string, usage: TokenUsage): number {
  const p = priceFor(model)
  return (usage.inputTokens / 1_000_000) * p.inputCentsPerM
    +    (usage.outputTokens / 1_000_000) * p.outputCentsPerM
}

// ── CostMeter ─────────────────────────────────────────────────────────────────

export interface CostSummary {
  model:        string
  calls:        number
  inputTokens:  number
  outputTokens: number
  cents:        number // fractional cents for the whole run
}

export class CostMeter {
  // Fallback model — only used to price a call that reports no model of its own.
  private readonly defaultModel: string
  private calls        = 0
  private inputTokens  = 0
  private outputTokens = 0
  private cents        = 0 // accumulated, priced per-call with each call's model

  constructor(defaultModel: string = DEFAULT_MODEL) {
    this.defaultModel = defaultModel
  }

  // Record one AI call. Safe to call with partial data — falls back to estimate.
  // Each call is priced with the model it actually used (usage.model / model),
  // so a run that mixes models (e.g. gpt-4o-mini sections) is costed correctly.
  meter(sample: MeterSample): void {
    const { inputTokens, outputTokens } = sampleTokens(sample)
    const model = sample.usage?.model ?? sample.model ?? this.defaultModel

    this.cents        += costCents(model, { inputTokens, outputTokens })
    this.inputTokens  += inputTokens
    this.outputTokens += outputTokens
    this.calls        += 1
  }

  // Total cost of everything metered so far, in fractional cents.
  get runTotalCents(): number {
    return this.cents
  }

  summary(): CostSummary {
    return {
      model:        this.defaultModel,
      calls:        this.calls,
      inputTokens:  this.inputTokens,
      outputTokens: this.outputTokens,
      cents:        this.cents,
    }
  }
}

// Fold a run's cost into a project's accumulated total. Both are rounded to whole
// cents (the stored column is an Int); result is never negative.
export function addRunToTotal(currentTotalCents: number, runCents: number): number {
  return Math.max(0, Math.round(currentTotalCents) + Math.round(runCents))
}
