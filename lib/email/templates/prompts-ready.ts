import { emailLayout, ctaButton } from './_base'

export function promptsReadySubject(projectName: string): string {
  return `Your prompts are ready — ${projectName}`
}

export function promptsReadyEmailHTML(
  name:         string,
  projectName:  string,
  sectionCount: number,
  projectId:    string,
): string {
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const cta     = ctaButton('View Prompts', `${appUrl}/project/${projectId}/prompts`)
  const greeting = name ? `Hi ${name},` : 'Great news,'

  return emailLayout(`
    <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#09090b;">${greeting}</p>
    <p style="margin:0 0 16px;">
      Your architecture prompts for <strong>${escHtml(projectName)}</strong> are ready.
      We&rsquo;ve generated <strong>${sectionCount} section${sectionCount !== 1 ? 's' : ''}</strong>
      covering everything from data models to deployment — each tailored to your BRD.
    </p>
    <p style="margin:0 0 16px;">
      Each prompt is formatted for your chosen AI coding agent (Claude&nbsp;Code, Cursor, Lovable,
      or Bolt) and ready to paste directly into a new project.
    </p>
    <p style="margin:0 0 8px;"><strong>What to do next:</strong></p>
    <ol style="margin:0 0 16px;padding-left:20px;color:#52525b;">
      <li style="margin-bottom:6px;">Open the prompt browser and pick your agent format</li>
      <li style="margin-bottom:6px;">Copy the relevant sections</li>
      <li>Paste into your AI coding agent and start building</li>
    </ol>
    <p style="margin:24px 0 0;">
      ${cta}
    </p>
  `)
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
