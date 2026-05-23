import express from "express";
import cors from "cors";
import morgan from "morgan";
import { authRouter } from "./routes/auth.js";
import { agenciesRouter } from "./routes/agencies.js";
import { toursRouter } from "./routes/tours.js";
import { entitiesRouter } from "./routes/entities.js";
import { inquiriesRouter } from "./routes/inquiries.js";
import { offersRouter } from "./routes/offers.js";
import { influencerRouter } from "./routes/influencer.js";
import { walletRouter } from "./routes/wallet.js";
import { adminRouter } from "./routes/admin.js";
import { driverRouter } from "./routes/driver.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "tourpilot-api", version: "1.0.0" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/agencies", agenciesRouter);
  app.use("/api/tours", toursRouter);
  app.use("/api/entities", entitiesRouter);
  app.use("/api/inquiries", inquiriesRouter);
  app.use("/api/offers", offersRouter);
  app.use("/api/influencer", influencerRouter);
  app.use("/api/wallet", walletRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/driver", driverRouter);

  app.use(
    (
      err: Error & { status?: number; issues?: unknown },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if (err.name === "ZodError") {
        return res.status(400).json({ error: "Validation failed", details: err.issues });
      }
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Internal Server Error" });
    }
  );

  return app;
}
