/**
 * Transactional email via the Resend REST API.
 *
 * Required secret:
 *   RESEND_API_KEY  — obtain at https://resend.com and add via Replit Secrets
 *
 * Required env var:
 *   RESEND_FROM     — "Name <you@yourdomain.com>" verified sender address.
 *                     Must be a domain verified in your Resend account.
 *                     When absent, sending is skipped and a WARN is logged
 *                     (the Resend sandbox sender cannot reach arbitrary users).
 *
 * When RESEND_API_KEY is absent in production a WARN-level log is emitted so
 * the gap is never silent; in development the send is simply skipped.
 */

import { logger } from "./logger.js";

const RESEND_API_URL = "https://api.resend.com/emails";

interface SendEmailOpts {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Fire-and-forget email send. Errors are logged, never thrown. */
export function sendEmail(opts: SendEmailOpts): void {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      logger.warn(
        { to: opts.to, subject: opts.subject },
        "RESEND_API_KEY is not set — transactional email skipped. Set the secret to enable credit-claim receipts."
      );
    } else {
      logger.debug({ to: opts.to }, "RESEND_API_KEY absent (dev) — skipping email");
    }
    return;
  }

  const from = process.env.RESEND_FROM ?? "";

  // The Resend sandbox sender only delivers to the account owner — useless for
  // real claimants.  Block production sends without a verified RESEND_FROM so
  // misconfiguration is never silent.
  if (!from) {
    logger.warn(
      { to: opts.to, subject: opts.subject },
      "RESEND_FROM is not set — email skipped. Set it to a verified sender, e.g. 'Gustafta <no-reply@yourdomain.com>'."
    );
    return;
  }

  fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text().catch(() => "(unreadable)");
        logger.warn(
          { status: res.status, body, to: opts.to, subject: opts.subject },
          "Resend API returned an error"
        );
      } else {
        logger.info({ to: opts.to, subject: opts.subject }, "Email sent via Resend");
      }
    })
    .catch((err) =>
      logger.warn({ err, to: opts.to, subject: opts.subject }, "Failed to reach Resend API")
    );
}

/**
 * Returns true when both RESEND_API_KEY and RESEND_FROM are set.
 * Used by the health endpoint so ops can confirm email delivery is active.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

/** Sends the credit-claim confirmation receipt. */
export function sendCreditClaimEmail(opts: {
  to: string;
  orderId: string;
  creditsGranted: number;
  newBalance: number;
}): void {
  const { to, orderId, creditsGranted, newBalance } = opts;

  const subject = "Klaim kredit Exum berhasil ✅";

  const text = [
    "Halo,",
    "",
    "Klaim kredit Exum Anda telah berhasil diproses.",
    "",
    `ID Pesanan         : ${orderId}`,
    `Kredit dikreditkan : ${creditsGranted} kredit`,
    `Saldo sekarang     : ${newBalance} kredit`,
    "",
    "Kredit dapat langsung digunakan untuk membuat Exum baru.",
    "",
    "Terima kasih telah menggunakan Gustafta!",
    "— Tim Gustafta",
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#2563eb;padding:28px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;">Gustafta</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Klaim kredit berhasil! 🎉</h2>
            <p style="margin:0 0 24px;color:#374151;line-height:1.6;">
              Kredit Exum Anda telah berhasil dikreditkan ke akun Anda.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:24px;">
              <tr>
                <td style="padding:12px 16px;color:#6b7280;font-size:13px;border-bottom:1px solid #e5e7eb;">ID Pesanan</td>
                <td style="padding:12px 16px;color:#111827;font-weight:600;font-size:13px;border-bottom:1px solid #e5e7eb;">${orderId}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;color:#6b7280;font-size:13px;border-bottom:1px solid #e5e7eb;">Kredit dikreditkan</td>
                <td style="padding:12px 16px;color:#16a34a;font-weight:700;font-size:13px;border-bottom:1px solid #e5e7eb;">+${creditsGranted} kredit</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Saldo sekarang</td>
                <td style="padding:12px 16px;color:#111827;font-weight:700;font-size:13px;">${newBalance} kredit</td>
              </tr>
            </table>
            <p style="margin:0 0 8px;color:#374151;line-height:1.6;">
              Kredit dapat langsung digunakan untuk membuat Exum baru.
            </p>
            <p style="margin:0;color:#6b7280;font-size:13px;">
              Jika Anda tidak merasa melakukan klaim ini, hubungi tim dukungan kami.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">© 2024 Gustafta. Semua hak dilindungi.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`.trim();

  sendEmail({ to, subject, text, html });
}
