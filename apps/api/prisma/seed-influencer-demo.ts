/**
 * Presentation-ready rows for the Island Vibes influencer account.
 * Covers every partner dashboard tab: overview stats, storefront, codes,
 * traveler chats, rate talks, commissions, and custom domain.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { CEYLON_TRAILS_HERO_IMAGES, MEDIA } from "@tourpilot/shared";
import { asJson } from "../src/utils/json.js";

const AVATAR =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80";

export type InfluencerDemoContext = {
  prisma: PrismaClient;
  influencer1: { id: string };
  influencerUser1: { id: string };
  agency1: { id: string };
  agencyUser1: { id: string };
  wildAgency: { id: string };
  wildTour: { id: string };
  tour1: { id: string };
  tour2: { id: string };
  tour3: { id: string };
  refIsland10: { id: string };
  agencyOffer: { id: string };
  platformOffer: { id: string };
  tourist1: { id: string };
  inquirySent: { id: string };
};

function daysFromNow(n: number) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function ensureTourist(
  prisma: PrismaClient,
  phone: string,
  name: string,
  extra: { email?: string; interests?: string[] }
) {
  return prisma.user.upsert({
    where: { phone },
    update: { name, email: extra.email, role: "TOURIST" },
    create: {
      phone,
      name,
      role: "TOURIST",
      email: extra.email,
      touristProfile: {
        create: { interests: extra.interests ?? ["beach"], loyaltyPoints: 40 },
      },
    },
  });
}

async function ensureInquiryByMessage(
  prisma: PrismaClient,
  message: string,
  data: Prisma.InquiryUncheckedCreateInput
) {
  const existing = await prisma.inquiry.findFirst({ where: { message } });
  if (existing) {
    return prisma.inquiry.update({
      where: { id: existing.id },
      data: {
        status: data.status,
        handlerInfluencerId: data.handlerInfluencerId,
        referralCodeId: data.referralCodeId,
        pax: data.pax,
        startDate: data.startDate,
        endDate: data.endDate,
      },
    });
  }
  return prisma.inquiry.create({ data: { ...data, message } });
}

async function ensureCommission(
  prisma: PrismaClient,
  inquiryId: string,
  data: { referralCodeId: string; influencerId: string; amountLkr: number; status: "PENDING" | "APPROVED" | "PAID" }
) {
  const existing = await prisma.commission.findFirst({ where: { inquiryId } });
  if (existing) {
    return prisma.commission.update({
      where: { id: existing.id },
      data: {
        amountLkr: data.amountLkr,
        status: data.status,
        referralCodeId: data.referralCodeId,
        influencerId: data.influencerId,
      },
    });
  }
  return prisma.commission.create({
    data: { inquiryId, ...data },
  });
}

async function ensureRateTalk(
  prisma: PrismaClient,
  key: { influencerId: string; tourId: string; status: "PENDING" | "NEGOTIATING" | "APPROVED" | "REJECTED" },
  data: Prisma.InfluencerCommissionRequestUncheckedCreateInput
) {
  const existing = await prisma.influencerCommissionRequest.findFirst({
    where: key,
  });
  if (existing) return existing;
  return prisma.influencerCommissionRequest.create({ data });
}

export async function seedInfluencerPresentationData(ctx: InfluencerDemoContext) {
  const { prisma } = ctx;
  const acceptedAt = daysAgo(12).toISOString();

  await prisma.user.update({
    where: { id: ctx.influencerUser1.id },
    data: {
      name: "Island Vibes",
      email: "hello@islandvibes.demo",
      avatarUrl: AVATAR,
      district: "Colombo",
      walletBalance: 23400,
    },
  });

  await prisma.tour.update({
    where: { id: ctx.tour1.id },
    data: {
      influencerInstructions:
        "<p>Lead with sunrise at Pidurangala, then Sigiriya. Mention that this is a small-group route with a certified cultural guide. Best months: year-round.</p>",
      influencerCommissionPct: 10,
      influencerCommissionLkr: 8950,
    },
  });
  await prisma.tour.update({
    where: { id: ctx.tour2.id },
    data: {
      influencerInstructions:
        "<p>This is the south-coast slow week: Galle Fort evenings, Mirissa mornings, optional whale watching Nov–Apr. Call out the relaxed pacing for couples.</p>",
      influencerCommissionPct: 8,
      influencerCommissionLkr: 11360,
    },
  });
  await prisma.tour.update({
    where: { id: ctx.tour3.id },
    data: {
      influencerInstructions:
        "<p>Film the Kandy–Ella train if you can. Tea tastings and Little Adam’s Peak are the shareable moments. Note: hill country is cooler — pack a layer.</p>",
      influencerCommissionPct: 8,
      influencerCommissionLkr: 9440,
    },
  });

  const refCoast = await prisma.referralCode.upsert({
    where: { code: "ISLANDCOAST" },
    update: { clickCount: 428, isActive: true, tourId: ctx.tour2.id, commissionPct: 8, influencerId: ctx.influencer1.id },
    create: {
      influencerId: ctx.influencer1.id,
      tourId: ctx.tour2.id,
      code: "ISLANDCOAST",
      commissionPct: 8,
      clickCount: 428,
    },
  });
  const refElla = await prisma.referralCode.upsert({
    where: { code: "ISLANDELLA" },
    update: { clickCount: 187, isActive: true, tourId: ctx.tour3.id, commissionPct: 8, influencerId: ctx.influencer1.id },
    create: {
      influencerId: ctx.influencer1.id,
      tourId: ctx.tour3.id,
      code: "ISLANDELLA",
      commissionPct: 8,
      clickCount: 187,
    },
  });
  const refYala = await prisma.referralCode.upsert({
    where: { code: "YALAVIBES" },
    update: { clickCount: 54, isActive: true, tourId: ctx.wildTour.id, commissionPct: 12, influencerId: ctx.influencer1.id },
    create: {
      influencerId: ctx.influencer1.id,
      tourId: ctx.wildTour.id,
      code: "YALAVIBES",
      commissionPct: 12,
      clickCount: 54,
    },
  });

  await prisma.referralCode.update({
    where: { id: ctx.refIsland10.id },
    data: { clickCount: 612, isActive: true, commissionPct: 10 },
  });
  await prisma.referralCode.updateMany({
    where: {
      influencerId: ctx.influencer1.id,
      code: { notIn: ["ISLAND10", "ISLANDCOAST", "ISLANDELLA", "YALAVIBES", "RETIRED5"] },
    },
    data: { isActive: false },
  });
  await prisma.referralCode.updateMany({
    where: { code: "RETIRED5", influencerId: ctx.influencer1.id },
    data: { clickCount: 3, isActive: false },
  });

  await prisma.influencerProfile.update({
    where: { id: ctx.influencer1.id },
    data: {
      slug: "island-vibes",
      bio: "Sri Lanka travel creator — sunrises, slow coasts, and tea-country trains. I only share routes I would book myself.",
      socialLinks: asJson({
        instagram: "@islandvibes",
        tiktok: "@islandvibes",
        youtube: "@islandvibes",
        website: "https://islandvibes.lk",
      }),
      customDomain: "islandvibes.lk",
      customDomainStatus: "PENDING",
      display: asJson({
        headline: "Island Vibes — Sri Lanka, as I actually travel it",
        tagline: "Ready-made tours I send my audience — local agencies, transparent prices, no guesswork.",
        tourIds: [ctx.tour1.id, ctx.tour2.id, ctx.tour3.id, ctx.wildTour.id],
        offerIds: [ctx.agencyOffer.id, ctx.platformOffer.id],
        heroImages: CEYLON_TRAILS_HERO_IMAGES.slice(0, 6).map((s) => ({ ...s })),
        aboutTitle: "About Island Vibes",
        aboutDescription:
          "<p>I’m a Colombo-based creator filming Sri Lanka year-round — Pidurangala before dawn, slow weeks on the south coast, and the Kandy–Ella train whenever I can get a window seat.</p><p>These packages are the ones I actually recommend. Inquire on a tour marked as mine and I’ll help you lock dates with the agency.</p>",
        socialLinks: [
          { platform: "instagram", url: "https://www.instagram.com/islandvibes/", label: "@islandvibes" },
          { platform: "tiktok", url: "https://www.tiktok.com/@islandvibes", label: "@islandvibes" },
          { platform: "youtube", url: "https://www.youtube.com/@islandvibes", label: "Island Vibes" },
          { platform: "website", url: "https://islandvibes.lk", label: "islandvibes.lk" },
        ],
        socialTagHandle: "@islandvibes",
        tourSettings: {
          [ctx.tour1.id]: {
            termsAcceptedAt: acceptedAt,
            shareAsMine: true,
            hideAgencyName: true,
            displayPriceLkr: 96500,
            coverUrl: MEDIA.cultural,
            galleryImages: [
              { url: CEYLON_TRAILS_HERO_IMAGES[0].url, label: "Sigiriya" },
              { url: CEYLON_TRAILS_HERO_IMAGES[8].url, label: "Ancient sites" },
              { url: MEDIA.nature, label: "Sunrise hike" },
            ],
          },
          [ctx.tour2.id]: {
            termsAcceptedAt: acceptedAt,
            shareAsMine: true,
            hideAgencyName: true,
            displayPriceLkr: 155000,
            coverUrl: MEDIA.coast,
            galleryImages: [
              { url: CEYLON_TRAILS_HERO_IMAGES[4].url, label: "South coast" },
              { url: CEYLON_TRAILS_HERO_IMAGES[5].url, label: "Stilt fishermen" },
              { url: MEDIA.coast, label: "Mirissa" },
            ],
          },
          [ctx.tour3.id]: {
            termsAcceptedAt: acceptedAt,
            shareAsMine: false,
            displayPriceLkr: 118000,
            coverUrl: MEDIA.nature,
            galleryImages: [{ url: CEYLON_TRAILS_HERO_IMAGES[7].url, label: "Tea country train" }],
          },
          [ctx.wildTour.id]: {
            termsAcceptedAt: acceptedAt,
            shareAsMine: false,
            displayPriceLkr: 67500,
            coverUrl: MEDIA.nature,
          },
        },
      }),
    },
  });

  const maya = await ensureTourist(prisma, "+94771001001", "Maya Fernando", {
    email: "maya.fernando@demo.travel",
    interests: ["culture", "sunrise"],
  });
  const luca = await ensureTourist(prisma, "+94771001002", "Luca Rossi", {
    email: "luca.rossi@demo.travel",
    interests: ["beach", "food"],
  });
  const sophie = await ensureTourist(prisma, "+94771001003", "Sophie Bennett", {
    email: "sophie.bennett@demo.travel",
    interests: ["wildlife", "family"],
  });
  const daniel = await ensureTourist(prisma, "+94771001004", "Daniel Park", {
    email: "daniel.park@demo.travel",
    interests: ["hiking", "tea"],
  });

  await prisma.inquiry.update({
    where: { id: ctx.inquirySent.id },
    data: { handlerInfluencerId: ctx.influencer1.id, referralCodeId: ctx.refIsland10.id },
  });

  if (
    !(await prisma.inquiryMessage.findFirst({
      where: { inquiryId: ctx.inquirySent.id, kind: "INFLUENCER" },
    }))
  ) {
    await prisma.inquiryMessage.create({
      data: {
        inquiryId: ctx.inquirySent.id,
        authorId: ctx.influencerUser1.id,
        kind: "INFLUENCER",
        body: "Hi Emma — I’ve flagged the sunrise hike with the agency. Happy to walk you through the three days whenever you’re free.",
      },
    });
  }

  const chatNew = await ensureInquiryByMessage(
    prisma,
    "Saw your Sigiriya reel — can we do this in late September for two?",
    {
      touristId: maya.id,
      agencyId: ctx.agency1.id,
      tourId: ctx.tour1.id,
      type: "READY_MADE",
      status: "NEW",
      pax: 2,
      startDate: daysFromNow(28),
      endDate: daysFromNow(31),
      referralCodeId: ctx.refIsland10.id,
      handlerInfluencerId: ctx.influencer1.id,
      statusHistory: { create: { status: "NEW", actorId: maya.id } },
    }
  );
  if (!(await prisma.inquiryMessage.findFirst({ where: { inquiryId: chatNew.id } }))) {
    await prisma.inquiryMessage.create({
      data: {
        inquiryId: chatNew.id,
        authorId: maya.id,
        kind: "TOURIST",
        body: "Hi! Loved the Pidurangala sunrise clip. We’re two adults, flexible on hotels, hoping for late September.",
      },
    });
  }

  const chatCoast = await ensureInquiryByMessage(
    prisma,
    "South coast week for our anniversary — whale watching if the season allows.",
    {
      touristId: luca.id,
      agencyId: ctx.agency1.id,
      tourId: ctx.tour2.id,
      type: "READY_MADE",
      status: "SENT_TO_TOURIST",
      pax: 2,
      startDate: daysFromNow(40),
      endDate: daysFromNow(45),
      referralCodeId: refCoast.id,
      handlerInfluencerId: ctx.influencer1.id,
      statusHistory: {
        create: [
          { status: "NEW", actorId: luca.id },
          { status: "AGENCY_REVIEWING", actorId: ctx.agencyUser1.id },
          { status: "SENT_TO_TOURIST", actorId: ctx.influencerUser1.id },
        ],
      },
    }
  );
  if (!(await prisma.inquiryMessage.findFirst({ where: { inquiryId: chatCoast.id } }))) {
    await prisma.inquiryMessage.createMany({
      data: [
        {
          inquiryId: chatCoast.id,
          authorId: luca.id,
          kind: "TOURIST",
          body: "Anniversary trip — Galle + Mirissa, no rush. Is whale watching running in April?",
        },
        {
          inquiryId: chatCoast.id,
          authorId: ctx.influencerUser1.id,
          kind: "INFLUENCER",
          body: "April is still a good window. I’ve asked the agency to hold a quiet Galle Fort stay and a morning boat on day 3.",
        },
        {
          inquiryId: chatCoast.id,
          authorId: luca.id,
          kind: "TOURIST",
          body: "Perfect — we’ll look at the itinerary tonight.",
        },
      ],
    });
  }

  const chatAccepted = await ensureInquiryByMessage(
    prisma,
    "Booked the cultural triangle via Island Vibes — paid commission demo.",
    {
      touristId: sophie.id,
      agencyId: ctx.agency1.id,
      tourId: ctx.tour1.id,
      type: "READY_MADE",
      status: "ACCEPTED",
      pax: 2,
      startDate: daysFromNow(18),
      endDate: daysFromNow(21),
      referralCodeId: ctx.refIsland10.id,
      handlerInfluencerId: ctx.influencer1.id,
      statusHistory: {
        create: [
          { status: "NEW", actorId: sophie.id },
          { status: "SENT_TO_TOURIST", actorId: ctx.influencerUser1.id },
          { status: "ACCEPTED", actorId: sophie.id },
        ],
      },
    }
  );
  if (!(await prisma.inquiryMessage.findFirst({ where: { inquiryId: chatAccepted.id } }))) {
    await prisma.inquiryMessage.createMany({
      data: [
        {
          inquiryId: chatAccepted.id,
          authorId: sophie.id,
          kind: "TOURIST",
          body: "We’re in — please confirm the village stay and the sunrise slot.",
        },
        {
          inquiryId: chatAccepted.id,
          authorId: ctx.influencerUser1.id,
          kind: "INFLUENCER",
          body: "Confirmed with the agency. You’re locked for the 3-day cultural triangle. I’ll send a packing note this week.",
        },
      ],
    });
  }

  const ellaPending = await ensureInquiryByMessage(
    prisma,
    "Ella tea trails via ISLANDELLA — waiting on itinerary.",
    {
      touristId: daniel.id,
      agencyId: ctx.agency1.id,
      tourId: ctx.tour3.id,
      type: "READY_MADE",
      status: "AGENCY_REVIEWING",
      pax: 2,
      startDate: daysFromNow(55),
      endDate: daysFromNow(59),
      referralCodeId: refElla.id,
      handlerInfluencerId: ctx.influencer1.id,
      statusHistory: {
        create: [
          { status: "NEW", actorId: daniel.id },
          { status: "AGENCY_REVIEWING", actorId: ctx.agencyUser1.id },
        ],
      },
    }
  );

  const yalaPaid = await ensureInquiryByMessage(
    prisma,
    "Yala weekend via YALAVIBES — safari confirmed.",
    {
      touristId: ctx.tourist1.id,
      agencyId: ctx.wildAgency.id,
      tourId: ctx.wildTour.id,
      type: "READY_MADE",
      status: "ACCEPTED",
      pax: 2,
      startDate: daysAgo(20),
      endDate: daysAgo(18),
      referralCodeId: refYala.id,
      handlerInfluencerId: ctx.influencer1.id,
      statusHistory: {
        create: [
          { status: "NEW", actorId: ctx.tourist1.id },
          { status: "ACCEPTED", actorId: ctx.tourist1.id },
        ],
      },
    }
  );

  const coastApproved = await ensureInquiryByMessage(
    prisma,
    "South coast booking via ISLANDCOAST — commission approved, payout pending.",
    {
      touristId: luca.id,
      agencyId: ctx.agency1.id,
      tourId: ctx.tour2.id,
      type: "READY_MADE",
      status: "COMPLETED",
      pax: 2,
      startDate: daysAgo(40),
      endDate: daysAgo(35),
      referralCodeId: refCoast.id,
      handlerInfluencerId: ctx.influencer1.id,
      statusHistory: {
        create: [
          { status: "NEW", actorId: luca.id },
          { status: "ACCEPTED", actorId: luca.id },
          { status: "COMPLETED", actorId: ctx.agencyUser1.id },
        ],
      },
    }
  );

  await ensureCommission(prisma, ctx.inquirySent.id, {
    referralCodeId: ctx.refIsland10.id,
    influencerId: ctx.influencer1.id,
    amountLkr: 7160,
    status: "PENDING",
  });
  await ensureCommission(prisma, ellaPending.id, {
    referralCodeId: refElla.id,
    influencerId: ctx.influencer1.id,
    amountLkr: 5420,
    status: "PENDING",
  });
  await ensureCommission(prisma, coastApproved.id, {
    referralCodeId: refCoast.id,
    influencerId: ctx.influencer1.id,
    amountLkr: 8960,
    status: "APPROVED",
  });
  await ensureCommission(prisma, chatAccepted.id, {
    referralCodeId: ctx.refIsland10.id,
    influencerId: ctx.influencer1.id,
    amountLkr: 11360,
    status: "PAID",
  });
  await ensureCommission(prisma, yalaPaid.id, {
    referralCodeId: refYala.id,
    influencerId: ctx.influencer1.id,
    amountLkr: 7040,
    status: "PAID",
  });

  const paidInquiry = await prisma.inquiry.findFirst({
    where: {
      touristId: ctx.tourist1.id,
      agencyId: ctx.agency1.id,
      tourId: ctx.tour2.id,
      status: "ACCEPTED",
      message: { contains: "ISLAND10" },
    },
  });
  if (paidInquiry) {
    await prisma.inquiry.update({
      where: { id: paidInquiry.id },
      data: { handlerInfluencerId: ctx.influencer1.id },
    });
    await ensureCommission(prisma, paidInquiry.id, {
      referralCodeId: ctx.refIsland10.id,
      influencerId: ctx.influencer1.id,
      amountLkr: 5000,
      status: "PAID",
    });
  }

  await ensureRateTalk(
    prisma,
    { influencerId: ctx.influencer1.id, tourId: ctx.tour1.id, status: "APPROVED" },
    {
      influencerId: ctx.influencer1.id,
      tourId: ctx.tour1.id,
      agencyId: ctx.agency1.id,
      requestedPct: 12,
      currentOfferPct: 10,
      approvedPct: 10,
      message: "This is my most-shared cultural route — can we meet at 12%?",
      agencyNote: "Happy to lock 10% on Cultural Triangle Escape.",
      status: "APPROVED",
      pendingActor: "AGENCY",
      offerByRole: "AGENCY",
      messages: {
        create: [
          {
            authorRole: "INFLUENCER",
            authorId: ctx.influencerUser1.id,
            action: "REQUEST",
            proposedPct: 12,
            body: "This tour converts well for my audience. Could we try 12%?",
          },
          {
            authorRole: "AGENCY",
            authorId: ctx.agencyUser1.id,
            action: "NEGOTIATE",
            proposedPct: 10,
            body: "We can do 10% as a standing rate for this package.",
          },
          {
            authorRole: "INFLUENCER",
            authorId: ctx.influencerUser1.id,
            action: "AGREE",
            proposedPct: 10,
            body: "10% works — let’s lock it.",
          },
        ],
      },
    }
  );

  await ensureRateTalk(
    prisma,
    { influencerId: ctx.influencer1.id, tourId: ctx.tour2.id, status: "NEGOTIATING" },
    {
      influencerId: ctx.influencer1.id,
      tourId: ctx.tour2.id,
      agencyId: ctx.agency1.id,
      requestedPct: 12,
      currentOfferPct: 9,
      message: "South coast is my highest-engagement series. Looking for 12%.",
      status: "NEGOTIATING",
      pendingActor: "INFLUENCER",
      offerByRole: "AGENCY",
      messages: {
        create: [
          {
            authorRole: "INFLUENCER",
            authorId: ctx.influencerUser1.id,
            action: "REQUEST",
            proposedPct: 12,
            body: "Whale-watching season is about to peak — can we do 12% on South Coast Slow Travel?",
          },
          {
            authorRole: "AGENCY",
            authorId: ctx.agencyUser1.id,
            action: "NEGOTIATE",
            proposedPct: 9,
            body: "Margins are tighter on coastal stays. We can offer 9% if you keep the listing as yours.",
          },
        ],
      },
    }
  );

  await ensureRateTalk(
    prisma,
    { influencerId: ctx.influencer1.id, tourId: ctx.tour3.id, status: "PENDING" },
    {
      influencerId: ctx.influencer1.id,
      tourId: ctx.tour3.id,
      agencyId: ctx.agency1.id,
      requestedPct: 11,
      currentOfferPct: 11,
      message: "Tea-country train content performs well. Requesting 11% on Ella Tea Trails.",
      status: "PENDING",
      pendingActor: "AGENCY",
      offerByRole: "INFLUENCER",
      messages: {
        create: [
          {
            authorRole: "INFLUENCER",
            authorId: ctx.influencerUser1.id,
            action: "REQUEST",
            proposedPct: 11,
            body: "I’d like 11% on Ella Tea Trails before I feature it in next month’s reel.",
          },
        ],
      },
    }
  );

  await ensureRateTalk(
    prisma,
    { influencerId: ctx.influencer1.id, tourId: ctx.wildTour.id, status: "REJECTED" },
    {
      influencerId: ctx.influencer1.id,
      tourId: ctx.wildTour.id,
      agencyId: ctx.wildAgency.id,
      requestedPct: 15,
      currentOfferPct: 12,
      message: "Safari weekends sell out when I post — looking for 15%.",
      agencyNote: "We already sit at 12% platform-wide for this route.",
      status: "REJECTED",
      pendingActor: "AGENCY",
      offerByRole: "AGENCY",
      messages: {
        create: [
          {
            authorRole: "INFLUENCER",
            authorId: ctx.influencerUser1.id,
            action: "REQUEST",
            proposedPct: 15,
            body: "Yala is a stretch for my usual audience. 15% would help me push it harder.",
          },
          {
            authorRole: "AGENCY",
            authorId:
              (
                await prisma.agency.findUnique({
                  where: { id: ctx.wildAgency.id },
                  select: { ownerId: true },
                })
              )?.ownerId ?? ctx.agencyUser1.id,
            action: "REJECT",
            proposedPct: 12,
            body: "We need to stay at 12% on safari weekends. Happy to revisit next season.",
          },
        ],
      },
    }
  );

  const ledger = [
    { type: "COMMISSION" as const, amountLkr: 11360, balanceAfter: 11360, note: "Cultural triangle — Sophie Bennett" },
    { type: "COMMISSION" as const, amountLkr: 7040, balanceAfter: 18400, note: "Yala weekend — Emma Tourist" },
    { type: "COMMISSION" as const, amountLkr: 5000, balanceAfter: 23400, note: "South coast — Emma (ISLAND10)" },
  ];
  for (const row of ledger) {
    const exists = await prisma.walletLedger.findFirst({
      where: { userId: ctx.influencerUser1.id, note: row.note },
    });
    if (!exists) {
      await prisma.walletLedger.create({
        data: { userId: ctx.influencerUser1.id, ...row },
      });
    }
  }

  const notices = [
    {
      type: "INQUIRY_CHAT",
      title: "Maya asked about September dates",
      body: "New chat on Cultural Triangle Escape.",
      inquiryId: chatNew.id,
      readAt: null as Date | null,
    },
    {
      type: "INQUIRY_CHAT",
      title: "Luca replied in south-coast chat",
      body: "Anniversary trip — they’ll review the itinerary tonight.",
      inquiryId: chatCoast.id,
      readAt: null,
    },
    {
      type: "COMMISSION_PAID",
      title: "Commission paid",
      body: "LKR 11,360 credited for Sophie Bennett’s cultural triangle booking.",
      inquiryId: chatAccepted.id,
      readAt: daysAgo(2),
    },
    {
      type: "COMMISSION_REQUEST",
      title: "Agency countered at 9%",
      body: "Lanka Tour Trails offered 9% on South Coast Slow Travel.",
      inquiryId: null,
      readAt: null,
    },
  ];
  for (const n of notices) {
    const exists = await prisma.notification.findFirst({
      where: { userId: ctx.influencerUser1.id, title: n.title },
    });
    if (!exists) {
      await prisma.notification.create({
        data: { userId: ctx.influencerUser1.id, ...n },
      });
    }
  }

  for (const row of [
    { referralCodeId: ctx.refIsland10.id, userId: maya.id, sessionId: "island-maya-1" },
    { referralCodeId: refCoast.id, userId: luca.id, sessionId: "island-luca-1" },
    { referralCodeId: refElla.id, userId: daniel.id, sessionId: "island-daniel-1" },
    { referralCodeId: refYala.id, userId: ctx.tourist1.id, sessionId: "island-emma-yala" },
  ]) {
    const exists = await prisma.referralAttribution.findFirst({
      where: { referralCodeId: row.referralCodeId, sessionId: row.sessionId },
    });
    if (!exists) await prisma.referralAttribution.create({ data: row });
  }
}
