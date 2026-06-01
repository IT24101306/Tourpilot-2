import type { InquiryMessageKind } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function createInquiryMessage(
  inquiryId: string,
  authorId: string,
  kind: InquiryMessageKind,
  body: string,
  action?: string
) {
  return prisma.inquiryMessage.create({
    data: {
      inquiryId,
      authorId,
      kind,
      body: body.trim(),
      action,
    },
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
  });
}

export const inquiryMessagesInclude = {
  orderBy: { createdAt: "asc" as const },
  include: {
    author: { select: { id: true, name: true, role: true } },
  },
};

export function serializeInquiryMessage(message: {
  id: string;
  kind: string;
  body: string;
  action: string | null;
  createdAt: Date;
  author: { id: string; name: string; role: string };
}) {
  return {
    id: message.id,
    kind: message.kind,
    body: message.body,
    action: message.action,
    createdAt: message.createdAt,
    author: {
      id: message.author.id,
      name: message.author.name,
      role: message.author.role,
    },
  };
}

type ThreadAuthor = { id: string; name: string; role?: string };

type ThreadSourceInquiry = {
  id: string;
  message: string | null;
  createdAt: Date;
  tourist?: ThreadAuthor | null;
  agency?: ThreadAuthor | null;
  responses?: Array<{
    id: string;
    message: string;
    createdAt: Date;
    authorId: string;
    author?: ThreadAuthor | null;
  }>;
  messages?: Array<Parameters<typeof serializeInquiryMessage>[0]>;
};

function messageDedupeKey(kind: string, body: string, createdAt: Date | string) {
  return `${kind}:${body.trim()}:${new Date(createdAt).getTime()}`;
}

/** Merge stored chat messages, legacy responses, and the original inquiry text into one timeline. */
export function buildInquiryThread(inquiry: ThreadSourceInquiry) {
  const entries: ReturnType<typeof serializeInquiryMessage>[] = [];
  const seen = new Set<string>();

  const push = (entry: ReturnType<typeof serializeInquiryMessage>) => {
    const key = messageDedupeKey(entry.kind, entry.body, entry.createdAt);
    if (seen.has(key)) return;
    seen.add(key);
    entries.push(entry);
  };

  const stored = inquiry.messages ?? [];
  const hasStoredInitial = stored.some(
    (m) => m.kind === "TOURIST" && m.action === "INQUIRY_CREATED"
  );

  const initialBody = inquiry.message?.trim();
  if (initialBody && !hasStoredInitial) {
    push({
      id: `inquiry-request-${inquiry.id}`,
      kind: "TOURIST",
      body: initialBody,
      action: "INQUIRY_CREATED",
      createdAt: inquiry.createdAt,
      author: inquiry.tourist
        ? {
            id: inquiry.tourist.id,
            name: inquiry.tourist.name,
            role: inquiry.tourist.role || "TOURIST",
          }
        : { id: "tourist", name: "Traveler", role: "TOURIST" },
    });
  }

  for (const msg of stored) {
    push(serializeInquiryMessage(msg));
  }

  for (const resp of inquiry.responses ?? []) {
    const respTime = new Date(resp.createdAt).getTime();
    const duplicated = stored.some(
      (m) =>
        m.kind === "AGENCY" &&
        m.body.trim() === resp.message.trim() &&
        Math.abs(new Date(m.createdAt).getTime() - respTime) < 5000
    );
    if (duplicated) continue;

    push({
      id: `legacy-response-${resp.id}`,
      kind: "AGENCY",
      body: resp.message,
      action: "PROPOSAL_SENT",
      createdAt: resp.createdAt,
      author: resp.author
        ? {
            id: resp.author.id,
            name: resp.author.name,
            role: resp.author.role || "AGENCY",
          }
        : { id: resp.authorId, name: "Agency", role: "AGENCY" },
    });
  }

  entries.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  return entries;
}
