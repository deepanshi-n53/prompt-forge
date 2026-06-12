import { emailLayout, ctaButton } from './_base'

export const WELCOME_SUBJECT = "Welcome to PromptForge — let's build something"

export function welcomeEmailHTML(name: string): string {
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const cta     = ctaButton('Upload Your First BRD', `${appUrl}/dashboard`)
  const greeting = name ? `Hi ${name},` : 'Welcome,'

  return emailLayout(`
    <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#09090b;">${greeting}</p>
    <p style="margin:0 0 16px;">
      Your PromptForge account is ready. Upload a Business Requirement Document and we&rsquo;ll
      turn it into production-ready architecture prompts for Claude&nbsp;Code, Cursor, Lovable,
      and Bolt &mdash; in minutes.
    </p>
    <p style="margin:0 0 8px;"><strong>Here&rsquo;s what happens next:</strong></p>
    <ol style="margin:0 0 16px;padding-left:20px;color:#52525b;">
      <li style="margin-bottom:6px;">Upload your BRD (PDF, Word, or plain text)</li>
      <li style="margin-bottom:6px;">Claude parses your requirements and surfaces key decisions</li>
      <li style="margin-bottom:6px;">Answer a few clarifying questions</li>
      <li>Receive tailored prompts, ready to paste into your AI coding agent</li>
    </ol>
    <p style="margin:24px 0 0;">
      ${cta}
    </p>
    <p style="margin:24px 0 0;font-size:13px;color:#71717a;">
      Questions? Reply to this email or reach us at
      <a href="mailto:hello@promptforge.dev" style="color:#2563eb;text-decoration:none;">hello@promptforge.dev</a>.
    </p>
  `)
}
