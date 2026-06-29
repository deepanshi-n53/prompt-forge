// Cross-project answer defaults.
//
// Some setup answers are genuine USER PREFERENCES that sensibly carry from one
// project to the next — the database engine you always reach for, your cloud
// provider, the compliance regimes you operate under, whether you ship i18n.
// Others are specific to a single app's identity or shape (its name, type, user
// types, core features) and must NEVER leak into a different project.
//
// Only the fields below are remembered (per user) and offered as editable
// pre-fills in a later project's setup wizard. They are never applied silently —
// the wizard shows them flagged "from your previous answers" for the user to
// confirm or change.

export const PORTABLE_DEFAULT_FIELDS: readonly string[] = [
  // Stack
  'dbEngine', 'cacheLayer', 'searchEngine',
  'cloudProvider', 'deploymentModel',
  'authMethod', 'mfaRequired', 'socialProviders',
  'apiStyle', 'needsPublicAPI',
  'componentLibrary', 'darkModeRequired',
  'emailProvider', 'paymentProvider',
  'realtimeMethod', 'fileStorageProvider',
  'tenancyModel',
  // Compliance
  'gdprRequired', 'hipaaRequired', 'pciRequired',
  // Internationalisation
  'multiLanguage', 'languages',
]

const PORTABLE_SET = new Set(PORTABLE_DEFAULT_FIELDS)

export function isPortableDefaultField(field: string): boolean {
  return PORTABLE_SET.has(field)
}
