import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

let transporterInstance: Transporter | null = null

function getTransporter(): Transporter {
  if (!transporterInstance) {
    transporterInstance = nodemailer.createTransport({
      host:   process.env.EMAIL_HOST,
      port:   Number(process.env.EMAIL_PORT),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })
  }
  return transporterInstance
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[email]', { to, subject, html })
    return
  }

  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    })
  } catch (err) {
    console.error('[email] failed to send', { to, subject, error: err })
  }
}
