import express from "express";
import cors from "cors";
import morgan from "morgan";
import { config } from "./lib/config.js";
import { UPLOAD_DIR, ensureUploadDir } from "./lib/uploadStorage.js";
import { authRouter } from "./routes/auth.js";
import { agenciesRouter } from "./routes/agencies.js";
import { toursRouter } from "./routes/tours.js";
import { entitiesRouter } from "./routes/entities.js";
import { inquiriesRouter } from "./routes/inquiries.js";
import { offersRouter } from "./routes/offers.js";
import { influencerRouter } from "./routes/influencer.js";
import { influencersRouter } from "./routes/influencers.js";
import { walletRouter } from "./routes/wallet.js";
import { adminRouter } from "./routes/admin/index.js";
import { driverRouter } from "./routes/driver.js";
import { driversRouter } from "./routes/drivers.js";
import { uploadsRouter } from "./routes/uploads.js";
import { savedToursRouter } from "./routes/savedTours.js";
import { savedTripPlansRouter } from "./routes/savedTripPlans.js";
import { notificationsRouter } from "./routes/notifications.js";
import { touristRouter } from "./routes/tourist.js";
import { cmsRouter } from "./routes/cms.js";
import { supportRouter } from "./routes/support.js";
import { domainsRouter } from "./routes/domains.js";
import { invoicesRouter } from "./routes/invoices.js";

export function createApp() {
  const app = express();

  ensureUploadDir();

  const allowlist = config.corsOrigins;
  const corsConfigured =
    Boolean(process.env.CORS_ORIGINS?.trim()) ||
    Boolean(process.env.HEADLESS_CORS_ORIGINS?.trim()) ||
    process.env.CORS_STRICT === "true";
  app.use(
    cors({
      origin(origin, cb) {
        // Non-browser / same-origin tools send no Origin header.
        if (!origin) return cb(null, true);
        // Open CORS until an allowlist is configured (or CORS_STRICT=true).
        if (!corsConfigured) return cb(null, true);
        if (allowlist.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan("dev"));
  app.use("/uploads", express.static(UPLOAD_DIR));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      service: "tourpilot-api",
      version: "1.0.0",
      build: process.env.BUILD_SHA ?? "dev",
      builtAt: process.env.BUILD_TIME ?? null,
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/agencies", agenciesRouter);
  app.use("/api/tours", toursRouter);
  app.use("/api/entities", entitiesRouter);
  app.use("/api/inquiries", inquiriesRouter);
  app.use("/api/offers", offersRouter);
  app.use("/api/influencer", influencerRouter);
  app.use("/api/influencers", influencersRouter);
  app.use("/api/wallet", walletRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/driver", driverRouter);
  app.use("/api/drivers", driversRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/saved-tours", savedToursRouter);
  app.use("/api/saved-trip-plans", savedTripPlansRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/tourist", touristRouter);
  app.use("/api/cms", cmsRouter);
  app.use("/api/support", supportRouter);
  app.use("/api/invoices", invoicesRouter);
  app.use("/api", domainsRouter);

  app.use(
    (
      err: Error & { status?: number; issues?: unknown },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if (err.name === "ZodError") {
        const issues = err.issues as Array<{ path: (string | number)[]; message: string }>;
        const first = issues[0];
        const field = first?.path?.length ? first.path.join(".") : "input";
        const message = first?.message
          ? `${field}: ${first.message}`
          : "Validation failed";
        return res.status(400).json({ error: message, details: issues });
      }
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Internal Server Error" });
    }
  );

  return app;
}
