/** Wraps email body content in a consistent branded layout. */
export function emailLayout(body: string): string {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
         style="background-color:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
               style="max-width:560px;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">

          <!-- header -->
          <tr>
            <td style="background-color:#09090b;padding:22px 32px;">
              <span style="color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:17px;font-weight:700;letter-spacing:-0.3px;">
                PromptForge
              </span>
            </td>
          </tr>

          <!-- body -->
          <tr>
            <td style="padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.65;color:#3f3f46;">
              ${body}
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="background-color:#fafafa;border-top:1px solid #e4e4e7;padding:18px 32px;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#a1a1aa;">
                &copy; ${year} PromptForge &mdash; you&rsquo;re receiving this because you have an account at
                <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}" style="color:#a1a1aa;">promptforge.dev</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Renders a solid blue CTA button. */
export function ctaButton(label: string, href: string): string {
  return `<a href="${href}"
     style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;margin-top:24px;">
    ${label}
  </a>`
}
