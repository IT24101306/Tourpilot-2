import { Router } from "express";
import { z } from "zod";
import { getSupportContent, getPublicSmartFeatures } from "../services/platformSettings.js";
import { authOptional } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import {
  addSupportMessage,
  assertSessionAccess,
  createOrResumeSupportSession,
  loadSessionThread,
  serializeSession,
} from "../services/supportChat.js";

export const supportRouter = Router();

/** Public support agents modal content (admin-editable). */
supportRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await getSupportContent());
  } catch (e) {
    next(e);
  }
});

const guestKeySchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/);

/**
 * Start or resume a live human support chat.
 * Anonymous visitors must send guestKey (stored in localStorage).
 */
supportRouter.post("/chat/sessions", authOptional, async (req, res, next) => {
  try {
    const body = z
      .object({
        guestKey: guestKeySchema.optional(),
        sessionId: z.string().min(1).max(40).optional(),
        pagePath: z.string().max(200).nullable().optional(),
        contactName: z.string().max(120).nullable().optional(),
        contactEmail: z.string().email().max(200).nullable().optional(),
        chatbotSummary: z.string().max(8000).nullable().optional(),
      })
      .parse(req.body || {});

    if (!req.user?.id && !body.guestKey) {
      return res.status(400).json({ error: "guestKey is required when not logged in" });
    }

    const flags = await getPublicSmartFeatures();
    if (!flags.liveSupportEnabled) {
      return res.status(403).json({
        error: "Talk to a human is turned off",
        code: "FEATURE_DISABLED",
      });
    }

    const session = await createOrResumeSupportSession({
      userId: req.user?.id ?? null,
      guestKey: body.guestKey ?? null,
      sessionId: body.sessionId ?? null,
      pagePath: body.pagePath ?? null,
      contactName: body.contactName ?? null,
      contactEmail: body.contactEmail ?? null,
      chatbotSummary: body.chatbotSummary ?? null,
    });

    if (!session) {
      return res.status(500).json({ error: "Could not open support chat" });
    }

    res.json(serializeSession(session, { includeMessages: true }));
  } catch (e) {
    next(e);
  }
});

supportRouter.get("/chat/sessions/:id", authOptional, async (req, res, next) => {
  try {
    const guestKey = typeof req.query.guestKey === "string" ? req.query.guestKey : null;
    if (guestKey) guestKeySchema.parse(guestKey);

    const access = await assertSessionAccess(req.params.id, {
      userId: req.user?.id,
      guestKey,
    });
    if (!access) return res.status(404).json({ error: "Support chat not found" });

    const session = await loadSessionThread(access.id);
    if (!session) return res.status(404).json({ error: "Support chat not found" });

    res.json(serializeSession(session, { includeMessages: true }));
  } catch (e) {
    next(e);
  }
});

supportRouter.post("/chat/sessions/:id/messages", authOptional, async (req, res, next) => {
  try {
    const body = z
      .object({
        guestKey: guestKeySchema.optional(),
        body: z.string().min(1).max(4000),
      })
      .parse(req.body || {});

    const access = await assertSessionAccess(req.params.id, {
      userId: req.user?.id,
      guestKey: body.guestKey ?? null,
    });
    if (!access) return res.status(404).json({ error: "Support chat not found" });

    const result = await addSupportMessage({
      sessionId: access.id,
      sender: "USER",
      authorId: req.user?.id ?? null,
      body: body.body,
    });

    const session = await loadSessionThread(access.id);
    res.json({
      message: result.message,
      session: session
        ? serializeSession(session, { includeMessages: true })
        : result.session,
    });
  } catch (e) {
    next(e);
  }
});

/** Visitor Clear: disconnect local client; keep admin history. */
supportRouter.post("/chat/sessions/:id/leave", authOptional, async (req, res, next) => {
  try {
    const body = z
      .object({
        guestKey: guestKeySchema.optional(),
      })
      .parse(req.body || {});

    const access = await assertSessionAccess(req.params.id, {
      userId: req.user?.id,
      guestKey: body.guestKey ?? null,
    });
    if (!access) return res.status(404).json({ error: "Support chat not found" });

    await prisma.supportMessage.create({
      data: {
        sessionId: access.id,
        sender: "SYSTEM",
        body: "Visitor cleared the chat on their side.",
      },
    });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
