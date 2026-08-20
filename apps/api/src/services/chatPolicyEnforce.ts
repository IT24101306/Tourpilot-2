import { InquiryMessageKind, type UserRole } from "@prisma/client";
import {
  CHAT_POLICY_REMOVED_NOTICE,
  chatPolicyCategoryLabel,
  scanChatPolicy,
  type ChatPolicyCategory,
  type ChatPolicyHit,
} from "@tourpilot/shared";
import { prisma } from "../lib/prisma.js";
import { asJson } from "../utils/json.js";
import { serializeInquiryMessage } from "./inquiryMessages.js";
import { emitChatMessage, emitInquiryUpdated } from "./chatRealtime.js";
import { notifyAdminsChatPolicyViolation } from "./notifications.js";

export { scanChatPolicy };

export function chatIsPaused(inquiry: { chatPausedAt?: Date | null }): boolean {
  return Boolean(inquiry.chatPausedAt);
}

export async function recordChatPolicyViolation(input: {
  inquiryId: string;
  authorId: string;
  authorRole: UserRole;
  body: string;
  hit: ChatPolicyHit;
  /** When false, only flag/pause — used when the visible body is already a removal notice. */
  insertNotice?: boolean;
}) {
  const categories = input.hit.categories;
  const now = new Date();
  const insertNotice = input.insertNotice !== false;

  const [violation, notice] = await prisma.$transaction(async (tx) => {
    const row = await tx.policyViolation.create({
      data: {
        inquiryId: input.inquiryId,
        offenderUserId: input.authorId,
        offenderRole: input.authorRole,
        categories: asJson(categories),
        originalBody: input.body.trim(),
      },
    });

    await tx.inquiry.update({
      where: { id: input.inquiryId },
      data: {
        chatPausedAt: now,
        chatPausedReason: "CONTACT_SHARE",
      },
    });

    const msg = insertNotice
      ? await tx.inquiryMessage.create({
          data: {
            inquiryId: input.inquiryId,
            authorId: input.authorId,
            kind: InquiryMessageKind.SYSTEM,
            body: CHAT_POLICY_REMOVED_NOTICE,
            action: "POLICY_REMOVED",
          },
          include: {
            author: { select: { id: true, name: true, role: true } },
          },
        })
      : null;

    return [row, msg] as const;
  });

  const serialized = notice ? serializeInquiryMessage(notice) : null;
  if (serialized) emitChatMessage(input.inquiryId, serialized);
  emitInquiryUpdated(input.inquiryId, "policy_pause");

  void notifyAdminsChatPolicyViolation({
    violationId: violation.id,
    inquiryId: input.inquiryId,
    offenderUserId: input.authorId,
    categories,
  }).catch(console.error);

  return { violation, notice: serialized, categories };
}

export function policyViolationError(categories: ChatPolicyCategory[]) {
  const labels = categories.map(chatPolicyCategoryLabel).join(", ");
  const err = new Error(
    `${CHAT_POLICY_REMOVED_NOTICE} Detected: ${labels}. This chat is paused for admin review.`
  ) as Error & { status: number; code: string };
  err.status = 403;
  err.code = "POLICY_VIOLATION";
  return err;
}

export function chatPausedError() {
  const err = new Error(
    "This chat is paused for a policy review. An admin will reopen it after review."
  ) as Error & { status: number; code: string };
  err.status = 423;
  err.code = "CHAT_PAUSED";
  return err;
}

export async function resumeInquiryChat(inquiryId: string, actorId: string, note?: string) {
  const open = await prisma.policyViolation.findMany({
    where: { inquiryId, status: "OPEN" },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    if (open.length) {
      await tx.policyViolation.updateMany({
        where: { inquiryId, status: "OPEN" },
        data: {
          status: "REVIEWED",
          reviewedAt: new Date(),
          reviewedById: actorId,
          reviewNote: note?.trim() || "Chat resumed by admin",
        },
      });
    }
    await tx.inquiry.update({
      where: { id: inquiryId },
      data: { chatPausedAt: null, chatPausedReason: null },
    });
  });

  emitInquiryUpdated(inquiryId, "policy_resume");
}
