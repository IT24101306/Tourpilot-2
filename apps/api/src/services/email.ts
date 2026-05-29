type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailResult = {
  delivered: boolean;
  mode: "log" | "webhook";
  error?: string;
};

/** Platform email — logs in dev; optional EMAIL_WEBHOOK_URL for real delivery. */
export async function sendPlatformEmail(payload: EmailPayload): Promise<EmailResult> {
  const { to, subject, text, html } = payload;
  if (!to?.trim()) {
    return { delivered: false, mode: "log", error: "No recipient address" };
  }

  console.log("[TourPilot email]");
  console.log(`  To: ${to}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Body:\n${text}`);

  const webhook = process.env.EMAIL_WEBHOOK_URL?.trim();
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, text, html: html ?? text }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { delivered: false, mode: "webhook", error: body || res.statusText };
      }
      return { delivered: true, mode: "webhook" };
    } catch (e) {
      return {
        delivered: false,
        mode: "webhook",
        error: e instanceof Error ? e.message : "Webhook failed",
      };
    }
  }

  return { delivered: true, mode: "log" };
}

export function agencyRejectionEmail(params: {
  agencyName: string;
  ownerName: string;
  reason: string;
}) {
  const subject = `TourPilot — application update for ${params.agencyName}`;
  const text = [
    `Hello ${params.ownerName},`,
    "",
    `Thank you for applying to list ${params.agencyName} on TourPilot.`,
    "",
    "After review, we are unable to approve your agency at this time.",
    "",
    "Reason:",
    params.reason,
    "",
    "You may update your application and contact support if you have questions.",
    "",
    "— TourPilot Platform Team",
  ].join("\n");

  const html = `<p>Hello ${escapeHtml(params.ownerName)},</p>
<p>Thank you for applying to list <strong>${escapeHtml(params.agencyName)}</strong> on TourPilot.</p>
<p>After review, we are unable to approve your agency at this time.</p>
<p><strong>Reason:</strong><br>${escapeHtml(params.reason)}</p>
<p>You may update your application and contact support if you have questions.</p>
<p>— TourPilot Platform Team</p>`;

  return { subject, text, html };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
