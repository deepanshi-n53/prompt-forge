/**
 * add-template-fields.mjs
 *
 * Reads lib/ai/section-templates.ts and:
 *  1. Adds `owns: string[]` and `depends: string[]` to the SectionTemplate interface
 *  2. Adds `template: string` to the interface (alongside the existing `prompt`)
 *  3. Renames `prompt:` → `template:` in every section definition
 *  4. Injects `owns: [...]` and `depends: [...]` into every section definition
 *  5. Writes the file back
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dir      = dirname(__filename)
const TARGET     = resolve(__dir, '../lib/ai/section-templates.ts')

// ── Lookup table ──────────────────────────────────────────────────────────────
const LOOKUP = {
  '01': { owns: ['productName','platform','appType','monetization','userTypes','targetMarket'], depends: [] },
  '02': { owns: ['features','screens','permissions','stateModel'], depends: ['01'] },
  '03': { owns: ['performanceTargets','slo','securityLevel','dataTypes'], depends: ['01','02'] },
  '04': { owns: ['infraTier','costBudget','scalingStrategy'], depends: ['03'] },
  '05': { owns: ['dbEngine','cacheLayer','apiStyle','multiTenant','architecture'], depends: ['01','02','03','04'] },
  '06': { owns: ['authModel','tokenType','authProvider','roleSystem','sessionLifetime'], depends: ['05'] },
  '07': { owns: ['schema','indexes','migrationStrategy','dbPartitioning'], depends: ['05','06'] },
  '08': { owns: ['endpoints','apiVersioning','responseFormat','errorFormat'], depends: ['05','06','07'] },
  '09': { owns: ['realtimeProtocol','channels','presenceModel'], depends: ['05'] },
  '10': { owns: ['storageProvider','fileTypes','sizeLimits','cdnStrategy'], depends: ['05'] },
  '11': { owns: ['searchEngine','indexStrategy','searchFields'], depends: ['05','07'] },
  '12': { owns: ['thirdPartyServices','sdkChoices','webhookStrategy'], depends: ['05','08'] },
  '13': { owns: ['queueSystem','jobTypes','retryStrategy'], depends: ['05','07'] },
  '14': { owns: ['designSystem','cssFramework','componentLibrary','colorSystem'], depends: ['01'] },
  '15': { owns: ['frontendFramework','stateManagement','bundler','routingStrategy'], depends: ['14','06','08'] },
  '16': { owns: ['rateLimits','quotaModel','throttleStrategy'], depends: ['08'] },
  '17': { owns: ['transactionBoundaries','idempotencyKeys','conflictResolution'], depends: ['07','08'] },
  '18': { owns: ['encryptionAtRest','encryptionInTransit','secretsManagement','trustBoundaries'], depends: ['06','07'] },
  '19': { owns: ['piiClassification','dataRetentionPolicy','anonymizationRules'], depends: ['18'] },
  '20': { owns: ['gdprStatus','complianceTier','auditLogLevel'], depends: ['19','03'] },
  '21': { owns: ['cacheProvider','cacheTtls','cacheInvalidationStrategy'], depends: ['05','07'] },
  '22': { owns: ['circuitBreakerConfig','retryPolicies','bulkheadModel'], depends: ['05','08','12'] },
  '23': { owns: ['perfBudget','loadTestTargets','scalingTriggers'], depends: ['03','04','21'] },
  '24': { owns: ['ciProvider','deployTarget','deployStrategy','envModel'], depends: ['05','26'] },
  '25': { owns: ['threatModel','securityScan','penTestPlan'], depends: ['18','06'] },
  '26': { owns: ['devTools','lintingConfig','envVarPattern'], depends: ['05'] },
  '27': { owns: ['logProvider','tracingProvider','metricsProvider','alertRules'], depends: ['05','24'] },
  '28': { owns: ['analyticsProvider','eventSchema','funnels'], depends: ['01','15'] },
  '29': { owns: ['backupSchedule','archivalPolicy','dataLifecycle'], depends: ['07','19'] },
  '30': { owns: ['testFramework','coverageTargets','testTypes'], depends: ['07','08','15'] },
  '31': { owns: ['i18nFramework','supportedLocales','translationStrategy'], depends: ['14','15'] },
  '32': { owns: ['pluginArchitecture','extensionPoints','versioningStrategy'], depends: ['05','07','08'] },
  'W1': { owns: ['seoStrategy','metaSchema','sitemapConfig'], depends: ['01','08'] },
  'W2': { owns: ['webVitalsTargets','perfBudgetWeb','lazyLoadStrategy'], depends: ['14','15'] },
  'W3': { owns: ['browserMatrix','polyfillStrategy'], depends: ['15'] },
  'W4': { owns: ['pwaStrategy','serviceWorkerScope','offlineMode'], depends: ['15'] },
  'W5': { owns: ['consentBannerConfig','cookieCategories'], depends: ['20','19'] },
  'W6': { owns: ['ogTagSchema','twitterCardSchema','shareStrategy'], depends: ['01','14'] },
  'W7': { owns: ['a11yStandard','ariaStrategy','colorContrastTarget'], depends: ['14'] },
  'W8': { owns: ['urlStructure','routingConventions','redirectStrategy'], depends: ['01','15'] },
  'M1': { owns: ['appStoreStrategy','storeListingStrategy'], depends: ['01'] },
  'M2': { owns: ['versioningScheme','forceUpdateStrategy'], depends: ['01'] },
  'M3': { owns: ['backgroundTaskModel','backgroundLimits'], depends: ['13'] },
  'M4': { owns: ['batteryOptimization','memoryLimits'], depends: ['01'] },
  'M5': { owns: ['permissionFlow','permissionRationale'], depends: ['01'] },
  'M6': { owns: ['biometricAuthProvider','fallbackAuth'], depends: ['06'] },
  'M7': { owns: ['deepLinkScheme','universalLinkDomain'], depends: ['01','08'] },
  'M8': { owns: ['bundleSizeTarget','assetOptimization'], depends: ['14'] },
  'M9': { owns: ['crashReportingProvider','symbolication'], depends: ['24','27'] },
  'M10': { owns: ['otaProvider','updateDeployment'], depends: ['24'] },
  'M11': { owns: ['abTestingProvider','experimentModel'], depends: ['28'] },
  'M12': { owns: ['tabletLayout','splitViewStrategy'], depends: ['14','15'] },
  '3A': { owns: ['marketplaceModel','payoutFlow','listingSchema'], depends: ['01','07','06'] },
  '3B': { owns: ['socialGraph','feedAlgorithm','moderationModel'], depends: ['01','07','09'] },
  '3C': { owns: ['aiModelChoice','promptStrategy','mlPipeline'], depends: ['01','05','13'] },
  '3D': { owns: ['hipaaControls','phiDataFlow','auditTrail'], depends: ['18','19','20'] },
  '3E': { owns: ['offlineDataModel','conflictResolutionModel','syncProtocol'], depends: ['07','13'] },
}

function fmt(arr) {
  if (arr.length === 0) return '[]'
  return `[${arr.map(s => `'${s}'`).join(', ')}]`
}

// ── Read source ───────────────────────────────────────────────────────────────
let src = readFileSync(TARGET, 'utf8')

// ── Step 1: Update the interface ──────────────────────────────────────────────
// Add `template`, `owns`, and `depends` if not already present
if (!src.includes('template:')) {
  // Insert after the `prompt:` line in the interface
  src = src.replace(
    /(\s+prompt:\s+string)/,
    '$1\n  template:    string'
  )
}
if (!src.includes('owns:')) {
  // Insert after `agentHint` line in the interface
  src = src.replace(
    /(\s+agentHint:\s+string)/,
    '$1\n  owns:        string[]\n  depends:     string[]'
  )
}

// ── Step 2: Process each section entry ───────────────────────────────────────
// We'll work through the LOOKUP keys and inject/update fields for each.

for (const [num, { owns, depends }] of Object.entries(LOOKUP)) {
  // Escape the num for use in a regex (dots, etc.)
  const escapedNum = num.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Pattern: find the section block starting with '  'XX': {' and ending before the next
  // top-level key (another '  'XX': {' or the closing '};'
  // We process prompt→template rename ONLY if not already renamed.

  // ── 2a. Rename `prompt:` → `template:` inside this section ──────────────
  // Find the section object for this num and rename its `prompt:` field.
  // We look for the num key, then find the next `prompt:` within that block.
  // Strategy: replace `    prompt:` that appears after `'num':` and before the next section key.
  // We'll use a stateful regex approach by processing section-by-section.

  // Build a regex that matches this section's block.
  // The block starts with `  'NUM': {` and ends just before `  'NEXT': {` or `}`
  // Since sections are long strings, we use a non-greedy approach on the prompt field only.

  // Simple targeted replacement: within the section identified by its num,
  // rename `    prompt:` → `    template:` (first occurrence after the key).
  // We'll do this by replacing `'NUM':\s*\{[^]*?prompt:` → `'NUM': { ... template:`
  // but that's fragile. Instead, do a two-pass: mark section boundaries, transform.

  // Practical approach: since each section has exactly one `prompt:` field,
  // we can safely replace `prompt:` → `template:` globally (they're all the same field).
  // But we need to be careful not to rename the interface's `prompt: string` — except
  // we actually WANT to keep `prompt` in the interface too (for backwards compat).
  // So we'll only rename inside object literals (where the value is a template string).
  // The object literal `prompt:` is followed by ` "` or ` '` — not ` string`.
}

// ── 2a (global): rename `    prompt:` (4 spaces, inside section bodies) → `    template:`
// The interface uses `  prompt:` (2 spaces). Section bodies use `    prompt:` (4 spaces).
src = src.replace(/^    prompt:/gm, '    template:')

// ── 2b: Inject `owns` and `depends` after `agentHint:` in each section ──────
// We'll process section by section using a regex that finds each section block.
// Strategy: split on section start markers, process each chunk.

const processedNums = new Set()

src = src.replace(
  // Match a section entry: key, opening brace, all content up to the closing brace+comma
  // We anchor on `  'NUM': {` pattern and capture up to the next `  '` or end of SECTION_TEMPLATES
  /('(\w+)':\s*\{[\s\S]*?agentHint:\s*"[\s\S]*?",?\n  \},?)/g,
  (match, _full, num) => {
    const entry = LOOKUP[num]
    if (!entry) return match  // not in our table — leave unchanged

    // Check if already has owns/depends
    if (match.includes('owns:') || match.includes('depends:')) {
      processedNums.add(num)
      return match
    }

    // Find the position of agentHint closing and insert after it
    // The agentHint value ends with `",` then newline then `  },`
    // Insert owns and depends before the closing `  },`
    const injected = match.replace(
      /(agentHint:\s*"[\s\S]*?",?\n)(  \},?)/,
      `$1    owns:      ${fmt(entry.owns)},\n    depends:   ${fmt(entry.depends)},\n$2`
    )

    processedNums.add(num)
    return injected
  }
)

// ── Step 3: Write back ────────────────────────────────────────────────────────
writeFileSync(TARGET, src, 'utf8')

console.log(`✓ Wrote ${TARGET}`)
console.log(`  Processed ${processedNums.size} sections: ${[...processedNums].join(', ')}`)
console.log(`  Lookup table has ${Object.keys(LOOKUP).length} entries`)

// Quick sanity check
const written = readFileSync(TARGET, 'utf8')
const ownsCount = (written.match(/owns:/g) || []).length
const templateCount = (written.match(/^\s{4}template:/gm) || []).length
console.log(`  owns: fields in file: ${ownsCount}`)
console.log(`  template: fields in file: ${templateCount}`)
