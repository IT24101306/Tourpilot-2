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
      port: Number(process.env.SMTP_PORT || 587),
      user: process.env.SMTP_USER?.trim() || "",
      pass: process.env.SMTP_PASS || "",
      secure: process.env.SMTP_SECURE === "true",
    },
  },
  inquiryExpiryDays: Number(process.env.INQUIRY_EXPIRY_DAYS || 14),
  inquiryExpiryIntervalMs: Number(process.env.INQUIRY_EXPIRY_INTERVAL_MS || 60 * 60 * 1000),
};
