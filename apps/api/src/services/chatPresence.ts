import { prisma } from "../lib/prisma.js";

const TYPING_TTL_MS = 3500;

export async function touchTyping(inquiryId: string, userId: string, typing: boolean) {
  const typingUntil = typing ? new Date(Date.now() + TYPING_TTL_MS) : null;
  return prisma.inquiryChatPresence.upsert({
    where: { inquiryId_userId: { inquiryId, userId } },
    create: {
      inquiryId,
      userId,
      lastReadAt: new Date(0),
      typingUntil,
    },
    update: { typingUntil },
  });
}

export async function markInquiryRead(inquiryId: string, userId: string, at = new Date()) {
  return prisma.inquiryChatPresence.upsert({
    where: { inquiryId_userId: { inquiryId, userId } },
    create: {
      inquiryId,
      userId,
      lastReadAt: at,
      typingUntil: null,
    },
    update: {
      lastReadAt: at,
      // Opening/reading the thread clears own typing flag.
      typingUntil: null,
    },
  });
}

export async function getChatPresence(inquiryId: string, viewerId: string, now = new Date()) {
  const rows = await prisma.inquiryChatPresence.findMany({
    where: { inquiryId },
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  const typing = rows
    .filter((r) => r.userId !== viewerId && r.typingUntil && r.typingUntil > now)
    .map((r) => ({
      userId: r.user.id,
      name: r.user.name,
      role: r.user.role,
      until: r.typingUntil!.toISOString(),
    }));

  const readCursors = rows.map((r) => ({
    userId: r.userId,
    lastReadAt: r.lastReadAt.toISOString(),
  }));

  // Earliest "other party" read cursor used for ticks on the viewer's outgoing messages.
  // Prefer the primary counterparty (anyone else who has a presence), falling back to max lastRead among others.
  const others = rows.filter((r) => r.userId !== viewerId);
  const counterpartyLastReadAt =
    others.length > 0
      ? new Date(Math.max(...others.map((r) => r.lastReadAt.getTime()))).toISOString()
      : null;

  return { typing, readCursors, counterpartyLastReadAt };
}

/** Whether a message authored by viewerId has been seen by at least one other participant. */
export function messageSeenByCounterparty(
  messageCreatedAt: Date | string,
  authorId: string,
  viewerId: string,
  counterpartyLastReadAt: string | null
): boolean | null {
  if (authorId !== viewerId) return null;
  if (!counterpartyLastReadAt) return false;
  return new Date(counterpartyLastReadAt).getTime() >= new Date(messageCreatedAt).getTime();
}
