import type { ParsedBRD } from '@/types'

const SIGNALS: Record<string, string[]> = {
  marketplace:    ['booking', 'walkers', 'drivers', 'sellers', 'buyers', 'commission', 'gig', 'freelance', 'host'],
  'b2b-saas':     ['teams', 'organizations', 'workspace', 'admin', 'enterprise', 'sso', 'roles', 'permissions', 'billing', 'seats'],
  'consumer-app': ['social', 'feed', 'followers', 'profile', 'notifications', 'friends', 'likes', 'posts'],
  ecommerce:      ['cart', 'checkout', 'products', 'inventory', 'orders', 'shipping', 'payment', 'catalogue'],
  'ai-tool':      ['ai', 'generate', 'prompt', 'model', 'embeddings', 'stream', 'llm', 'inference', 'fine-tune'],
}

export function detectArchetype(parsedBRD: ParsedBRD): { archetype: string; confidence: number } {
  // Build a single lowercase text blob from all relevant BRD fields
  const corpus = [
    parsedBRD.productPurpose,
    parsedBRD.monetizationModel,
    parsedBRD.scalingHints,
    ...parsedBRD.userTypes,
    ...parsedBRD.coreFeatures.map((f) => `${f.name} ${f.description} ${f.category}`),
    ...parsedBRD.complianceHints,
    ...parsedBRD.integrationHints,
  ]
    .join(' ')
    .toLowerCase()

  let bestArchetype = 'b2b-saas'
  let bestScore = 0

  for (const [archetype, keywords] of Object.entries(SIGNALS)) {
    const hits = keywords.filter((kw) => corpus.includes(kw)).length
    const score = hits / keywords.length
    if (score > bestScore) {
      bestScore = score
      bestArchetype = archetype
    }
  }

  // Also factor in parsedBRD.archetype if Claude already detected one
  if (parsedBRD.archetype && parsedBRD.archetypeConfidence > bestScore) {
    return { archetype: parsedBRD.archetype, confidence: parsedBRD.archetypeConfidence }
  }

  return {
    archetype: bestArchetype,
    confidence: Math.min(bestScore * 2, 1), // scale up — keyword matching is conservative
  }
}
