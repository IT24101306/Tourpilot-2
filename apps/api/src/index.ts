import { createApp } from "./app.js";
import { config } from "./lib/config.js";
import { prisma } from "./lib/prisma.js";
import { startInquiryExpiryScheduler } from "./services/inquiryExpiry.js";
import { startTrialReminderScheduler } from "./services/trial.js";

const app = createApp();

async function main() {
  await prisma.$connect();
  startInquiryExpiryScheduler();
  startTrialReminderScheduler();
  app.listen(config.port, () => {
    console.log(`TourPilot API running on http://localhost:${config.port}`);
    console.log(`Email mode: ${config.email.mode}`);
    if (config.email.mode === "smtp") {
      const endpointHost = config.email.smtp.host;
      const { port, user, pass, secure } = config.email.smtp;
      console.log(
        `SMTP: ${endpointHost || "(missing host)"}:${port} secure=${secure} user=${user || "(none)"} pass=${pass ? "set" : "MISSING"}`
      );
      if (endpointHost.toLowerCase().startsWith("mail.")) {
        console.warn(
          "SMTP warning: mail.* hosts often time out from cloud VPS. Prefer SMTP_HOST=smtp.hostinger.com (port 465, SMTP_SECURE=true)."
        );
      }
    }
    console.log(`Inquiry auto-expiry: ${config.inquiryExpiryDays} days`);
    console.log("Trial ending reminders: hourly");
    if (config.logOtpToConsole) {
      console.log("DEV: OTP codes will be printed to this console on send-otp / register-request");
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
