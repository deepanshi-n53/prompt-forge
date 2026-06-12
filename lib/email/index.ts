import { sendEmail } from './mailer'
import { WELCOME_SUBJECT, welcomeEmailHTML } from './templates/welcome'
import { promptsReadySubject, promptsReadyEmailHTML } from './templates/prompts-ready'
import { changeDetectedSubject, changeDetectedEmailHTML } from './templates/change-detected'
import { PAYMENT_FAILED_SUBJECT, paymentFailedEmailHTML } from './templates/payment-failed'
import { ACCOUNT_DELETION_SUBJECT, accountDeletionEmailHTML } from './templates/account-deletion'

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  try {
    await sendEmail({ to, subject: WELCOME_SUBJECT, html: welcomeEmailHTML(name) })
  } catch (err) {
    console.error('[email] sendWelcomeEmail failed', { to, err })
  }
}

export async function sendPromptsReadyEmail(
  to:           string,
  name:         string,
  projectName:  string,
  sectionCount: number,
  projectId:    string,
): Promise<void> {
  try {
    await sendEmail({
      to,
      subject: promptsReadySubject(projectName),
      html:    promptsReadyEmailHTML(name, projectName, sectionCount, projectId),
    })
  } catch (err) {
    console.error('[email] sendPromptsReadyEmail failed', { to, projectId, err })
  }
}

export async function sendChangeDetectedEmail(
  to:            string,
  name:          string,
  projectName:   string,
  breakingCount: number,
  projectId:     string,
): Promise<void> {
  try {
    await sendEmail({
      to,
      subject: changeDetectedSubject(breakingCount),
      html:    changeDetectedEmailHTML(name, projectName, breakingCount, projectId),
    })
  } catch (err) {
    console.error('[email] sendChangeDetectedEmail failed', { to, projectId, err })
  }
}

export async function sendPaymentFailedEmail(to: string, name: string): Promise<void> {
  try {
    await sendEmail({ to, subject: PAYMENT_FAILED_SUBJECT, html: paymentFailedEmailHTML(name) })
  } catch (err) {
    console.error('[email] sendPaymentFailedEmail failed', { to, err })
  }
}

export async function sendAccountDeletionEmail(to: string, name: string): Promise<void> {
  try {
    await sendEmail({ to, subject: ACCOUNT_DELETION_SUBJECT, html: accountDeletionEmailHTML(name) })
  } catch (err) {
    console.error('[email] sendAccountDeletionEmail failed', { to, err })
  }
}
