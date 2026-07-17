import type { Transporter } from "nodemailer";
import { config } from "../lib/config.js";
import {
  applyEmailTemplate,
  getPlatformSettings,
} from "./platformSettings.js";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailResult = {
  delivered: boolean;
  mode: "log" | "webhook" | "smtp";
  error?: string;
};

let smtpTransport: Transporter | null = null;

async function getSmtpTransport() {
  if (smtpTransport) return smtpTransport;
  const { host, port, user, pass, secure } = config.email.smtp;
  if (!host) return null;
  const nodemailer = (await import("nodemailer")).default;
  smtpTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });
  return smtpTransport;
}

/** Platform email — log in dev; webhook or SMTP when configured. */
export async function sendPlatformEmail(payload: EmailPayload): Promise<EmailResult> {
  const { to, subject, text, html } = payload;
  if (!to?.trim()) {
    return { delivered: false, mode: config.email.mode, error: "No recipient address" };
  }

  const settings = await getPlatformSettings().catch(() => null);
  const from = settings?.emailFrom?.trim() || config.email.from;
  const mode = config.email.mode;

  if (mode === "log") {
    console.log("[TourPilot email]");
    console.log(`  From: ${from}`);
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body:\n${text}`);
    return { delivered: true, mode: "log" };
  }

  if (mode === "webhook") {
    const webhook = config.email.webhookUrl;
    if (!webhook) {
      return { delivered: false, mode: "webhook", error: "EMAIL_WEBHOOK_URL not set" };
    }
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          subject,
          text,
          html: html ?? text,
        }),
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

  const transport = await getSmtpTransport();
  if (!transport) {
    return { delivered: false, mode: "smtp", error: "SMTP_HOST not configured" };
  }

  try {
    await transport.sendMail({
      from,
      to,
      subject,
      text,
      html: html ?? text,
    });
    return { delivered: true, mode: "smtp" };
  } catch (e) {
    return {
      delivered: false,
      mode: "smtp",
      error: e instanceof Error ? e.message : "SMTP send failed",
    };
  }
}

/** Merge admin email template overrides ({{placeholders}}) over built-in defaults. */
export async function finalizeEmailTemplate(
  key: string,
  defaults: { subject: string; text: string; html?: string },
  vars: Record<string, string>
): Promise<{ subject: string; text: string; html?: string }> {
  const settings = await getPlatformSettings().catch(() => null);
  if (!settings) return defaults;
  const applied = applyEmailTemplate(
    settings.emailTemplates,
    key,
    { subject: defaults.subject, body: defaults.text },
    vars
  );
  return {
    subject: applied.subject,
    text: applied.body,
    html: applied.body !== defaults.text ? undefined : defaults.html,
  };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

export function inquiryCreatedEmail(params: {
  agencyName: string;
  touristName: string;
  tripUrl: string;
}) {
  const subject = `New trip inquiry for ${params.agencyName}`;
  const text = [
    `Hello ${params.agencyName} team,`,
    "",
    `${params.touristName} submitted a new trip inquiry.`,
    "",
    `Open the trip room: ${params.tripUrl}`,
    "",
    "— TourPilot",
  ].join("\n");
  const html = `<p>Hello <strong>${escapeHtml(params.agencyName)}</strong> team,</p>
<p><strong>${escapeHtml(params.touristName)}</strong> submitted a new trip inquiry.</p>
<p><a href="${escapeHtml(params.tripUrl)}">Open trip room</a></p>
<p>— TourPilot</p>`;
  return { subject, text, html };
}

export function proposalSentEmail(params: {
  touristName: string;
  agencyName: string;
  tripUrl: string;
}) {
  const subject = `${params.agencyName} sent you a tour proposal`;
  const text = [
    `Hello ${params.touristName},`,
    "",
    `${params.agencyName} has sent you a tour proposal on TourPilot.`,
    "",
    `Review it here: ${params.tripUrl}`,
    "",
    "— TourPilot",
  ].join("\n");
  const html = `<p>Hello ${escapeHtml(params.touristName)},</p>
<p><strong>${escapeHtml(params.agencyName)}</strong> has sent you a tour proposal.</p>
<p><a href="${escapeHtml(params.tripUrl)}">Review proposal</a></p>
<p>— TourPilot</p>`;
  return { subject, text, html };
}

export function inquiryStatusEmail(params: {
  recipientName: string;
  agencyName: string;
  touristName: string;
  status: string;
  tripUrl: string;
  note?: string;
}) {
  const subject = `Trip inquiry update — ${params.status.replace(/_/g, " ")}`;
  const lines = [
    `Hello ${params.recipientName},`,
    "",
    `Trip inquiry between ${params.touristName} and ${params.agencyName} is now: ${params.status}.`,
  ];
  if (params.note) lines.push("", params.note);
  lines.push("", `View: ${params.tripUrl}`, "", "— TourPilot");
  const text = lines.join("\n");
  const html = `<p>Hello ${escapeHtml(params.recipientName)},</p>
<p>Trip inquiry between <strong>${escapeHtml(params.touristName)}</strong> and <strong>${escapeHtml(params.agencyName)}</strong> is now: <strong>${escapeHtml(params.status)}</strong>.</p>
${params.note ? `<p>${escapeHtml(params.note)}</p>` : ""}
<p><a href="${escapeHtml(params.tripUrl)}">Open trip room</a></p>
<p>— TourPilot</p>`;
  return { subject, text, html };
}

export function inquiryExpiredEmail(params: {
  recipientName: string;
  agencyName: string;
  tripUrl: string;
}) {
  const subject = `Trip inquiry expired — ${params.agencyName}`;
  const text = [
    `Hello ${params.recipientName},`,
    "",
    `A trip inquiry with ${params.agencyName} has expired due to inactivity.`,
    "",
    `Details: ${params.tripUrl}`,
    "",
    "— TourPilot",
  ].join("\n");
  const html = `<p>Hello ${escapeHtml(params.recipientName)},</p>
<p>A trip inquiry with <strong>${escapeHtml(params.agencyName)}</strong> has expired due to inactivity.</p>
<p><a href="${escapeHtml(params.tripUrl)}">View inquiry</a></p>
<p>— TourPilot</p>`;
  return { subject, text, html };
}

export function commissionPaidEmail(params: {
  influencerName: string;
  amountLkr: number;
  walletBalance: number;
}) {
  const subject = `Commission paid — LKR ${params.amountLkr.toLocaleString()}`;
  const text = [
    `Hello ${params.influencerName},`,
    "",
    `LKR ${params.amountLkr.toLocaleString()} has been credited to your TourPilot wallet.`,
    `New wallet balance: LKR ${params.walletBalance.toLocaleString()}.`,
    "",
    "— TourPilot",
  ].join("\n");
  const html = `<p>Hello ${escapeHtml(params.influencerName)},</p>
<p><strong>LKR ${params.amountLkr.toLocaleString()}</strong> has been credited to your TourPilot wallet.</p>
<p>New balance: <strong>LKR ${params.walletBalance.toLocaleString()}</strong>.</p>
<p>— TourPilot</p>`;
  return { subject, text, html };
}
