/**
 * Additional demo rows for every Prisma model not fully covered by seed-demo.ts core pass.
 */
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { MEDIA, defaultAgencyKyc } from "@tourpilot/shared";
import { asJson } from "../src/utils/json.js";

export type DemoContext = {
  prisma: PrismaClient;
  phones: Record<string, string>;
  agency1: { id: string; slug: string };
  agency2: { id: string; slug: string };
  agencyUser1: { id: string };
  agencyUser2: { id: string };
  tourist1: { id: string };
  tourist2: { id: string };
  tourist3: { id: string };
  driverUser1: { id: string };
  driverUser2: { id: string };
  influencerUser1: { id: string };
  influencerUser2: { id: string };
  influencer1: { id: string };
  influencer2: { id: string };
  agencyDriver1: { id: string };
  tour1: { id: string; slug: string };
  tour2: { id: string; slug: string };
  tour3: { id: string; slug: string };
  hillGroup: { id: string };
  hotel: { id: string };
  viewpoint: { id: string };
  restaurant: { id: string };
  activity: { id: string };
  ellaHotel: { id: string };
  refIsland10: { id: string };
  refLanka20: { id: string };
  agencyOffer: { id: string };
  platformOffer: { id: string };
  inquirySent: { id: string };
};

function daysFromNow(n: number) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function ensureTourDay(
  prisma: PrismaClient,
  tourId: string,
  dayNumber: number,
  title: string,
  items: Array<{
    entityId?: string;
    groupId?: string;
    kind: "REQUIRED" | "OPTIONAL" | "UPGRADE";
    priceLkr?: number;
    label?: string;
    sortOrder: number;
  }>
) {
  const existing = await prisma.tourDay.findUnique({
    where: { tourId_dayNumber: { tourId, dayNumber } },
  });
  if (existing) return existing;

  return prisma.tourDay.create({
    data: {
      tourId,
      dayNumber,
      title,
      items: { create: items },
    },
  });
}

export async function seedExtendedData(ctx: DemoContext) {
  const { prisma } = ctx;

  // —— Richer user profiles ——
  await prisma.user.update({
    where: { id: ctx.tourist1.id },
    data: { email: "emma@demo.travel", district: "Western", avatarUrl: MEDIA.coast },
  });
  await prisma.user.update({
    where: { id: ctx.agencyUser1.id },
    data: { email: "ops@ceylon-trails.demo", avatarUrl: MEDIA.agencyCover },
  });
  await prisma.touristProfile.updateMany({
    where: { userId: ctx.tourist1.id },
    data: {
      followedAgencies: [ctx.agency1.id],
      mobilityNotes: "Prefer ground-floor rooms when possible.",
    },
  });
  await prisma.driverProfile.update({
    where: { userId: ctx.driverUser1.id },
    data: {
      bio: "Professional chauffeur for hill-country and cultural routes.",
      articles: [{ title: "Best scenic stops Kandy to Ella", url: "https://example.com/demo" }],
    },
  });

  // —— Rejected agency (admin approvals UI) ——
  const rejectedPhone = "+94778889900";
  const rejectedOwner = await prisma.user.upsert({
    where: { phone: rejectedPhone },
    update: {},
    create: {
      phone: rejectedPhone,
      name: "Sunrise Tours (Rejected)",
      role: "AGENCY",
      walletBalance: 0,
    },
  });

  const rejectedKyc = {
    ...defaultAgencyKyc({ legalBusinessName: "Sunrise Tours", businessEmail: "bad@demo.lk" }),
    district: "Galle",
    declarationsAccepted: true,
    submittedAt: daysAgo(10).toISOString(),
  };

  let rejectedAgency = await prisma.agency.findUnique({ where: { ownerId: rejectedOwner.id } });
  if (!rejectedAgency) {
    rejectedAgency = await prisma.agency.create({
      data: {
        ownerId: rejectedOwner.id,
        name: "Sunrise Tours",
        slug: "sunrise-tours-rejected",
        tagline: "Incomplete documentation",
        district: "Galle",
        status: "REJECTED",
        kyc: rejectedKyc,
        kycSubmittedAt: daysAgo(10),
        rejectionReason: "Tourism license document could not be verified.",
        rejectedAt: daysAgo(8),
        contactPhone: rejectedPhone,
        gallery: [{ url: MEDIA.coast, label: "Demo" }],
      },
    });
    await prisma.displaySettings.create({
      data: {
        agencyId: rejectedAgency.id,
        sections: { enabled: { tours: true }, content: { heroHeadline: "Sunrise Tours" } },
        theme: {},
      },
    });
  }

  // —— Third approved agency ——
  const wildPhone = "+94773334400";
  const wildOwner = await prisma.user.upsert({
    where: { phone: wildPhone },
    update: { walletBalance: 800 },
    create: {
      phone: wildPhone,
      name: "Wild Coast Expeditions",
      role: "AGENCY",
      walletBalance: 800,
      email: "hello@wildcoast.demo",
    },
  });

  const wildAgency = await prisma.agency.upsert({
    where: { ownerId: wildOwner.id },
    update: { status: "APPROVED", avgRating: 4.6, reviewCount: 38 },
    create: {
      ownerId: wildOwner.id,
      name: "Wild Coast Expeditions",
      slug: "wild-coast",
      tagline: "Safari & reef adventures",
      description: "Wildlife-forward itineraries from Yala to Trincomalee.",
      district: "Hambantota",
      coverUrl: MEDIA.nature,
      logoUrl: MEDIA.coast,
      status: "APPROVED",
      avgRating: 4.6,
      reviewCount: 38,
      influencerCommissionPct: 12,
      contactPhone: wildPhone,
      gallery: [{ url: MEDIA.nature, label: "Yala" }],
      kyc: {
        ...defaultAgencyKyc({ legalBusinessName: "Wild Coast (Pvt) Ltd" }),
        district: "Hambantota",
        declarationsAccepted: true,
        submittedAt: daysAgo(30).toISOString(),
      },
      kycSubmittedAt: daysAgo(30),
    },
  });

  const wildTour = await prisma.tour.upsert({
    where: { agencyId_slug: { agencyId: wildAgency.id, slug: "yala-safari-weekend" } },
    update: { isPublished: true },
    create: {
      agencyId: wildAgency.id,
      title: "Yala Safari Weekend",
      slug: "yala-safari-weekend",
      summary: "Two-night safari with naturalist guide",
      days: 2,
      basePriceLkr: 67500,
      coverUrl: MEDIA.nature,
      isPublished: true,
      districtTags: ["Yala"],
      media: [{ kind: "image", url: MEDIA.nature, label: "Leopard track" }],
    },
  });

  let yalaLodge = await prisma.entity.findFirst({
    where: { agencyId: wildAgency.id, name: "Yala Safari Lodge" },
  });
  if (!yalaLodge) {
    yalaLodge = await prisma.entity.create({
      data: {
        agencyId: wildAgency.id,
        name: "Yala Safari Lodge",
        type: "HOTEL",
        city: "Yala",
        priceHint: 22000,
        durationMin: 720,
      },
    });
  }

  await ensureTourDay(prisma, wildTour.id, 1, "Park entry & lodge", [
    { entityId: yalaLodge.id, kind: "REQUIRED", priceLkr: 22000, sortOrder: 0 },
  ]);

  await prisma.review.createMany({
    data: [
      { agencyId: wildAgency.id, authorName: "Nadia P.", rating: 5, body: "Incredible wildlife sightings." },
      { agencyId: wildAgency.id, authorName: "Chris L.", rating: 4, body: "Great guides, bumpy roads expected." },
    ],
    skipDuplicates: true,
  });

  // —— More entities & second group ——
  let transport = await prisma.entity.findFirst({
    where: { agencyId: ctx.agency1.id, name: "Private KDH Transfer" },
  });
  if (!transport) {
    transport = await prisma.entity.create({
      data: {
        agencyId: ctx.agency1.id,
        name: "Private KDH Transfer",
        type: "OTHER",
        city: "Island-wide",
        description: "Airport transfers and inter-city drives",
        priceHint: 15000,
        durationMin: 180,
        metadata: { vehicleType: "Van", maxPax: 7 },
      },
    });
  }

  let coastGroup = await prisma.entityGroup.findFirst({
    where: { agencyId: ctx.agency1.id, name: "South Coast Essentials" },
  });
  if (!coastGroup) {
    coastGroup = await prisma.entityGroup.create({
      data: {
        agencyId: ctx.agency1.id,
        name: "South Coast Essentials",
        description: "Coastal stays and experiences",
        items: {
          create: [
            { entityId: ctx.activity.id, sortOrder: 0 },
            { entityId: ctx.restaurant.id, sortOrder: 1 },
          ],
        },
      },
    });
  }

  // —— Full multi-day tour plans ——
  await ensureTourDay(prisma, ctx.tour1.id, 2, "Polonnaruwa & Dambulla", [
    { entityId: ctx.hotel.id, kind: "REQUIRED", priceLkr: 18000, sortOrder: 0 },
    { entityId: transport.id, kind: "REQUIRED", priceLkr: 12000, label: "Day transfer", sortOrder: 1 },
  ]);
  await ensureTourDay(prisma, ctx.tour1.id, 3, "Departure", [
    { entityId: transport.id, kind: "REQUIRED", priceLkr: 15000, sortOrder: 0 },
  ]);
  await ensureTourDay(prisma, ctx.tour2.id, 2, "Galle Fort & beaches", [
    { entityId: ctx.restaurant.id, kind: "REQUIRED", priceLkr: 2800, sortOrder: 0 },
    { groupId: coastGroup.id, kind: "OPTIONAL", priceLkr: 12500, label: "Coast package", sortOrder: 1 },
  ]);
  await ensureTourDay(prisma, ctx.tour3.id, 1, "Train to Ella", [
    { entityId: ctx.ellaHotel.id, kind: "REQUIRED", priceLkr: 14500, sortOrder: 0 },
    { entityId: ctx.viewpoint.id, kind: "OPTIONAL", priceLkr: 3500, sortOrder: 1 },
  ]);
  await ensureTourDay(prisma, ctx.tour3.id, 2, "Tea country", [
    { groupId: ctx.hillGroup.id, kind: "REQUIRED", label: "Highland picks", sortOrder: 0 },
  ]);

  // —— Display packages linked to tours ——
  await prisma.displaySettings.update({
    where: { agencyId: ctx.agency1.id },
    data: {
      sections: {
        enabled: {
          tours: true,
          showcase: true,
          reviews: true,
          gallery: true,
          offers: true,
          inquiry: true,
        },
        content: {
          heroHeadline: "Find your perfect trip experience.",
          packagesTitle: "Ready-Made Packages",
          packagesSubtitle: "Curated routes with local guides, transport, and stays included.",
          ratingScore: "4.9",
          ratingSuffix: "/5",
          highlights: ["56+ guided tours", "Certified guides", "5+ years experience"],
          ctaLabel: "Plan your trip",
          featuredImageUrl: MEDIA.hero,
          featuredQuote: "We found peace, stars, and people who love what they do.",
          packages: [
            {
              title: ctx.tour1.slug,
              location: "Cultural Triangle",
              priceLabel: "From LKR 89,500",
              imageUrl: MEDIA.cultural,
              tourId: ctx.tour1.id,
            },
            {
              title: "South Coast Slow Travel",
              location: "Galle & Mirissa",
              priceLabel: "From LKR 142,000",
              imageUrl: MEDIA.coast,
              tourId: ctx.tour2.id,
            },
          ],
          offers: [
            {
              title: "Early bird special",
              description: "Book 30 days ahead and save.",
              priceLabel: "Save up to 15%",
              badge: "Limited",
            },
          ],
        },
      },
      theme: { accent: "#2e7d57" },
    },
  });

  // —— Standalone agency driver (no user account) ——
  const standaloneDriver = await prisma.agencyDriver.findFirst({
    where: { agencyId: ctx.agency1.id, name: "Ravi Guest Driver", userId: null },
  });
  if (!standaloneDriver) {
    await prisma.agencyDriver.create({
      data: {
        agencyId: ctx.agency1.id,
        name: "Ravi Guest Driver",
        phone: "+94771230999",
        licenseNo: "B999-0001",
        vehicle: "Car",
        status: "Available",
      },
    });
  }

  // —— More offers ——
  const freeOffer = await prisma.offer.findFirst({
    where: { agencyId: ctx.agency1.id, title: "Free Cultural Triangle Weekend" },
  });
  if (!freeOffer) {
    await prisma.offer.create({
      data: {
        agencyId: ctx.agency1.id,
        title: "Free Cultural Triangle Weekend",
        description: "Limited complimentary seats for registered travelers.",
        rewardText: "Free tour for registered travelers",
        registrationCap: 10,
        validFrom: daysAgo(2),
        validUntil: daysFromNow(14),
        tourPriceLkr: 89500,
        discountedLkr: 0,
        isActive: true,
        tours: { create: [{ tourId: ctx.tour1.id }] },
      },
    });
  }

  const expiredOffer = await prisma.offer.findFirst({
    where: { agencyId: ctx.agency1.id, title: "Monsoon Flash Sale (Ended)" },
  });
  if (!expiredOffer) {
    await prisma.offer.create({
      data: {
        agencyId: ctx.agency1.id,
        title: "Monsoon Flash Sale (Ended)",
        description: "Historical offer for demo — inactive.",
        rewardText: "LKR 3,000 off",
        registrationCap: 20,
        validFrom: daysAgo(60),
        validUntil: daysAgo(30),
        tourPriceLkr: 89500,
        discountedLkr: 86500,
        isActive: false,
        tours: { create: [{ tourId: ctx.tour1.id }] },
      },
    });
  }

  const tourist4 = await prisma.user.upsert({
    where: { phone: "+94774445500" },
    update: {},
    create: {
      phone: "+94774445500",
      name: "Alex Chen",
      role: "TOURIST",
      touristProfile: { create: { loyaltyPoints: 30 } },
    },
  });

  await prisma.offerRegistration.upsert({
    where: { offerId_userId: { offerId: ctx.agencyOffer.id, userId: tourist4.id } },
    update: {},
    create: { offerId: ctx.agencyOffer.id, userId: tourist4.id },
  });

  // —— Referrals ——
  await prisma.referralCode.upsert({
    where: { code: "RETIRED5" },
    update: {},
    create: {
      influencerId: ctx.influencer1.id,
      code: "RETIRED5",
      commissionPct: 5,
      isActive: false,
      clickCount: 3,
    },
  });

  await prisma.referralAttribution.createMany({
    data: [
      { referralCodeId: ctx.refLanka20.id, sessionId: "anon-session-2" },
      { referralCodeId: ctx.refIsland10.id, userId: ctx.tourist2.id, sessionId: "demo-session-2" },
    ],
    skipDuplicates: true,
  });

  // —— Inquiries across all major statuses ——
  async function ensureInquiry(
    key: { touristId: string; agencyId: string; tourId?: string | null; type: "READY_MADE" | "CUSTOM" },
    data: Parameters<typeof prisma.inquiry.create>[0]["data"]
  ) {
    const existing = await prisma.inquiry.findFirst({
      where: {
        touristId: key.touristId,
        agencyId: key.agencyId,
        tourId: key.tourId ?? null,
        type: key.type,
        status: data.status as never,
      },
    });
    if (existing) return existing;
    return prisma.inquiry.create({ data });
  }

  const inquiryDeclined = await ensureInquiry(
    { touristId: tourist4.id, agencyId: ctx.agency1.id, tourId: ctx.tour3.id, type: "READY_MADE" },
    {
      touristId: tourist4.id,
      agencyId: ctx.agency1.id,
      tourId: ctx.tour3.id,
      type: "READY_MADE",
      status: "DECLINED",
      pax: 2,
      message: "Dates no longer work for us.",
      statusHistory: {
        create: [
          { status: "NEW", actorId: tourist4.id },
          { status: "DECLINED", actorId: ctx.agencyUser1.id, note: "Fully booked for requested dates" },
        ],
      },
    }
  );

  const inquiryRevision = await ensureInquiry(
    { touristId: ctx.tourist2.id, agencyId: ctx.agency1.id, type: "CUSTOM" },
    {
      touristId: ctx.tourist2.id,
      agencyId: ctx.agency1.id,
      type: "CUSTOM",
      status: "REVISION_REQUESTED",
      pax: 4,
      budgetBand: "LKR 400,000 – 500,000",
      message: "Please add one more beach day and reduce driving.",
      statusHistory: {
        create: [
          { status: "NEW", actorId: ctx.tourist2.id },
          { status: "SENT_TO_TOURIST", actorId: ctx.agencyUser1.id },
          { status: "REVISION_REQUESTED", actorId: ctx.tourist2.id },
        ],
      },
    }
  );

  await prisma.inquiryMessage.createMany({
    data: [
      {
        inquiryId: inquiryRevision.id,
        authorId: ctx.tourist2.id,
        kind: "TOURIST",
        body: "Can we swap day 3 for a beach resort with a pool?",
      },
      {
        inquiryId: inquiryDeclined.id,
        authorId: ctx.agencyUser1.id,
        kind: "AGENCY",
        body: "Unfortunately we cannot accommodate those dates.",
      },
    ],
    skipDuplicates: true,
  });

  const inquiryViewed = await ensureInquiry(
    { touristId: ctx.tourist3.id, agencyId: ctx.agency1.id, tourId: ctx.tour1.id, type: "READY_MADE" },
    {
      touristId: ctx.tourist3.id,
      agencyId: ctx.agency1.id,
      tourId: ctx.tour1.id,
      type: "READY_MADE",
      status: "TOURIST_VIEWED",
      pax: 2,
      message: "Reviewing your proposal.",
      statusHistory: {
        create: [
          { status: "NEW", actorId: ctx.tourist3.id },
          { status: "SENT_TO_TOURIST", actorId: ctx.agencyUser1.id },
          { status: "TOURIST_VIEWED", actorId: ctx.tourist3.id },
        ],
      },
    }
  );

  let itinSouth = await prisma.itinerary.findFirst({
    where: { inquiryId: inquiryViewed.id },
  });
  if (!itinSouth) {
    itinSouth = await prisma.itinerary.create({
      data: {
        inquiryId: inquiryViewed.id,
        title: "Cultural Triangle — revised quote",
        baseTotal: 36000,
        optionalTotal: 3500,
        grandMax: 39500,
        isSent: true,
        sentAt: daysAgo(2),
        shareToken: "demo-south-coast-quote",
        days: {
          create: [
            { dayNumber: 1, title: "Sigiriya" },
            { dayNumber: 2, title: "Polonnaruwa" },
          ],
        },
        lineItems: {
          create: [
            {
              label: "Sigiriya Village Hotel",
              kind: "REQUIRED",
              priceLkr: 18000,
              sortOrder: 0,
              entityId: ctx.hotel.id,
            },
            {
              label: "Sunrise hike",
              kind: "OPTIONAL",
              priceLkr: 3500,
              sortOrder: 1,
              entityId: ctx.viewpoint.id,
            },
          ],
        },
      },
    });
  }

  await prisma.inquiryResponse.createMany({
    data: [
      {
        inquiryId: inquiryViewed.id,
        authorId: ctx.agencyUser1.id,
        message: "Here is our ready-made cultural triangle package for your dates.",
        kind: "READY_MADE",
        tourId: ctx.tour1.id,
      },
      {
        inquiryId: inquiryRevision.id,
        authorId: ctx.agencyUser1.id,
        message: "We can adjust pacing — see updated day plan.",
        kind: "MESSAGE",
      },
    ],
    skipDuplicates: true,
  });

  // —— Commissions (PENDING / APPROVED / PAID) ——
  const inquiryAccepted = await prisma.inquiry.findFirst({
    where: { touristId: ctx.tourist3.id, agencyId: ctx.agency1.id, status: "ACCEPTED" },
  });

  if (!(await prisma.commission.findFirst({ where: { inquiryId: ctx.inquirySent.id } }))) {
    await prisma.commission.create({
      data: {
        referralCodeId: ctx.refIsland10.id,
        influencerId: ctx.influencer1.id,
        inquiryId: ctx.inquirySent.id,
        amountLkr: 7160,
        status: "PENDING",
      },
    });
  }

  if (inquiryAccepted && !(await prisma.commission.findFirst({ where: { inquiryId: inquiryAccepted.id } }))) {
    await prisma.commission.create({
      data: {
        referralCodeId: ctx.refLanka20.id,
        influencerId: ctx.influencer2.id,
        inquiryId: inquiryAccepted.id,
        amountLkr: 11360,
        status: "APPROVED",
      },
    });
  }

  let paidInquiry = await prisma.inquiry.findFirst({
    where: {
      touristId: ctx.tourist1.id,
      agencyId: ctx.agency1.id,
      tourId: ctx.tour2.id,
      status: "ACCEPTED",
    },
  });
  if (!paidInquiry) {
    paidInquiry = await prisma.inquiry.create({
      data: {
        touristId: ctx.tourist1.id,
        agencyId: ctx.agency1.id,
        tourId: ctx.tour2.id,
        type: "READY_MADE",
        status: "ACCEPTED",
        pax: 2,
        referralCodeId: ctx.refIsland10.id,
        message: "Booked via ISLAND10 — paid commission demo.",
        statusHistory: { create: { status: "ACCEPTED", actorId: ctx.tourist1.id } },
      },
    });
  }
  if (!(await prisma.commission.findFirst({ where: { inquiryId: paidInquiry.id } }))) {
    await prisma.commission.create({
      data: {
        referralCodeId: ctx.refIsland10.id,
        influencerId: ctx.influencer1.id,
        inquiryId: paidInquiry.id,
        amountLkr: 5000,
        status: "PAID",
      },
    });
  }

  // —— More driver assignments ——
  for (const row of [
    {
      tourId: ctx.tour1.id,
      title: "Cultural triangle loop",
      startDate: daysFromNow(20),
      endDate: daysFromNow(23),
      status: "Scheduled",
    },
    {
      tourId: ctx.tour3.id,
      title: "Ella transfer day",
      startDate: daysFromNow(10),
      endDate: undefined as Date | undefined,
      status: "Completed",
    },
  ]) {
    const exists = await prisma.driverAssignment.findFirst({
      where: { agencyDriverId: ctx.agencyDriver1.id, title: row.title },
    });
    if (!exists) {
      await prisma.driverAssignment.create({
        data: {
          agencyDriverId: ctx.agencyDriver1.id,
          tourId: row.tourId,
          title: row.title,
          startDate: row.startDate,
          endDate: row.endDate,
          status: row.status,
        },
      });
    }
  }

  await ensureInquiry(
    { touristId: ctx.tourist1.id, agencyId: ctx.agency1.id, type: "CUSTOM" },
    {
      touristId: ctx.tourist1.id,
      agencyId: ctx.agency1.id,
      type: "CUSTOM",
      status: "ITINERARY_DRAFT",
      pax: 2,
      message: "Draft itinerary being built by agency.",
      statusHistory: { create: { status: "ITINERARY_DRAFT", actorId: ctx.agencyUser1.id } },
    }
  );

  await ensureInquiry(
    { touristId: tourist4.id, agencyId: ctx.agency1.id, tourId: ctx.tour2.id, type: "READY_MADE" },
    {
      touristId: tourist4.id,
      agencyId: ctx.agency1.id,
      tourId: ctx.tour2.id,
      type: "READY_MADE",
      status: "EXPIRED",
      pax: 2,
      message: "Inquiry expired after no response.",
      statusHistory: {
        create: [
          { status: "NEW", actorId: tourist4.id },
          { status: "EXPIRED", note: "Auto-expired demo" },
        ],
      },
    }
  );

  if (!(await prisma.inquiryProposal.findUnique({ where: { inquiryId: inquiryRevision.id } }))) {
    await prisma.inquiryProposal.create({
      data: {
        inquiryId: inquiryRevision.id,
        message: "Family custom route — draft options.",
        items: { create: [{ kind: "READY_MADE", tourId: ctx.tour2.id, sortOrder: 0 }] },
      },
    });
  }

  // —— Saved tours ——
  await prisma.savedTour.upsert({
    where: { userId_tourId: { userId: tourist4.id, tourId: wildTour.id } },
    update: {},
    create: { userId: tourist4.id, tourId: wildTour.id },
  });
  await prisma.savedTour.upsert({
    where: { userId_tourId: { userId: ctx.tourist3.id, tourId: ctx.tour1.id } },
    update: {},
    create: { userId: ctx.tourist3.id, tourId: ctx.tour1.id },
  });

  // —— Wallet ledger (all roles) ——
  const ledger = [
    { userId: ctx.tourist1.id, type: "ADJUSTMENT" as const, amountLkr: 50, balanceAfter: 50, note: "Loyalty credit" },
    { userId: ctx.tourist2.id, type: "TOPUP" as const, amountLkr: 100, balanceAfter: 100, note: "Promo credit" },
    { userId: ctx.agencyUser2.id, type: "LOGIN_FEE" as const, amountLkr: -50, balanceAfter: 200, note: "Login fee" },
    { userId: ctx.influencerUser2.id, type: "COMMISSION" as const, amountLkr: 85, balanceAfter: 85, note: "Payout demo" },
    { userId: wildOwner.id, type: "TOPUP" as const, amountLkr: 800, balanceAfter: 800, note: "Agency wallet" },
  ];
  for (const row of ledger) {
    const exists = await prisma.walletLedger.findFirst({
      where: { userId: row.userId, note: row.note },
    });
    if (!exists) await prisma.walletLedger.create({ data: row });
  }

  // —— CMS ——
  await prisma.cmsPage.upsert({
    where: { slug: "faq" },
    update: {},
    create: {
      slug: "faq",
      title: "FAQ",
      blocks: [{ type: "faq", items: [{ q: "How do offers work?", a: "Register while slots last." }] }],
    },
  });

  await prisma.cmsPage.upsert({
    where: { slug: "contact" },
    update: {},
    create: {
      slug: "contact",
      title: "Contact",
      blocks: [{ type: "contact", email: "hello@tourpilot.demo" }],
    },
  });

  // —— OTP challenges (dev login flow demos) ——
  const otpHash = await bcrypt.hash("000000", 8);
  const challenges = [
    { phone: ctx.phones.tourist1, purpose: "login", expiresAt: daysFromNow(1) },
    { phone: ctx.phones.agency1, purpose: "login", expiresAt: daysAgo(1) },
    { phone: ctx.phones.tourist2, purpose: "register", expiresAt: daysFromNow(1), payload: { name: "Demo", role: "TOURIST" } },
  ];
  for (const c of challenges) {
    const exists = await prisma.otpChallenge.findFirst({
      where: { phone: c.phone, purpose: c.purpose, expiresAt: c.expiresAt },
    });
    if (!exists) {
      await prisma.otpChallenge.create({
        data: {
          phone: c.phone,
          otpHash,
          purpose: c.purpose,
          payload: asJson(c.payload ?? {}),
          expiresAt: c.expiresAt,
        },
      });
    }
  }

  // —— Refresh tokens (schema completeness; tokenHash is globally unique) ——
  for (const userId of [ctx.tourist1.id, ctx.agencyUser1.id, ctx.influencerUser1.id]) {
    const exists = await prisma.refreshToken.findFirst({ where: { userId } });
    if (!exists) {
      const tokenHash = await bcrypt.hash(`demo-refresh-${userId}`, 10);
      await prisma.refreshToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt: daysFromNow(30),
        },
      });
    }
  }

  // —— Hidden review ——
  await prisma.review.createMany({
    data: [
      {
        agencyId: ctx.agency1.id,
        authorName: "Internal QA",
        rating: 3,
        body: "Hidden moderation example",
        isVisible: false,
      },
    ],
    skipDuplicates: true,
  });

  return { wildAgency, rejectedAgency, itinSouth };
}

export async function printTableCounts(prisma: PrismaClient) {
  const models: Array<[keyof PrismaClient, string]> = [
    ["user", "User"],
    ["agency", "Agency"],
    ["agencyStaff", "AgencyStaff"],
    ["agencyDriver", "AgencyDriver"],
    ["driverAssignment", "DriverAssignment"],
    ["touristProfile", "TouristProfile"],
    ["influencerProfile", "InfluencerProfile"],
    ["driverProfile", "DriverProfile"],
    ["entity", "Entity"],
    ["entityGroup", "EntityGroup"],
    ["entityGroupItem", "EntityGroupItem"],
    ["tour", "Tour"],
    ["tourDay", "TourDay"],
    ["tourDayItem", "TourDayItem"],
    ["inquiry", "Inquiry"],
    ["inquiryMessage", "InquiryMessage"],
    ["inquiryProposal", "InquiryProposal"],
    ["inquiryProposalItem", "InquiryProposalItem"],
    ["inquiryStatusLog", "InquiryStatusLog"],
    ["inquiryResponse", "InquiryResponse"],
    ["itinerary", "Itinerary"],
    ["itineraryDay", "ItineraryDay"],
    ["itineraryLineItem", "ItineraryLineItem"],
    ["review", "Review"],
    ["offer", "Offer"],
    ["offerTour", "OfferTour"],
    ["offerRegistration", "OfferRegistration"],
    ["referralCode", "ReferralCode"],
    ["referralAttribution", "ReferralAttribution"],
    ["commission", "Commission"],
    ["cmsPage", "CmsPage"],
    ["displaySettings", "DisplaySettings"],
    ["savedTour", "SavedTour"],
    ["walletLedger", "WalletLedger"],
    ["otpChallenge", "OtpChallenge"],
    ["refreshToken", "RefreshToken"],
  ];

  console.log("\nTable row counts:");
  for (const [delegate, label] of models) {
    const model = prisma[delegate] as { count: () => Promise<number> };
    const count = await model.count();
    const pad = label.padEnd(22);
    const mark = count > 0 ? "✓" : "○";
    console.log(`  ${mark} ${pad} ${count}`);
  }
}
