import type { ArchitectureDecisions } from '@/types/brd'

// Opinionated defaults for every architecture field that should NEVER block
// generation. The cascade applies these to any field the BRD + wizard left
// null/undefined, so generation always proceeds with a complete, sensible stack
// instead of pausing to ask. This is the core of the "remove all pauses except 3"
// fix: dbEngine, authMethod, cacheLayer, … all resolve to a default and continue.
//
// Deliberately EXCLUDES needsRealtime and hipaaRequired — those stay unset so
// their (low-confidence) pauses can still fire when the answer is truly unknown.
export const ARCHITECTURE_DEFAULTS: Partial<ArchitectureDecisions> = {
  dbEngine:            'PostgreSQL',
  cacheLayer:          'Redis',
  searchEngine:        'pg-fulltext',
  apiStyle:            'REST',
  authMethod:          'JWT',
  deploymentModel:     'modular-monolith',
  tenancyModel:        'row-level',
  cloudProvider:       'Railway',
  componentLibrary:    'shadcn/ui',
  emailProvider:       'Resend',
  fileStorageProvider: 'Supabase Storage',
  darkModeRequired:    false,
  needsPublicAPI:      false,
}

// Fill ONLY null/undefined fields — never overwrite a value the BRD or the user
// already set. mfaRequired defaults to true when HIPAA applies, false otherwise.
export function applyArchitectureDefaults(d: ArchitectureDecisions): ArchitectureDecisions {
  const out = { ...d } as Record<string, unknown>

  for (const [key, value] of Object.entries(ARCHITECTURE_DEFAULTS)) {
    if (out[key] == null) out[key] = value
  }

  if (out.mfaRequired == null) out.mfaRequired = out.hipaaRequired === true

  return out as unknown as ArchitectureDecisions
}
