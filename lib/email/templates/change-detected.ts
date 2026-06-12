import { emailLayout, ctaButton } from './_base'

export function changeDetectedSubject(breakingCount: number): string {
  return `BRD change detected — ${breakingCount} section${breakingCount !== 1 ? 's' : ''} affected`
}

export function changeDetectedEmailHTML(
  name:          string,
  projectName:   string,
  breakingCount: number,
  projectId:     string,
): string {
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const cta      = ctaButton('Review Impact', `${appUrl}/project/${projectId}/changes`)
  const greeting = name ? `Hi ${name},` : 'Heads up,'

  const impactLine =
    breakingCount === 0
      ? 'No breaking changes were found — your existing prompts should still apply.'
      : breakingCount === 1
        ? 'Claude identified <strong>1 breaking change</strong> that will require a prompt update.'
        : `Claude identified <strong>${breakingCount} breaking changes</strong> that will require prompt updates.`

  return emailLayout(`
    <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#09090b;">${greeting}</p>
    <p style="margin:0 0 16px;">
      A new version of the BRD for <strong>${escHtml(projectName)}</strong> has been uploaded
      and analysed. ${impactLine}
    </p>

    ${breakingCount > 0 ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background-color:#fef2f2;border-left:3px solid #ef4444;border-radius:4px;margin:16px 0;">
      <tr>
        <td style="padding:14px 16px;font-size:14px;color:#991b1b;">
          <strong>${breakingCount} section${breakingCount !== 1 ? 's' : ''} need${breakingCount === 1 ? 's' : ''} to be regenerated</strong>
          before you can use the updated prompts.
        </td>
      </tr>
    </table>` : `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background-color:#f0fdf4;border-left:3px solid #22c55e;border-radius:4px;margin:16px 0;">
      <tr>
        <td style="padding:14px 16px;font-size:14px;color:#166534;">
          Your existing prompts are still valid for this revision.
        </td>
      </tr>
    </table>`}

    <p style="margin:0 0 16px;">
      Open the change review page to see a full breakdown of which sections are affected,
      then confirm to regenerate only the impacted prompts.
    </p>
    <p style="margin:24px 0 0;">
      ${cta}
    </p>
  `)
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
