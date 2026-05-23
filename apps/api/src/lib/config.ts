import "dotenv/config";

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
};
