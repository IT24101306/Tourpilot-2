import { createServer } from "node:http";
import { createApp } from "./app.js";
import { config } from "./lib/config.js";
import { prisma } from "./lib/prisma.js";
import { attachChatRealtime } from "./services/chatRealtime.js";
import { startInquiryExpiryScheduler } from "./services/inquiryExpiry.js";
import { startTrialReminderScheduler } from "./services/trial.js";

const app = createApp();
const httpServer = createServer(app);

async function main() {
  await prisma.$connect();
  attachChatRealtime(httpServer);
  startInquiryExpiryScheduler();
  startTrialReminderScheduler();
  httpServer.listen(config.port, () => {
    console.log(`TourPilot API running on http://localhost:${config.port}`);
    console.log(`Realtime chat: socket.io on /socket.io`);
    console.log(`Email mode: ${config.email.mode}`);
    if (config.email.mode === "smtp") {
      const { host, port, user, pass, secure } = config.email.smtp;
      console.log(
        `SMTP: ${host || "(missing host)"}:${port} secure=${secure} user=${user || "(none)"} pass=${pass ? "set" : "MISSING"}`
      );
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
