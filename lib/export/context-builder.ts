import type { ParsedBRD } from '@/types/brd'
import type { SectionDecision } from '@/types/decision'

export interface ProjectMeta {
  id:          string
  name:        string
  archetype:   string | null
  track:       string
  description: string | null
}

export function buildContextBlock(
  project: ProjectMeta,
  sections: Record<string, SectionDecision>,
  parsedBRD: ParsedBRD,
): string {
  const s03 = sections['§03']?.decisions as Record<string, unknown> | undefined
  const s17 = sections['§17']?.decisions as Record<string, unknown> | undefined
  const s18 = sections['§18']?.decisions as Record<string, unknown> | undefined
  const s20 = sections['§20']?.decisions as Record<string, unknown> | undefined

  const lines: string[] = [
    '## PROJECT_CONTEXT',
    '',
    `**Product:** ${project.name}`,
    `**Type:** ${project.archetype ?? parsedBRD.archetype ?? 'SaaS'}`,
    `**Track:** ${project.track}`,
    `**Platform:** ${parsedBRD.platform ?? 'web'}`,
    '',
    '### Product',
    parsedBRD.productPurpose
      ? `${parsedBRD.productPurpose}`
      : `${project.description ?? 'A SaaS application.'}`,
    '',
    '### Users',
    (parsedBRD.userTypes?.length
      ? parsedBRD.userTypes.map((u) => `- ${u}`).join('\n')
      : '- User'),
    '',
    '### Key Decisions',
    `- **Billing model:** ${String(s17?.billing_model ?? parsedBRD.monetizationModel ?? 'subscription')}`,
    `- **Security level:** ${String(s18?.security_level ?? 'STANDARD')}`,
    `- **Compliance:** ${
      Array.isArray(s20?.compliance_flags)
        ? (s20.compliance_flags as string[]).join(', ')
        : 'none-identified'
    }`,
    `- **Year-1 scale:** ${String(s03?.expected_users_year1 ?? '1,000-10,000')}`,
    `- **Infra tier:** ${String(s03?.infra_tier ?? 'starter')}`,
  ]

  if (parsedBRD.integrationHints?.length) {
    lines.push('')
    lines.push('### Integrations')
    lines.push(parsedBRD.integrationHints.slice(0, 8).map((h) => `- ${h}`).join('\n'))
  }

  if (parsedBRD.coreFeatures?.length) {
    const must = parsedBRD.coreFeatures.filter((f) => f.priority === 'MUST').slice(0, 6)
    if (must.length) {
      lines.push('')
      lines.push('### Core Features (MUST)')
      lines.push(must.map((f) => `- **${f.name}:** ${f.description}`).join('\n'))
    }
  }

  return lines.join('\n')
}

export function buildUiContextBlock(
  project: ProjectMeta,
  parsedBRD: ParsedBRD,
): string {
  return [
    '## PROJECT_CONTEXT (UI)',
    '',
    `**Product:** ${project.name}`,
    `**Platform:** ${parsedBRD.platform ?? 'web'}`,
    '',
    parsedBRD.productPurpose ?? project.description ?? '',
    '',
    '### User Types',
    (parsedBRD.userTypes?.length
      ? parsedBRD.userTypes.map((u) => `- ${u}`).join('\n')
      : '- User'),
    '',
    '### Core Features',
    (parsedBRD.coreFeatures ?? [])
      .filter((f) => f.priority === 'MUST')
      .slice(0, 5)
      .map((f) => `- ${f.name}`)
      .join('\n'),
  ].join('\n')
}
