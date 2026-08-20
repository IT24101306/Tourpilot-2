import type { Transporter } from "nodemailer";
import { sanitizeRichHtml, stripRichHtml } from "@tourpilot/shared";
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
let smtpTransportKey = "";

/** Normalize port/TLS; never rewrite the configured host (cPanel uses mail.domain.com). */
function resolveSmtpEndpoint() {
  const host = config.email.smtp.host.trim();
  const port = config.email.smtp.port;
  let secure = config.email.smtp.secure;

  // Keep TLS mode consistent with the port (mismatches often hang until timeout).
  if (port === 465) secure = true;
  else if (port === 587 && process.env.SMTP_SECURE !== "true") secure = false;

  return {
    host,
    port,
    secure,
    user: config.email.smtp.user,
    pass: config.email.smtp.pass,
  };
}

function formatSmtpError(error: unknown, host: string): string {
  const message = error instanceof Error ? error.message : "SMTP send failed";
  const authFailed = /invalid login|authentication failed|535/i.test(message);
  if (authFailed) {
    return `${message} — Check SMTP_USER (full mailbox address) and SMTP_PASS match the cPanel email account password for ${host}.`;
  }
  const timedOut = /timeout|timed out|etimedout|econnrefused|enotfound/i.test(message);
  if (!timedOut) return message;

  const tips = [
    `Could not reach SMTP host "${host}" on the configured port.`,
    "This is a network/firewall issue, not wrong credentials: TCP never connected.",
    "On cPanel, use the server hostname from Reverse DNS / Email Routing (e.g. server34.lakgate.com) with SMTP_PORT=587 and SMTP_SECURE=false — mail.yourdomain.com often blocks 465/587 publicly.",
    "If the API runs on the same machine as cPanel, try SMTP_HOST=127.0.0.1.",
    "Otherwise use a relay (Resend/SendGrid/Mailgun) via EMAIL_MODE=webhook.",
  ];
  return `${message} — ${tips.join(" ")}`;
}

export function getEmailDeliveryStatus() {
  const endpoint = resolveSmtpEndpoint();
  const { host, port, user, pass, secure } = endpoint;
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
            : config.email.mode === "smtp"
              ? "SMTP looks configured. If mail.yourdomain.com times out, use the Reverse DNS hostname (e.g. server34.lakgate.com) on port 587."
              : undefined,
  };
}

export async function verifySmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  if (config.email.mode !== "smtp") {
    return { ok: false, error: `EMAIL_MODE is "${config.email.mode}", not smtp` };
  }
  // Drop any cached broken transport before verifying.
  smtpTransport = null;
  smtpTransportKey = "";
  const transport = await getSmtpTransport();
  const endpoint = resolveSmtpEndpoint();
  if (!transport) {
    return { ok: false, error: "SMTP_HOST not configured" };
  }
  if (endpoint.user && !endpoint.pass) {
    return { ok: false, error: "SMTP_PASS is empty" };
  }
  try {
    await transport.verify();
    return { ok: true };
  } catch (e) {
    smtpTransport = null;
    smtpTransportKey = "";
    return {
      ok: false,
      error: formatSmtpError(e, endpoint.host),
    };
  }
}

async function getSmtpTransport() {
  const endpoint = resolveSmtpEndpoint();
  const { host, port, user, pass, secure } = endpoint;
  if (!host) return null;

  const key = `${host}|${port}|${secure}|${user}|${pass ? "1" : "0"}`;
  if (smtpTransport && smtpTransportKey === key) return smtpTransport;

  const nodemailer = (await import("nodemailer")).default;
  // `family` is supported by smtp-connection but missing from nodemailer TransportOptions.
  const transportOptions = {
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
    // IPv6 AAAA answers frequently hang on VPS networks.
    family: 4 as const,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
    tls: {
      servername: host,
      minVersion: "TLSv1.2" as const,
    },
    requireTLS: !secure && port === 587,
  };
  smtpTransport = nodemailer.createTransport(transportOptions);
  smtpTransportKey = key;
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

  const endpoint = resolveSmtpEndpoint();
  if (endpoint.user && !endpoint.pass) {
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
    smtpTransport = null;
    smtpTransportKey = "";
    return {
      delivered: false,
      mode: "smtp",
      error: formatSmtpError(e, endpoint.host),
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

/** Brand tokens for transactional HTML (table-based for email clients). */
const EMAIL_BRAND = {
  green: "#00af02",
  greenDark: "#008c02",
  ink: "#142018",
  muted: "#5b6b60",
  line: "#dce6df",
  soft: "#f3f7f4",
  white: "#ffffff",
  font: "'Segoe UI', Helvetica, Arial, sans-serif",
} as const;

type BrandedEmailCta = { label: string; url: string };

type BrandedEmailOptions = {
  /** Inbox preview snippet (hidden in most clients). */
  preheader?: string;
  /** Small label above the title, e.g. "Welcome". */
  eyebrow?: string;
  title?: string;
  /** Already-safe HTML for the message body. */
  bodyHtml: string;
  cta?: BrandedEmailCta;
  footerNote?: string;
};

function emailText(...parts: Array<string | false | null | undefined>) {
  return parts.filter((p): p is string => Boolean(p)).join("\n");
}

function emailP(html: string) {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${EMAIL_BRAND.ink};">${html}</p>`;
}

function emailStrong(text: string) {
  return `<strong style="font-weight:700;color:${EMAIL_BRAND.ink};">${escapeHtml(text)}</strong>`;
}

function emailQuote(text: string) {
  return `<blockquote style="margin:0 0 16px;padding:12px 14px;border-left:3px solid ${EMAIL_BRAND.green};background:${EMAIL_BRAND.soft};border-radius:0 8px 8px 0;font-size:14px;line-height:1.55;color:${EMAIL_BRAND.ink};">${escapeHtml(text)}</blockquote>`;
}

function emailDetailRows(rows: Array<{ label: string; value: string }>) {
  if (!rows.length) return "";
  const cells = rows
    .map(
      (r) => `<tr>
  <td style="padding:10px 0;border-bottom:1px solid ${EMAIL_BRAND.line};font-size:13px;color:${EMAIL_BRAND.muted};width:38%;vertical-align:top;">${escapeHtml(r.label)}</td>
  <td style="padding:10px 0;border-bottom:1px solid ${EMAIL_BRAND.line};font-size:14px;font-weight:600;color:${EMAIL_BRAND.ink};vertical-align:top;">${escapeHtml(r.value)}</td>
</tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse;">${cells}</table>`;
}

/**
 * Professional branded shell for welcome, booking/inquiry, and account emails.
 * Do not use for OTP — keep codes minimal and easy to scan.
 */
export function renderBrandedEmail(opts: BrandedEmailOptions): string {
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(opts.preheader)}</div>`
    : "";
  const eyebrow = opts.eyebrow
    ? `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${EMAIL_BRAND.greenDark};">${escapeHtml(opts.eyebrow)}</p>`
    : "";
  const title = opts.title
    ? `<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;font-weight:700;color:${EMAIL_BRAND.ink};">${escapeHtml(opts.title)}</h1>`
    : "";
  const cta = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border-collapse:collapse;">
  <tr>
    <td style="border-radius:8px;background:${EMAIL_BRAND.green};">
      <a href="${escapeHtml(opts.cta.url)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:${EMAIL_BRAND.white};text-decoration:none;border-radius:8px;">${escapeHtml(opts.cta.label)}</a>
    </td>
  </tr>
</table>`
    : "";
  const footerNote = opts.footerNote
    ? `<p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:${EMAIL_BRAND.muted};">${escapeHtml(opts.footerNote)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>TourPilot</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_BRAND.soft};font-family:${EMAIL_BRAND.font};-webkit-text-size-adjust:100%;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_BRAND.soft};border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-collapse:collapse;">
          <tr>
            <td style="padding:0 0 14px;text-align:left;">
              <span style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:${EMAIL_BRAND.greenDark};">Tour<span style="color:${EMAIL_BRAND.green};">Pilot</span></span>
            </td>
          </tr>
          <tr>
            <td style="background:${EMAIL_BRAND.white};border:1px solid ${EMAIL_BRAND.line};border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(0,140,2,0.08);">
              <div style="height:4px;background:${EMAIL_BRAND.green};line-height:4px;font-size:0;">&nbsp;</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:28px 28px 8px;">
                    ${eyebrow}
                    ${title}
                    ${opts.bodyHtml}
                    ${cta}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 8px 0;text-align:center;">
              ${footerNote}
              <p style="margin:0;font-size:12px;line-height:1.5;color:${EMAIL_BRAND.muted};">TourPilot · Sri Lanka travel, made simpler</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Minimal OTP mail — no branded chrome so the code stays obvious. */
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
  const text = emailText(
    greeting,
    "",
    `Your one-time code to ${action} is: ${params.otp}`,
    "",
    "This code expires in 5 minutes. If you did not request it, ignore this email.",
    "",
    "— TourPilot"
  );
  const html = `<div style="font-family:${EMAIL_BRAND.font};font-size:15px;line-height:1.5;color:${EMAIL_BRAND.ink};">
<p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
<p style="margin:0 0 8px;">Your one-time code to ${escapeHtml(action)}:</p>
<p style="margin:0 0 16px;font-size:28px;letter-spacing:0.28em;font-weight:700;font-family:ui-monospace,Consolas,monospace;">${escapeHtml(params.otp)}</p>
<p style="margin:0;font-size:13px;color:${EMAIL_BRAND.muted};">Expires in 5 minutes. If you did not request this, ignore the email.</p>
</div>`;
  return { subject, text, html };
}

export function welcomeEmail(params: {
  name: string;
  role: string;
  appUrl: string;
}) {
  const roleLabel = params.role.toLowerCase();
  const subject = "Welcome to TourPilot";
  const text = emailText(
    `Hello ${params.name},`,
    "",
    "Welcome to TourPilot — we're glad you're here.",
    "",
    `Your account (${roleLabel}) is ready. Explore tours, offers, and trip planning anytime:`,
    params.appUrl,
    "",
    "We'll also email you important trip updates and occasional offers.",
    "",
    "— TourPilot"
  );
  const html = renderBrandedEmail({
    preheader: "Your TourPilot account is ready.",
    eyebrow: "Welcome",
    title: `Hello ${params.name}`,
    bodyHtml: [
      emailP("Welcome to TourPilot — we're glad you're here."),
      emailP(`Your ${emailStrong(roleLabel)} account is ready. Explore tours, offers, and trip planning anytime.`),
      emailP("We'll also email you important trip updates and occasional offers."),
    ].join(""),
    cta: { label: "Open TourPilot", url: params.appUrl },
    footerNote: "You're receiving this because you created a TourPilot account.",
  });
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
  const text = emailText(
    `Hello ${params.name},`,
    "",
    `Your 7-day free trial for ${params.packageName} ends on ${params.endsAtLabel}.`,
    "",
    `After that, access pauses until you activate your package (${params.priceLabel}).`,
    "",
    `Activate / top up: ${params.activateUrl}`,
    "",
    "— TourPilot"
  );
  const html = renderBrandedEmail({
    preheader: `Trial for ${params.packageName} ends ${params.endsAtLabel}.`,
    eyebrow: "Trial reminder",
    title: "Your free trial ends soon",
    bodyHtml: [
      emailP(`Hello ${escapeHtml(params.name)},`),
      emailP(
        `Your 7-day free trial for ${emailStrong(params.packageName)} ends on ${emailStrong(params.endsAtLabel)}.`
      ),
      emailP(
        `After that, access pauses until you activate your package (${emailStrong(params.priceLabel)}).`
      ),
    ].join(""),
    cta: { label: "Activate your package", url: params.activateUrl },
  });
  return { subject, text, html };
}

export function tripMessageEmail(params: {
  recipientName: string;
  preview: string;
  tripUrl: string;
}) {
  const subject = "New message in your TourPilot trip room";
  const text = emailText(
    `Hello ${params.recipientName},`,
    "",
    "You have a new message in your trip room:",
    "",
    params.preview,
    "",
    `Open trip room: ${params.tripUrl}`,
    "",
    "— TourPilot"
  );
  const html = renderBrandedEmail({
    preheader: params.preview.slice(0, 120),
    eyebrow: "Trip room",
    title: "You have a new message",
    bodyHtml: [
      emailP(`Hello ${escapeHtml(params.recipientName)},`),
      emailP("Someone just messaged you in your trip room:"),
      emailQuote(params.preview),
    ].join(""),
    cta: { label: "Open trip room", url: params.tripUrl },
  });
  return { subject, text, html };
}

export function supportChatEmail(params: {
  visitorName: string;
  pagePath: string;
  transcript: string;
  inboxUrl: string;
}) {
  const subject = `TourPilot support chat — ${params.visitorName}`;
  const text = emailText(
    "A visitor requested live human support on TourPilot.",
    "",
    `Visitor: ${params.visitorName}`,
    `Page: ${params.pagePath}`,
    "",
    "Chat so far:",
    params.transcript,
    "",
    `Open admin inbox: ${params.inboxUrl}`,
    "",
    "— TourPilot"
  );
  const html = renderBrandedEmail({
    preheader: `Live support request from ${params.visitorName}`,
    eyebrow: "Live support",
    title: "Visitor needs a human",
    bodyHtml: [
      emailP("A visitor requested live human support on TourPilot."),
      emailP(`${emailStrong("Visitor:")} ${escapeHtml(params.visitorName)}`),
      emailP(`${emailStrong("Page:")} ${escapeHtml(params.pagePath)}`),
      emailP(emailStrong("Chat so far:")),
      emailQuote(params.transcript),
    ].join(""),
    cta: { label: "Open support inbox", url: params.inboxUrl },
  });
  return { subject, text, html };
}

export function agencyApprovedEmail(params: {
  agencyName: string;
  ownerName: string;
  dashboardUrl: string;
}) {
  const subject = `TourPilot — ${params.agencyName} is approved`;
  const text = emailText(
    `Hello ${params.ownerName},`,
    "",
    `Great news — ${params.agencyName} has been approved on TourPilot.`,
    "",
    "You can now publish tours, manage inquiries, and appear in discovery.",
    "",
    `Open your dashboard: ${params.dashboardUrl}`,
    "",
    "— TourPilot Platform Team"
  );
  const html = renderBrandedEmail({
    preheader: `${params.agencyName} is approved on TourPilot.`,
    eyebrow: "Agency approved",
    title: "You're live on TourPilot",
    bodyHtml: [
      emailP(`Hello ${escapeHtml(params.ownerName)},`),
      emailP(`Great news — ${emailStrong(params.agencyName)} has been approved.`),
      emailP("You can now publish tours, manage inquiries, and appear in discovery."),
    ].join(""),
    cta: { label: "Open your dashboard", url: params.dashboardUrl },
  });
  return { subject, text, html };
}

export function agencyRejectionEmail(params: {
  agencyName: string;
  ownerName: string;
  reason: string;
}) {
  const subject = `TourPilot — application update for ${params.agencyName}`;
  const text = emailText(
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
    "— TourPilot Platform Team"
  );
  const html = renderBrandedEmail({
    preheader: `Update on your ${params.agencyName} application.`,
    eyebrow: "Application update",
    title: "We reviewed your agency application",
    bodyHtml: [
      emailP(`Hello ${escapeHtml(params.ownerName)},`),
      emailP(`Thank you for applying to list ${emailStrong(params.agencyName)} on TourPilot.`),
      emailP("After review, we are unable to approve your agency at this time."),
      emailDetailRows([{ label: "Reason", value: params.reason }]),
      emailP("You may update your application and contact support if you have questions."),
    ].join(""),
  });
  return { subject, text, html };
}

export function walletReceiptEmail(params: {
  recipientName: string;
  kind: "LOGIN_FEE" | "TOPUP";
  amountLkr: number;
  balanceLkr: number;
}) {
  const isFee = params.kind === "LOGIN_FEE";
  const amount = params.amountLkr.toLocaleString();
  const balance = params.balanceLkr.toLocaleString();
  const subject = isFee
    ? `Login fee receipt — ${amount} Credits`
    : `Wallet top-up receipt — ${amount} Credits`;
  const action = isFee
    ? `A login fee of ${amount} Credits was charged.`
    : `${amount} Credits was added to your wallet.`;
  const text = emailText(
    `Hello ${params.recipientName},`,
    "",
    action,
    `Wallet balance: ${balance} Credits.`,
    "",
    "— TourPilot"
  );
  const html = renderBrandedEmail({
    preheader: action,
    eyebrow: "Wallet receipt",
    title: isFee ? "Login fee receipt" : "Top-up receipt",
    bodyHtml: [
      emailP(`Hello ${escapeHtml(params.recipientName)},`),
      emailP(escapeHtml(action)),
      emailDetailRows([
        { label: "Amount", value: `${amount} Credits` },
        { label: "Wallet balance", value: `${balance} Credits` },
      ]),
    ].join(""),
  });
  return { subject, text, html };
}

export function inquiryCreatedEmail(params: {
  agencyName: string;
  touristName: string;
  tripUrl: string;
}) {
  const subject = `New trip inquiry for ${params.agencyName}`;
  const text = emailText(
    `Hello ${params.agencyName} team,`,
    "",
    `${params.touristName} submitted a new trip inquiry.`,
    "",
    `Open the trip room: ${params.tripUrl}`,
    "",
    "— TourPilot"
  );
  const html = renderBrandedEmail({
    preheader: `${params.touristName} submitted a new trip inquiry.`,
    eyebrow: "New inquiry",
    title: "A traveler wants to book with you",
    bodyHtml: [
      emailP(`Hello ${emailStrong(params.agencyName)} team,`),
      emailP(`${emailStrong(params.touristName)} submitted a new trip inquiry.`),
      emailP("Open the trip room to review details and send a proposal."),
    ].join(""),
    cta: { label: "Open trip room", url: params.tripUrl },
  });
  return { subject, text, html };
}

export function proposalSentEmail(params: {
  touristName: string;
  agencyName: string;
  tripUrl: string;
}) {
  const subject = `${params.agencyName} sent you a tour proposal`;
  const text = emailText(
    `Hello ${params.touristName},`,
    "",
    `${params.agencyName} has sent you a tour proposal on TourPilot.`,
    "",
    `Review it here: ${params.tripUrl}`,
    "",
    "— TourPilot"
  );
  const html = renderBrandedEmail({
    preheader: `${params.agencyName} sent you a tour proposal.`,
    eyebrow: "Tour proposal",
    title: "Your itinerary proposal is ready",
    bodyHtml: [
      emailP(`Hello ${escapeHtml(params.touristName)},`),
      emailP(`${emailStrong(params.agencyName)} has sent you a tour proposal on TourPilot.`),
      emailP("Review the plan, ask questions, or accept when you're ready."),
    ].join(""),
    cta: { label: "Review proposal", url: params.tripUrl },
  });
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
  const statusLabel = params.status.replace(/_/g, " ");
  const subject = `Trip inquiry update — ${statusLabel}`;
  const text = emailText(
    `Hello ${params.recipientName},`,
    "",
    `Trip inquiry between ${params.touristName} and ${params.agencyName} is now: ${params.status}.`,
    params.note ? "" : null,
    params.note || null,
    "",
    `View: ${params.tripUrl}`,
    "",
    "— TourPilot"
  );
  const html = renderBrandedEmail({
    preheader: `Inquiry status: ${statusLabel}`,
    eyebrow: "Booking update",
    title: "Your trip inquiry was updated",
    bodyHtml: [
      emailP(`Hello ${escapeHtml(params.recipientName)},`),
      emailP(
        `Trip inquiry between ${emailStrong(params.touristName)} and ${emailStrong(params.agencyName)} is now ${emailStrong(statusLabel)}.`
      ),
      params.note ? emailP(escapeHtml(params.note)) : "",
      emailDetailRows([{ label: "Status", value: statusLabel }]),
    ].join(""),
    cta: { label: "Open trip room", url: params.tripUrl },
  });
  return { subject, text, html };
}

export function inquiryExpiredEmail(params: {
  recipientName: string;
  agencyName: string;
  tripUrl: string;
}) {
  const subject = `Trip inquiry expired — ${params.agencyName}`;
  const text = emailText(
    `Hello ${params.recipientName},`,
    "",
    `A trip inquiry with ${params.agencyName} has expired due to inactivity.`,
    "",
    `Details: ${params.tripUrl}`,
    "",
    "— TourPilot"
  );
  const html = renderBrandedEmail({
    preheader: `Inquiry with ${params.agencyName} expired.`,
    eyebrow: "Inquiry expired",
    title: "This trip inquiry has closed",
    bodyHtml: [
      emailP(`Hello ${escapeHtml(params.recipientName)},`),
      emailP(
        `A trip inquiry with ${emailStrong(params.agencyName)} has expired due to inactivity.`
      ),
      emailP("You can still open the trip room for details, or start a new inquiry anytime."),
    ].join(""),
    cta: { label: "View inquiry", url: params.tripUrl },
  });
  return { subject, text, html };
}

export function commissionPaidEmail(params: {
  influencerName: string;
  amountLkr: number;
  walletBalance: number;
}) {
  const amount = params.amountLkr.toLocaleString();
  const balance = params.walletBalance.toLocaleString();
  const subject = `Commission paid — ${amount} Credits`;
  const text = emailText(
    `Hello ${params.influencerName},`,
    "",
    `${amount} Credits has been credited to your TourPilot wallet.`,
    `New wallet balance: ${balance} Credits.`,
    "",
    "— TourPilot"
  );
  const html = renderBrandedEmail({
    preheader: `${amount} Credits credited to your wallet.`,
    eyebrow: "Commission paid",
    title: "Your commission is in",
    bodyHtml: [
      emailP(`Hello ${escapeHtml(params.influencerName)},`),
      emailP(`${emailStrong(`${amount} Credits`)} has been credited to your TourPilot wallet.`),
      emailDetailRows([
        { label: "Credited", value: `${amount} Credits` },
        { label: "New balance", value: `${balance} Credits` },
      ]),
    ].join(""),
  });
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
  const plainBody = stripRichHtml(params.body) || params.body;
  const text = emailText(
    `Hello ${params.recipientName},`,
    "",
    plainBody,
    params.offerTitle && params.offerUrl ? "" : null,
    params.offerTitle && params.offerUrl ? `Featured offer: ${params.offerTitle}` : null,
    params.offerUrl || null,
    params.posterUrl ? "" : null,
    params.posterUrl ? `Poster: ${params.posterUrl}` : null,
    "",
    "— TourPilot"
  );

  const posterHtml = params.posterUrl
    ? `<p style="margin:0 0 16px;"><img src="${escapeHtml(params.posterUrl)}" alt="TourPilot offer" style="max-width:100%;height:auto;border-radius:10px;display:block;" /></p>`
    : "";

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(params.body);
  const bodyHtml = looksLikeHtml
    ? sanitizeRichHtml(params.body)
    : params.body
        .split(/\n+/)
        .filter(Boolean)
        .map((p) => emailP(escapeHtml(p)))
        .join("");

  const html = renderBrandedEmail({
    preheader: plainBody.slice(0, 120),
    eyebrow: "Offer",
    title: `Hello ${params.recipientName}`,
    bodyHtml: `${bodyHtml}${posterHtml}`,
    cta:
      params.offerTitle && params.offerUrl
        ? { label: `View ${params.offerTitle}`, url: params.offerUrl }
        : undefined,
    footerNote: "You're receiving this because you opted in to TourPilot offers.",
  });

  return { subject: params.subject, text, html };
}
