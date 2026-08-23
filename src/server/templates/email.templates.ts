interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailLayout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#172033">
    <div style="max-width:600px;margin:0 auto;padding:32px 16px">
      <div style="background:#ffffff;border:1px solid #e5eaf2;border-radius:14px;padding:32px">
        <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#172554">
          AI Study Assistant
        </p>
        ${body}
        <hr style="border:0;border-top:1px solid #e5eaf2;margin:32px 0 20px" />
        <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6">
          This automated security message was sent by AI Study Assistant.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

function actionButton(label: string, url: string): string {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);

  return `<p style="margin:28px 0">
    <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">
      ${safeLabel}
    </a>
  </p>`;
}

export function verificationEmailTemplate(
  verificationUrl: string,
): EmailTemplate {
  const safeUrl = escapeHtml(verificationUrl);
  const subject = "Verify your email — AI Study Assistant";

  return {
    subject,
    html: emailLayout(
      subject,
      `<h1 style="margin:0 0 16px;font-size:24px">Verify your email address</h1>
      <p style="font-size:15px;line-height:1.7;color:#475569">
        Confirm your email address to activate your AI Study Assistant account.
      </p>
      ${actionButton("Verify email", verificationUrl)}
      <p style="font-size:13px;line-height:1.7;color:#64748b">
        This link expires in 24 hours. If the button does not work, copy this URL:<br />
        <span style="word-break:break-all">${safeUrl}</span>
      </p>
      <p style="font-size:13px;line-height:1.7;color:#64748b">
        If you did not create this account, you can ignore this email.
      </p>`,
    ),
    text: [
      "Verify your AI Study Assistant account",
      "",
      "Open this link to verify your email:",
      verificationUrl,
      "",
      "This link expires in 24 hours.",
      "If you did not create this account, ignore this email.",
    ].join("\n"),
  };
}

export function passwordResetEmailTemplate(resetUrl: string): EmailTemplate {
  const safeUrl = escapeHtml(resetUrl);
  const subject = "Reset your password — AI Study Assistant";

  return {
    subject,
    html: emailLayout(
      subject,
      `<h1 style="margin:0 0 16px;font-size:24px">Reset your password</h1>
      <p style="font-size:15px;line-height:1.7;color:#475569">
        We received a request to reset your AI Study Assistant password.
      </p>
      ${actionButton("Reset password", resetUrl)}
      <p style="font-size:13px;line-height:1.7;color:#64748b">
        This link expires in one hour. If the button does not work, copy this URL:<br />
        <span style="word-break:break-all">${safeUrl}</span>
      </p>
      <p style="font-size:13px;line-height:1.7;color:#64748b">
        If you did not request this reset, ignore this email and keep your current password.
      </p>`,
    ),
    text: [
      "Reset your AI Study Assistant password",
      "",
      "Open this link to reset your password:",
      resetUrl,
      "",
      "This link expires in one hour.",
      "If you did not request this reset, ignore this email.",
    ].join("\n"),
  };
}
