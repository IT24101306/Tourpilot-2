import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/auth.js";

export const notificationsRouter = Router();

notificationsRouter.get("/mine", authRequired, async (req, res, next) => {
  try {
    const unreadOnly = req.query.unread === "true";
    const rows = await prisma.notification.findMany({
      where: {
        userId: req.user!.id,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

notificationsRouter.get("/mine/unread-count", authRequired, async (req, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.id, readAt: null },
    });
    res.json({ count });
  } catch (e) {
    next(e);
  }
});

notificationsRouter.patch("/:id/read", authRequired, async (req, res, next) => {
  try {
    const row = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!row) return res.status(404).json({ error: "Notification not found" });

    const updated = await prisma.notification.update({
      where: { id: row.id },
      data: { readAt: new Date() },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

notificationsRouter.post("/read-all", authRequired, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
