import type { SupportMessage, SupportSession } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { config } from "../lib/config.js";
import {
  absolutePublicUrl,
  sendPlatformEmail,
  supportChatEmail,
} from "./email.js";
import { getPlatformSettings } from "./platformSettings.js";

export type SerializedSupportMessage = {
  id: string;
  sender: "USER" | "ADMIN" | "SYSTEM";
  body: string;
  authorName: string | null;
  createdAt: string;
};

export type SerializedSupportSession = {
  id: string;
  status: "OPEN" | "CLOSED";
  pagePath: string | null;
  contactName: string | null;
  contactEmail: string | null;
  chatbotSummary: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedAdmin: { id: string; name: string } | null;
  user: { id: string; name: string; phone: string; email: string | null } | null;
  guestKey: string | null;
  messages?: SerializedSupportMessage[];
  preview?: string | null;
};

function serializeMessage(
  m: SupportMessage & { author?: { name: string } | null }
): SerializedSupportMessage {
  return {
    id: m.id,
    sender: m.sender,
    body: m.body,
    authorName: m.author?.name ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

export function serializeSession(
  session: SupportSession & {
    assignedAdmin?: { id: string; name: string } | null;
    user?: { id: string; name: string; phone: string; email: string | null } | null;
    messages?: Array<SupportMessage & { author?: { name: string } | null }>;
  },
  opts?: { includeMessages?: boolean; preview?: string | null }
): SerializedSupportSession {
  return {
    id: session.id,
    status: session.status,
    pagePath: session.pagePath,
    contactName: session.contactName,
    contactEmail: session.contactEmail,
    chatbotSummary: session.chatbotSummary,
    lastMessageAt: session.lastMessageAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    assignedAdmin: session.assignedAdmin
      ? { id: session.assignedAdmin.id, name: session.assignedAdmin.name }
      : null,
    user: session.user
      ? {
          id: session.user.id,
          name: session.user.name,
          phone: session.user.phone,
          email: session.user.email,
        }
      : null,
    guestKey: session.guestKey,
    messages: opts?.includeMessages
      ? (session.messages || []).map(serializeMessage)
      : undefined,
    preview: opts?.preview ?? null,
  };
}

export async function assertSessionAccess(
  sessionId: string,
  opts: { userId?: string | null; guestKey?: string | null; asAdmin?: boolean }
) {
  const session = await prisma.supportSession.findUnique({
    where: { id: sessionId },
    include: {
      assignedAdmin: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, phone: true, email: true } },
    },
  });
  if (!session) return null;
  if (opts.asAdmin) return session;

  if (opts.userId && session.userId === opts.userId) return session;
  if (opts.guestKey && session.guestKey === opts.guestKey) return session;
  return null;
}

export async function findOpenSessionForVisitor(opts: {
  userId?: string | null;
  guestKey?: string | null;
}) {
  if (opts.userId) {
    const byUser = await prisma.supportSession.findFirst({
      where: { userId: opts.userId, status: "OPEN" },
      orderBy: { updatedAt: "desc" },
      include: {
        assignedAdmin: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, phone: true, email: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true } } },
        },
      },
    });
    if (byUser) return byUser;
  }
  if (opts.guestKey) {
    return prisma.supportSession.findFirst({
      where: { guestKey: opts.guestKey, status: "OPEN" },
      orderBy: { updatedAt: "desc" },
      include: {
        assignedAdmin: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, phone: true, email: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true } } },
        },
      },
    });
  }
  return null;
}

export async function createOrResumeSupportSession(input: {
  userId?: string | null;
  guestKey?: string | null;
  pagePath?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  chatbotSummary?: string | null;
  sessionId?: string | null;
}) {
  if (!input.userId && !input.guestKey) {
    throw Object.assign(new Error("guestKey or login required"), { status: 400 });
  }

  if (input.sessionId) {
    const existing = await assertSessionAccess(input.sessionId, {
      userId: input.userId,
      guestKey: input.guestKey,
    });
    if (existing) {
      const full = await prisma.supportSession.findUnique({
        where: { id: existing.id },
        include: {
          assignedAdmin: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, phone: true, email: true } },
          messages: {
            orderBy: { createdAt: "asc" },
            include: { author: { select: { name: true } } },
          },
        },
      });
      if (full) {
        if (full.status === "CLOSED") {
          await prisma.supportSession.update({
            where: { id: full.id },
            data: { status: "OPEN" },
          });
          full.status = "OPEN";
        }
        if (input.userId && !full.userId) {
          await prisma.supportSession.update({
            where: { id: full.id },
            data: { userId: input.userId },
          });
          full.userId = input.userId;
        }
        return full;
      }
    }
  }

  const open = await findOpenSessionForVisitor({
    userId: input.userId,
    guestKey: input.guestKey,
  });
  if (open) {
    const data: {
      pagePath?: string;
      contactName?: string;
      contactEmail?: string;
      chatbotSummary?: string;
      userId?: string;
    } = {};
    if (input.pagePath) data.pagePath = input.pagePath.slice(0, 200);
    if (input.contactName) data.contactName = input.contactName.slice(0, 120);
    if (input.contactEmail) data.contactEmail = input.contactEmail.slice(0, 200);
    if (input.chatbotSummary && !open.chatbotSummary) {
      data.chatbotSummary = input.chatbotSummary.slice(0, 8000);
    }
    if (input.userId && !open.userId) data.userId = input.userId;
    if (Object.keys(data).length) {
      await prisma.supportSession.update({ where: { id: open.id }, data });
      return loadSessionThread(open.id);
    }
    return open;
  }

  const session = await prisma.supportSession.create({
    data: {
      userId: input.userId || undefined,
      guestKey: input.guestKey || undefined,
      pagePath: input.pagePath?.slice(0, 200) || undefined,
      contactName: input.contactName?.slice(0, 120) || undefined,
      contactEmail: input.contactEmail?.slice(0, 200) || undefined,
      chatbotSummary: input.chatbotSummary?.slice(0, 8000) || undefined,
      messages: {
        create: {
          sender: "SYSTEM",
          body: "Connected to TourPilot support. An admin will reply here shortly.",
        },
      },
    },
    include: {
      assignedAdmin: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, phone: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  });

  return session;
}

export async function addSupportMessage(input: {
  sessionId: string;
  sender: "USER" | "ADMIN";
  authorId?: string | null;
  body: string;
}) {
  const body = input.body.trim().slice(0, 4000);
  if (!body) {
    throw Object.assign(new Error("Message is empty"), { status: 400 });
  }

  const session = await prisma.supportSession.findUnique({ where: { id: input.sessionId } });
  if (!session) {
    throw Object.assign(new Error("Support chat not found"), { status: 404 });
  }
  if (session.status === "CLOSED" && input.sender === "USER") {
    await prisma.supportSession.update({
      where: { id: session.id },
      data: { status: "OPEN" },
    });
  }

  const message = await prisma.supportMessage.create({
    data: {
      sessionId: input.sessionId,
      sender: input.sender,
      authorId: input.authorId || undefined,
      body,
    },
    include: { author: { select: { name: true } } },
  });

  const updated = await prisma.supportSession.update({
    where: { id: input.sessionId },
    data: {
      lastMessageAt: message.createdAt,
      ...(input.sender === "ADMIN" && input.authorId
        ? { assignedAdminId: input.authorId, status: "OPEN" as const }
        : {}),
    },
    include: {
      assignedAdmin: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, phone: true, email: true } },
    },
  });

  if (input.sender === "USER" && !session.adminNotifiedAt) {
    void notifyAdminsNewSupportSession(session.id).catch(console.error);
  }

  return { message: serializeMessage(message), session: serializeSession(updated) };
}

export async function loadSessionThread(sessionId: string) {
  return prisma.supportSession.findUnique({
    where: { id: sessionId },
    include: {
      assignedAdmin: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, phone: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
}

export async function listAdminSupportSessions(status?: "OPEN" | "CLOSED" | "ALL") {
  const where =
    !status || status === "ALL"
      ? {}
      : { status: status as "OPEN" | "CLOSED" };

  const rows = await prisma.supportSession.findMany({
    where,
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      assignedAdmin: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, phone: true, email: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { author: { select: { name: true } } },
      },
    },
  });

  return rows.map((row) =>
    serializeSession(row, {
      preview: row.messages[0]?.body ?? row.chatbotSummary ?? null,
    })
  );
}

async function notifyAdminsNewSupportSession(sessionId: string) {
  const session = await loadSessionThread(sessionId);
  if (!session) return;

  // Avoid duplicate blast emails for the same session.
  if (session.adminNotifiedAt) return;

  const settings = await getPlatformSettings();
  const baseUrl = (settings.webAppUrl || config.webAppUrl).replace(/\/$/, "");
  const inboxUrl = absolutePublicUrl(`/dashboard/admin/support?session=${session.id}`, baseUrl);

  const visitor =
    session.user?.name ||
    session.contactName ||
    (session.user?.phone ? `User ${session.user.phone}` : null) ||
    "Website visitor";

  const transcript = [
    session.chatbotSummary ? `AI context:\n${session.chatbotSummary}` : "",
    ...session.messages
      .filter((m) => m.sender !== "SYSTEM")
      .map((m) => `${m.sender}: ${m.body}`),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 6000);

  const mail = supportChatEmail({
    visitorName: visitor,
    pagePath: session.pagePath || "/",
    transcript: transcript || "(No messages yet — visitor opened live support.)",
    inboxUrl,
  });

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true, email: { not: null } },
    select: { email: true, name: true },
  });

  const emails = [
    ...new Set(
      admins
        .map((a) => a.email?.trim())
        .filter((e): e is string => Boolean(e))
    ),
  ];

  for (const to of emails) {
    await sendPlatformEmail({ to, ...mail });
  }

  await prisma.supportSession.update({
    where: { id: sessionId },
    data: { adminNotifiedAt: new Date() },
  });
}
