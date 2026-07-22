import { createApp } from "./app.js";
import { config } from "./lib/config.js";
import { prisma } from "./lib/prisma.js";
import { startInquiryExpiryScheduler } from "./services/inquiryExpiry.js";

const app = createApp();

async function main() {
  await prisma.$connect();
  startInquiryExpiryScheduler();
  app.listen(config.port, () => {
    console.log(`TourPilot API running on http://localhost:${config.port}`);
    console.log(`Email mode: ${config.email.mode}`);
    if (config.email.mode === "smtp") {
      const { host, port, user, pass, secure } = config.email.smtp;
      console.log(
        `SMTP: ${host || "(missing host)"}:${port} secure=${secure} user=${user || "(none)"} pass=${pass ? "set" : "MISSING"}`
      );
    }
    console.log(`Inquiry auto-expiry: ${config.inquiryExpiryDays} days`);
    if (config.logOtpToConsole) {
      console.log("DEV: OTP codes will be printed to this console on send-otp / register-request");
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
