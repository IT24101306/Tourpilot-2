import { Router } from "express";
import { getFxRates } from "../lib/fxRates.js";

export const fxRouter = Router();

/** Public live (cached) FX rates for display currency conversion. */
fxRouter.get("/rates", async (req, res, next) => {
  try {
    const force = req.query.refresh === "1" || req.query.refresh === "true";
    const payload = await getFxRates({ forceRefresh: force });
    res.setHeader("Cache-Control", payload.live ? "public, max-age=300" : "public, max-age=60");
    res.json(payload);
  } catch (e) {
    next(e);
  }
});
