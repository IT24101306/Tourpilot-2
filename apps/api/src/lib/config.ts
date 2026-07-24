import "dotenv/config";

function emailMode(): "log" | "webhook" | "smtp" {
  const m = (process.env.EMAIL_MODE || "log").toLowerCase();
  if (m === "webhook" || m === "smtp") return m;
  return "log";
}

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "dev-jwt-secret-change-me",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
  demoOtpInResponse: process.env.DEMO_OTP_IN_RESPONSE !== "false",
  nodeEnv: process.env.NODE_ENV || "development",
  /** Local dev only: accept fixed OTP without SMS. Never enable in production. */
  devBypassOtp:
    process.env.NODE_ENV !== "production" && process.env.DEV_BYPASS_OTP === "true",
  devBypassOtpCode: process.env.DEV_BYPASS_OTP_CODE || "000000",
  /** Print OTP in the API terminal (dev only unless explicitly enabled). */
  logOtpToConsole:
    process.env.LOG_OTP_TO_CONSOLE === "true" ||
    (process.env.NODE_ENV !== "production" && process.env.LOG_OTP_TO_CONSOLE !== "false"),
  webAppUrl: (process.env.WEB_APP_URL || "http://localhost:5173").replace(/\/$/, ""),
  email: {
    mode: emailMode(),
    from: process.env.EMAIL_FROM || "TourPilot <noreply@tourpilot.local>",
    webhookUrl: process.env.EMAIL_WEBHOOK_URL?.trim() || "",
    smtp: {
      host: process.env.SMTP_HOST?.trim() || "",
      // Default STARTTLS (cPanel server hostname); use 465 + SMTP_SECURE=true for SSL
      port: Number(process.env.SMTP_PORT || 587),
      user: process.env.SMTP_USER?.trim() || "",
      pass: process.env.SMTP_PASS || "",
      secure:
        process.env.SMTP_SECURE === "true" ||
        (process.env.SMTP_SECURE !== "false" &&
          Number(process.env.SMTP_PORT || 587) === 465),
    },
  },
  inquiryExpiryDays: Number(process.env.INQUIRY_EXPIRY_DAYS || 14),
  inquiryExpiryIntervalMs: Number(process.env.INQUIRY_EXPIRY_INTERVAL_MS || 60 * 60 * 1000),
  customDomain: {
    /** Public IPv4 of the server; agencies point an A record here. */
    aTarget: process.env.CUSTOM_DOMAIN_A_TARGET?.trim() || "",
    /** Optional CNAME target (e.g. srilankatourpilot.com) for www / subdomains. */
    cnameTarget: process.env.CUSTOM_DOMAIN_CNAME_TARGET?.trim() || "",
    /** Hosts owned by the platform itself (never treated as agency custom domains). */
    platformDomains: platformDomains(),
  },
  /**
   * Browser origins allowed to call the API (CORS).
   * Empty list = reflect any origin (dev-friendly default).
   * In production set CORS_ORIGINS and/or HEADLESS_CORS_ORIGINS.
   */
  corsOrigins: corsOrigins(),
  payhere: {
    merchantId: process.env.PAYHERE_MERCHANT_ID?.trim() || "",
    merchantSecret: process.env.PAYHERE_MERCHANT_SECRET?.trim() || "",
    /** Sandbox checkout unless PAYHERE_SANDBOX=false */
    sandbox: process.env.PAYHERE_SANDBOX !== "false",
  },
};

function corsOrigins(): string[] {
  const set = new Set<string>();
  const add = (raw: string | undefined | null) => {
    for (const part of (raw || "").split(",")) {
      const o = part.trim().replace(/\/$/, "");
      if (o) set.add(o);
    }
  };
  add(process.env.CORS_ORIGINS);
  add(process.env.HEADLESS_CORS_ORIGINS);
  try {
    const web = (process.env.WEB_APP_URL || "").trim().replace(/\/$/, "");
    if (web) set.add(web);
  } catch {
    /* ignore */
  }
  // Local Vite defaults
  set.add("http://localhost:5173");
  set.add("http://127.0.0.1:5173");
  return Array.from(set);
}

/** Platform-owned hostnames, from PLATFORM_DOMAINS plus the WEB_APP_URL host. */
function platformDomains(): string[] {
  const set = new Set<string>();
  const add = (h: string | undefined | null) => {
    const host = (h || "").trim().toLowerCase().replace(/^www\./, "");
    if (host) set.add(host);
  };
  for (const d of (process.env.PLATFORM_DOMAINS || "").split(",")) add(d);
  try {
    add(new URL(process.env.WEB_APP_URL || "http://localhost:5173").hostname);
  } catch {
    /* ignore malformed WEB_APP_URL */
  }
  add(process.env.PLATFORM_DOMAIN);
  add("localhost");
  // Staging subdomain on the same VPS (dev.example.com) is platform-owned,
  // never an agency custom domain — required so Caddy On-Demand TLS ask
  // succeeds if traffic briefly hits the catch-all site block.
  for (const d of Array.from(set)) {
    if (d && !d.startsWith("dev.") && d !== "localhost") {
      set.add(`dev.${d}`);
    }
  }
  return Array.from(set);
}
