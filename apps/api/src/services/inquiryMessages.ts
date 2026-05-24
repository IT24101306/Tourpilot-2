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
