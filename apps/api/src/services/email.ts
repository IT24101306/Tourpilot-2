import type { Transporter } from "nodemailer";
import { config } from "../lib/config.js";
import {
  applyEmailTemplate,
  getPlatformSettings,
} from "./platformSettings.js";

export type EmailAttachment = {
  filename: string;
  path?: string;
  content?: Buffer | string;
  contentType?: string;
  cid?: string;
};

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
};

export type EmailResult = {
  delivered: boolean;
  mode: "log" | "webhook" | "smtp";
  error?: string;
};

let smtpTransport: Transporter | null = null;

export function getEmailDeliveryStatus() {
  const { host, port, user, pass, secure } = config.email.smtp;
  return {
    mode: config.email.mode,
    from: config.email.from,
    smtp: {
      host: host || null,
      port,
      user: user || null,
      secure,
      passConfigured: Boolean(pass),
    },
    ready:
      config.email.mode === "log" ||
      (config.email.mode === "webhook" && Boolean(config.email.webhookUrl)) ||
      (config.email.mode === "smtp" && Boolean(host) && Boolean(pass)),
    hint:
      config.email.mode === "log"
        ? "EMAIL_MODE=log — emails only print in the API console. Set EMAIL_MODE=smtp and SMTP_* then restart the API."
        : config.email.mode === "smtp" && !host
          ? "SMTP_HOST is missing."
            : config.email.mode === "smtp" && !pass
              ? "SMTP_PASS is empty — set the mailbox password and restart the API."
              : config.email.mode === "smtp" && host.toLowerCase().startsWith("mail.")
                ? "If sends time out, Hostinger mailboxes usually need SMTP_HOST=smtp.hostinger.com (or smtp.titan.email), not mail.yourdomain.com."
                : config.email.mode === "smtp"
                  ? "SMTP looks configured."
                  : undefined,
  };
}

export async function verifySmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  if (config.email.mode !== "smtp") {
    return { ok: false, error: `EMAIL_MODE is "${config.email.mode}", not smtp` };
  }
  const transport = await getSmtpTransport();
  if (!transport) {
    return { ok: false, error: "SMTP_HOST not configured" };
  }
  if (config.email.smtp.user && !config.email.smtp.pass) {
    return { ok: false, error: "SMTP_PASS is empty" };
  }
  try {
    await transport.verify();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "SMTP verify failed",
    };
  }
}

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
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
  return smtpTransport;
}

/** Platform email — log in dev; webhook or SMTP when configured. */
export async function sendPlatformEmail(payload: EmailPayload): Promise<EmailResult> {
  const { to, subject, text, html, attachments } = payload;
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
    if (attachments?.length) {
      console.log(`  Attachments: ${attachments.map((a) => a.filename).join(", ")}`);
    }
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
          attachments: attachments?.map((a) => ({
            filename: a.filename,
            contentType: a.contentType,
            cid: a.cid,
            path: a.path,
            content:
              typeof a.content === "string"
                ? a.content
                : a.content
                  ? a.content.toString("base64")
                  : undefined,
          })),
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

  const { user, pass } = config.email.smtp;
  if (user && !pass) {
    return {
      delivered: false,
      mode: "smtp",
      error: "SMTP_PASS is empty — set the mailbox password in apps/api/.env and restart the API",
    };
  }

  try {
    await transport.sendMail({
      from,
      to,
      subject,
      text,
      html: html ?? text,
      ...(attachments?.length
        ? {
            attachments: attachments.map((a) => ({
              filename: a.filename,
              path: a.path,
              content: a.content,
              contentType: a.contentType,
              cid: a.cid,
            })),
          }
        : {}),
    } as Parameters<Transporter["sendMail"]>[0]);
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

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function absolutePublicUrl(pathOrUrl: string, baseUrl: string) {
  const raw = pathOrUrl.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = baseUrl.replace(/\/$/, "");
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${base}${path}`;
}

export function otpEmail(params: {
  recipientName?: string;
  otp: string;
  purpose: string;
}) {
  const action =
    params.purpose === "register"
      ? "complete registration"
      : params.purpose.startsWith("login")
        ? "sign in"
        : "verify your request";
  const greeting = params.recipientName ? `Hello ${params.recipientName},` : "Hello,";
  const subject = `Your TourPilot code: ${params.otp}`;
  const text = [
    greeting,
    "",
    `Your one-time code to ${action} is: ${params.otp}`,
    "",
    "This code expires in 5 minutes. If you did not request it, you can ignore this email.",
    "",
    "— TourPilot",
  ].join("\n");
  const html = `<p>${escapeHtml(greeting)}</p>
<p>Your one-time code to ${escapeHtml(action)} is:</p>
<p style="font-size:28px;letter-spacing:4px;font-weight:700">${escapeHtml(params.otp)}</p>
<p>This code expires in 5 minutes. If you did not request it, you can ignore this email.</p>
<p>— TourPilot</p>`;
  return { subject, text, html };
}

export function welcomeEmail(params: {
  name: string;
  role: string;
  appUrl: string;
}) {
  const subject = "Welcome to TourPilot";
  const text = [
    `Hello ${params.name},`,
    "",
    "Welcome to TourPilot — we're glad you're here.",
    "",
    `Your account (${params.role.toLowerCase()}) is ready. Explore tours, offers, and trip planning anytime:`,
    params.appUrl,
    "",
    "We'll also email you important trip updates and occasional offers.",
    "",
    "— TourPilot",
  ].join("\n");
  const html = `<p>Hello ${escapeHtml(params.name)},</p>
<p>Welcome to TourPilot — we're glad you're here.</p>
<p>Your <strong>${escapeHtml(params.role.toLowerCase())}</strong> account is ready.</p>
<p><a href="${escapeHtml(params.appUrl)}">Open TourPilot</a></p>
<p>We'll also email you important trip updates and occasional offers.</p>
<p>— TourPilot</p>`;
  return { subject, text, html };
}

export function trialEndingEmail(params: {
  name: string;
  packageName: string;
  priceLabel: string;
  endsAtLabel: string;
  activateUrl: string;
}) {
  const subject = `Your TourPilot free trial ends soon (${params.packageName})`;
  const text = [
    `Hello ${params.name},`,
    "",
    `Your 7-day free trial for ${params.packageName} ends on ${params.endsAtLabel}.`,
    "",
    `After that, access pauses until you activate your package (${params.priceLabel}).`,
    "",
    `Activate / top up: ${params.activateUrl}`,
    "",
    "— TourPilot",
  ].join("\n");
  const html = `<p>Hello ${escapeHtml(params.name)},</p>
<p>Your <strong>7-day free trial</strong> for <strong>${escapeHtml(params.packageName)}</strong> ends on <strong>${escapeHtml(params.endsAtLabel)}</strong>.</p>
<p>After that, access pauses until you activate your package (<strong>${escapeHtml(params.priceLabel)}</strong>).</p>
<p><a href="${escapeHtml(params.activateUrl)}">Activate your package</a></p>
<p>— TourPilot</p>`;
  return { subject, text, html };
}

export function tripMessageEmail(params: {
  recipientName: string;
  preview: string;
  tripUrl: string;
}) {
  const subject = "New message in your TourPilot trip room";
  const text = [
    `Hello ${params.recipientName},`,
    "",
    "You have a new message in your trip room:",
    "",
    params.preview,
    "",
    `Open trip room: ${params.tripUrl}`,
    "",
    "— TourPilot",
  ].join("\n");
  const html = `<p>Hello ${escapeHtml(params.recipientName)},</p>
<p>You have a new message in your trip room:</p>
<blockquote>${escapeHtml(params.preview)}</blockquote>
<p><a href="${escapeHtml(params.tripUrl)}">Open trip room</a></p>
<p>— TourPilot</p>`;
  return { subject, text, html };
}

export function agencyApprovedEmail(params: {
  agencyName: string;
  ownerName: string;
  dashboardUrl: string;
}) {
  const subject = `TourPilot — ${params.agencyName} is approved`;
  const text = [
    `Hello ${params.ownerName},`,
    "",
    `Great news — ${params.agencyName} has been approved on TourPilot.`,
    "",
    "You can now publish tours, manage inquiries, and appear in discovery.",
    "",
    `Open your dashboard: ${params.dashboardUrl}`,
    "",
    "— TourPilot Platform Team",
  ].join("\n");
  const html = `<p>Hello ${escapeHtml(params.ownerName)},</p>
<p>Great news — <strong>${escapeHtml(params.agencyName)}</strong> has been approved on TourPilot.</p>
<p>You can now publish tours, manage inquiries, and appear in discovery.</p>
<p><a href="${escapeHtml(params.dashboardUrl)}">Open your dashboard</a></p>
<p>— TourPilot Platform Team</p>`;
  return { subject, text, html };
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

export function walletReceiptEmail(params: {
  recipientName: string;
  kind: "LOGIN_FEE" | "TOPUP";
  amountLkr: number;
  balanceLkr: number;
}) {
  const isFee = params.kind === "LOGIN_FEE";
  const subject = isFee
    ? `Login fee receipt — ${params.amountLkr.toLocaleString()} Credits`
    : `Wallet top-up receipt — ${params.amountLkr.toLocaleString()} Credits`;
  const action = isFee
    ? `A login fee of ${params.amountLkr.toLocaleString()} Credits was charged.`
    : `${params.amountLkr.toLocaleString()} Credits was added to your wallet.`;
  const text = [
    `Hello ${params.recipientName},`,
    "",
    action,
    `Wallet balance: ${params.balanceLkr.toLocaleString()} Credits.`,
    "",
    "— TourPilot",
  ].join("\n");
  const html = `<p>Hello ${escapeHtml(params.recipientName)},</p>
<p>${escapeHtml(action)}</p>
<p>Wallet balance: <strong>${params.balanceLkr.toLocaleString()} Credits</strong>.</p>
<p>— TourPilot</p>`;
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
  const subject = `Commission paid — ${params.amountLkr.toLocaleString()} Credits`;
  const text = [
    `Hello ${params.influencerName},`,
    "",
    `${params.amountLkr.toLocaleString()} Credits has been credited to your TourPilot wallet.`,
    `New wallet balance: ${params.walletBalance.toLocaleString()} Credits.`,
    "",
    "— TourPilot",
  ].join("\n");
  const html = `<p>Hello ${escapeHtml(params.influencerName)},</p>
<p><strong>${params.amountLkr.toLocaleString()} Credits</strong> has been credited to your TourPilot wallet.</p>
<p>New balance: <strong>${params.walletBalance.toLocaleString()} Credits</strong>.</p>
<p>— TourPilot</p>`;
  return { subject, text, html };
}

export function promotionalEmail(params: {
  recipientName: string;
  subject: string;
  body: string;
  posterUrl?: string;
  offerTitle?: string;
  offerUrl?: string;
}) {
  const lines = [`Hello ${params.recipientName},`, "", params.body];
  if (params.offerTitle && params.offerUrl) {
    lines.push("", `Featured offer: ${params.offerTitle}`, params.offerUrl);
  }
  if (params.posterUrl) {
    lines.push("", `Poster: ${params.posterUrl}`);
  }
  lines.push("", "— TourPilot");
  const text = lines.join("\n");

  const posterHtml = params.posterUrl
    ? `<p><img src="${escapeHtml(params.posterUrl)}" alt="TourPilot offer" style="max-width:100%;height:auto;border-radius:8px" /></p>`
    : "";
  const offerHtml =
    params.offerTitle && params.offerUrl
      ? `<p><a href="${escapeHtml(params.offerUrl)}" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px">View ${escapeHtml(params.offerTitle)}</a></p>`
      : "";

  const html = `<p>Hello ${escapeHtml(params.recipientName)},</p>
${params.body
  .split(/\n+/)
  .filter(Boolean)
  .map((p) => `<p>${escapeHtml(p)}</p>`)
  .join("\n")}
${posterHtml}
${offerHtml}
<p>— TourPilot</p>`;

  return { subject: params.subject, text, html };
}
