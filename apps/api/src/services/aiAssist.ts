import { chatAssistSuggestions, draftProposalIntro, softAiMomentsForContext } from "@tourpilot/shared";
import { prisma } from "../lib/prisma.js";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

export async function buildInquiryAssist(inquiryId: string, role: "AGENCY" | "TOURIST" | "INFLUENCER") {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: {
      tourist: { select: { name: true } },
      tour: { select: { title: true } },
      agency: {
        select: {
          name: true,
          _count: { select: { entities: true } },
        },
      },
      proposal: { select: { id: true } },
    },
  });

  if (!inquiry) return null;

  const suggestions = chatAssistSuggestions({
    partnerName: inquiry.tourist.name,
    tourTitle: inquiry.tour?.title,
    status: inquiry.status,
    pax: inquiry.pax,
    budgetBand: inquiry.budgetBand,
  });

  const moments = softAiMomentsForContext({
    role,
    status: inquiry.status,
    hasProposal: Boolean(inquiry.proposal),
    entityCount: inquiry.agency._count.entities,
  });

  const proposalIntro = draftProposalIntro({
    touristName: inquiry.tourist.name,
    tourTitle: inquiry.tour?.title,
    pax: inquiry.pax,
    interests: asStringArray(inquiry.interests),
  });

  return {
    inquiryId: inquiry.id,
    status: inquiry.status,
    suggestions,
    moments,
    proposalIntro,
    softTips: moments,
  };
}
