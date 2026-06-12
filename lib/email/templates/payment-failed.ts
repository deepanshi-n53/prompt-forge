import { emailLayout, ctaButton } from './_base'

export const PAYMENT_FAILED_SUBJECT = 'Action required: payment failed for PromptForge'

export function paymentFailedEmailHTML(name: string): string {
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const cta      = ctaButton('Update Payment Method', `${appUrl}/account/billing`)
  const greeting = name ? `Hi ${name},` : 'Hi there,'

  return emailLayout(`
    <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#09090b;">${greeting}</p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background-color:#fef2f2;border-left:3px solid #ef4444;border-radius:4px;margin:0 0 20px;">
      <tr>
        <td style="padding:14px 16px;font-size:14px;color:#991b1b;">
          <strong>Your last payment did not go through.</strong> Your account will remain active
          for 7 more days while you update your details.
        </td>
      </tr>
    </table>

    <p style="margin:0 0 12px;">
      To keep your PromptForge subscription active, please update your payment method as soon
      as possible.
    </p>
    <p style="margin:0 0 8px;"><strong>How to fix this:</strong></p>
    <ol style="margin:0 0 16px;padding-left:20px;color:#52525b;">
      <li style="margin-bottom:6px;">Click the button below to open your billing page</li>
      <li style="margin-bottom:6px;">Click <strong>Manage billing</strong> to open the secure payment portal</li>
      <li>Update your card details and confirm</li>
    </ol>
    <p style="margin:0 0 16px;font-size:13px;color:#71717a;">
      If your payment is not updated within 7 days, your account will be downgraded to the
      Free plan and you will lose access to paid features.
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
