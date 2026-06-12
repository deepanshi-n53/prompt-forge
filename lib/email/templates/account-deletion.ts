import { emailLayout, ctaButton } from './_base'

export const ACCOUNT_DELETION_SUBJECT = 'Your PromptForge account is scheduled for deletion'

export function accountDeletionEmailHTML(name: string): string {
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const cta      = ctaButton('Cancel Deletion', `${appUrl}/account/privacy`)
  const greeting = name ? `Hi ${name},` : 'Hi there,'

  return emailLayout(`
    <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#09090b;">${greeting}</p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background-color:#fef2f2;border-left:3px solid #ef4444;border-radius:4px;margin:0 0 20px;">
      <tr>
        <td style="padding:14px 16px;font-size:14px;color:#991b1b;">
          <strong>Your account has been scheduled for deletion.</strong> All your data will be
          permanently deleted in <strong>30 days</strong>.
        </td>
      </tr>
    </table>

    <p style="margin:0 0 12px;">
      We've received your request to delete your PromptForge account. Here's what will happen:
    </p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#52525b;">
      <li style="margin-bottom:6px;">Your account will be deactivated immediately</li>
      <li style="margin-bottom:6px;">All projects, BRDs, and generated prompts will be deleted after 30 days</li>
      <li style="margin-bottom:6px;">Your Stripe subscription will be cancelled at the end of the billing period</li>
      <li>This action cannot be undone after the 30-day window</li>
    </ul>
    <p style="margin:0 0 16px;">
      If you did not request this or changed your mind, you can cancel the deletion within the
      next 30 days by visiting your privacy settings.
    </p>
    <p style="margin:24px 0 0;">
      ${cta}
    </p>
    <p style="margin:24px 0 0;font-size:13px;color:#71717a;">
      Need help? Reply to this email or contact us at
      <a href="mailto:hello@promptforge.dev" style="color:#2563eb;text-decoration:none;">hello@promptforge.dev</a>.
    </p>
  `)
}
