import { Router } from "express";
import { getSupportContent } from "../services/platformSettings.js";

export const supportRouter = Router();

/** Public support agents modal content (admin-editable). */
supportRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await getSupportContent());
  } catch (e) {
    next(e);
  }
});
