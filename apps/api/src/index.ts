import { createApp } from "./app.js";
import { config } from "./lib/config.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();

async function main() {
  await prisma.$connect();
  app.listen(config.port, () => {
    console.log(`TourPilot API running on http://localhost:${config.port}`);
    if (config.logOtpToConsole) {
      console.log("DEV: OTP codes will be printed to this console on send-otp / register-request");
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
