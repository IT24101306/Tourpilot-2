import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";
import { getAgencyForUser } from "../middleware/auth.js";
import { getChatPresence, getTypingUsers, markInquiryRead, touchTyping } from "./chatPresence.js";

type AuthPayload = { sub: string; phone: string; role: string };

type AuthedSocket = Socket & {
  data: {
    user: { id: string; phone: string; role: string };
  };
};

let io: Server | null = null;

function roomName(inquiryId: string) {
  return `inquiry:${inquiryId}`;
}

async function assertSocketChatAccess(inquiryId: string, userId: string, role: string) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: {
      id: true,
      touristId: true,
      agencyId: true,
      handlerInfluencerId: true,
    },
  });
  if (!inquiry) return false;

  if (role === "TOURIST") return inquiry.touristId === userId;
  if (role === "ADMIN") return true;
  if (role === "AGENCY") {
    const agency = await getAgencyForUser(userId);
    return Boolean(agency && inquiry.agencyId === agency.id);
  }
  if (role === "INFLUENCER") {
    const profile = await prisma.influencerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return Boolean(profile && inquiry.handlerInfluencerId === profile.id);
  }
  return false;
}

export function attachChatRealtime(httpServer: HttpServer) {
  const allowlist = config.corsOrigins;
  const corsConfigured =
    Boolean(process.env.CORS_ORIGINS?.trim()) ||
    Boolean(process.env.HEADLESS_CORS_ORIGINS?.trim()) ||
    process.env.CORS_STRICT === "true";

  io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: corsConfigured ? allowlist : true,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        (typeof socket.handshake.headers.authorization === "string"
          ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, "")
          : undefined);
      if (!token) return next(new Error("Unauthorized"));
      const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
      (socket as AuthedSocket).data.user = {
        id: payload.sub,
        phone: payload.phone,
        role: payload.role,
      };
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (rawSocket) => {
    const socket = rawSocket as AuthedSocket;
    const user = socket.data.user;

    socket.on("join", async (payload: { inquiryId?: string }, ack?: (r: unknown) => void) => {
      try {
        const inquiryId = payload?.inquiryId;
        if (!inquiryId) {
          ack?.({ ok: false, error: "Missing inquiryId" });
          return;
        }
        const allowed = await assertSocketChatAccess(inquiryId, user.id, user.role);
        if (!allowed) {
          ack?.({ ok: false, error: "Forbidden" });
          return;
        }
        await socket.join(roomName(inquiryId));
        await markInquiryRead(inquiryId, user.id);
        const presence = await getChatPresence(inquiryId, user.id);
        const typingAll = await getTypingUsers(inquiryId);
        socket.to(roomName(inquiryId)).emit("presence", {
          inquiryId,
          typing: typingAll,
        });
        // Notify peers that messages may be seen.
        socket.to(roomName(inquiryId)).emit("read", {
          inquiryId,
          readerId: user.id,
          readAt: new Date().toISOString(),
        });
        ack?.({ ok: true, typing: presence.typing, counterpartyLastReadAt: presence.counterpartyLastReadAt });
      } catch (e) {
        ack?.({ ok: false, error: e instanceof Error ? e.message : "Join failed" });
      }
    });

    socket.on("leave", async (payload: { inquiryId?: string }) => {
      const inquiryId = payload?.inquiryId;
      if (!inquiryId) return;
      await touchTyping(inquiryId, user.id, false).catch(() => undefined);
      await socket.leave(roomName(inquiryId));
      const typingAll = await getTypingUsers(inquiryId).catch(() => []);
      socket.to(roomName(inquiryId)).emit("presence", {
        inquiryId,
        typing: typingAll,
      });
    });

    socket.on(
      "typing",
      async (payload: { inquiryId?: string; typing?: boolean }, ack?: (r: unknown) => void) => {
        try {
          const inquiryId = payload?.inquiryId;
          if (!inquiryId || typeof payload.typing !== "boolean") {
            ack?.({ ok: false });
            return;
          }
          const allowed = await assertSocketChatAccess(inquiryId, user.id, user.role);
          if (!allowed) {
            ack?.({ ok: false, error: "Forbidden" });
            return;
          }
          await touchTyping(inquiryId, user.id, payload.typing);
          const typingAll = await getTypingUsers(inquiryId);
          io?.to(roomName(inquiryId)).emit("presence", {
            inquiryId,
            typing: typingAll,
          });
          ack?.({ ok: true });
        } catch {
          ack?.({ ok: false });
        }
      }
    );

    socket.on("read", async (payload: { inquiryId?: string }, ack?: (r: unknown) => void) => {
      try {
        const inquiryId = payload?.inquiryId;
        if (!inquiryId) {
          ack?.({ ok: false });
          return;
        }
        const allowed = await assertSocketChatAccess(inquiryId, user.id, user.role);
        if (!allowed) {
          ack?.({ ok: false, error: "Forbidden" });
          return;
        }
        await markInquiryRead(inquiryId, user.id);
        const presence = await getChatPresence(inquiryId, user.id);
        socket.to(roomName(inquiryId)).emit("read", {
          inquiryId,
          readerId: user.id,
          readAt: new Date().toISOString(),
        });
        ack?.({ ok: true, counterpartyLastReadAt: presence.counterpartyLastReadAt });
      } catch {
        ack?.({ ok: false });
      }
    });

    socket.on("disconnect", () => {
      // Rooms are cleaned by socket.io; typing TTLs expire naturally.
    });
  });

  return io;
}

/** Broadcast a new chat message to everyone in the inquiry room. */
export function emitChatMessage(inquiryId: string, message: unknown) {
  if (!io) return;
  io.to(roomName(inquiryId)).emit("message", { inquiryId, message });
}

/** Broadcast inquiry/proposal refresh so trip rooms stay in sync. */
export function emitInquiryUpdated(inquiryId: string, reason: string = "updated") {
  if (!io) return;
  io.to(roomName(inquiryId)).emit("inquiry", { inquiryId, reason, at: new Date().toISOString() });
}

/** Broadcast typing list (all typers) to the inquiry room. */
export async function emitChatPresence(inquiryId: string, _viewerId?: string) {
  if (!io) return;
  const typing = await getTypingUsers(inquiryId);
  io.to(roomName(inquiryId)).emit("presence", {
    inquiryId,
    typing,
  });
}

export function getChatIo() {
  return io;
}
