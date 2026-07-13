/**
 * TourPilot demo dataset — populates (almost) every table with realistic sample rows.
 *
 * Usage (from repo root or apps/api):
 *   npm run db:seed:demo
 *
 * Safe to re-run: uses upserts / find-first guards where duplicates would fail.
 * Run `npm run db:seed` first if the database is empty (creates core login accounts).
 */
import { PrismaClient } from "@prisma/client";
import { LANKA_TOUR_TRAILS_LOGO, LANKA_TOUR_TRAILS_SOCIAL_LINKS, MEDIA, defaultAgencyKyc } from "@tourpilot/shared";
import { hashPassword } from "../src/services/password.js";
import { printTableCounts, seedExtendedData } from "./seed-demo-extended.js";

const prisma = new PrismaClient();

const PHONES = {
  admin: "+94779998888",
  agency1: "+94771234567",
  agency2: "+94779876543",
  tourist1: "+94771112233",
  tourist2: "+94772223344",
  tourist3: "+94773334455",
  influencer1: "+94774445566",
  influencer2: "+94775556677",
  driver1: "+94776655443",
  driver2: "+94777766554",
} as const;

function daysFromNow(n: number) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function ensureEntity(
  agencyId: string,
  name: string,
  data: Omit<Parameters<typeof prisma.entity.create>[0]["data"], "agencyId" | "name" | "agency">
) {
  const existing = await prisma.entity.findFirst({ where: { agencyId, name } });
  if (existing) return existing;
  return prisma.entity.create({ data: { agencyId, name, ...data } });
}

async function main() {
  console.log("TourPilot demo seed — starting…\n");

  const adminPasswordHash = await hashPassword(process.env.ADMIN_SEED_PASSWORD || "admin123");

  await prisma.user.upsert({
    where: { phone: PHONES.admin },
    update: { passwordHash: adminPasswordHash },
    create: {
      phone: PHONES.admin,
      name: "TourPilot Admin",
      role: "ADMIN",
      walletBalance: 0,
      passwordHash: adminPasswordHash,
    },
  });

  const agencyUser1 = await prisma.user.upsert({
    where: { phone: PHONES.agency1 },
    update: { walletBalance: 500 },
    create: {
      phone: PHONES.agency1,
      name: "Lanka Tour Trails Agency",
      role: "AGENCY",
      walletBalance: 500,
    },
  });

  const agencyUser2 = await prisma.user.upsert({
    where: { phone: PHONES.agency2 },
    update: {},
    create: {
      phone: PHONES.agency2,
      name: "IYYO Travels",
      role: "AGENCY",
      walletBalance: 250,
    },
  });

  const gallery = [
    { url: MEDIA.tourCover, label: "Reef & coast" },
    { url: MEDIA.cultural, label: "Island trails" },
    { url: MEDIA.coast, label: "South coast" },
    { url: MEDIA.nature, label: "Wild Sri Lanka" },
  ];

  const kycApproved = {
    ...defaultAgencyKyc({
      legalBusinessName: "Lanka Tour Trails (Pvt) Ltd",
      businessEmail: "hello@ceylon-trails.demo",
    }),
    district: "Colombo",
    registrationNumber: "PV 123456",
    registeredAddress: "42 Galle Road, Colombo 03",
    tourismLicenseNo: "SLTDA-DEMO-001",
    ownerIdNumber: "199012345678",
    bankAccountName: "Lanka Tour Trails (Pvt) Ltd",
    bankName: "Demo Bank",
    bankAccountNumber: "1234567890",
    declarationsAccepted: true,
    submittedAt: new Date().toISOString(),
  };

  const agency1 = await prisma.agency.upsert({
    where: { ownerId: agencyUser1.id },
    update: {
      gallery,
      kyc: kycApproved,
      coverUrl: MEDIA.hero,
      logoUrl: LANKA_TOUR_TRAILS_LOGO,
      name: "LANKA TOUR TRAILS",
      tagline: "Simply unique",
      status: "APPROVED",
      avgRating: 4.8,
      reviewCount: 124,
    },
    create: {
      ownerId: agencyUser1.id,
      name: "LANKA TOUR TRAILS",
      slug: "ceylon-trails",
      tagline: "Simply unique",
      description: "Boutique tours across cultural triangle, hill country, and south coast.",
      district: "Colombo",
      coverUrl: MEDIA.hero,
      logoUrl: LANKA_TOUR_TRAILS_LOGO,
      influencerCommissionPct: 8,
      status: "APPROVED",
      kyc: kycApproved,
      kycSubmittedAt: new Date(),
      avgRating: 4.8,
      reviewCount: 124,
      contactPhone: PHONES.agency1,
      contactEmail: "hello@ceylon-trails.demo",
      gallery,
    },
  });

  const kycPending = {
    ...defaultAgencyKyc({
      legalBusinessName: "IYYO Solutions Travel",
      businessEmail: "tourism@iyyosolutions.demo",
    }),
    district: "Colombo",
    declarationsAccepted: true,
    submittedAt: daysAgo(2).toISOString(),
  };

  const agency2Slug = (await prisma.agency.findUnique({ where: { slug: "iyyo-travels" } }))
    ? "iyyo-travels-demo"
    : "iyyo-travels";

  let agency2 = await prisma.agency.findUnique({ where: { ownerId: agencyUser2.id } });
  if (!agency2) {
    agency2 = await prisma.agency.create({
      data: {
        ownerId: agencyUser2.id,
        name: "IYYO Travels",
        slug: agency2Slug,
        tagline: "Curated Sri Lanka experiences",
        description: "Tech-forward agency building custom and ready-made island packages.",
        district: "Colombo",
        coverUrl: MEDIA.coast,
        influencerCommissionPct: 10,
        status: "PENDING",
        kyc: kycPending,
        kycSubmittedAt: daysAgo(2),
        avgRating: 0,
        reviewCount: 0,
        contactPhone: PHONES.agency2,
        gallery,
      },
    });
  } else {
    agency2 = await prisma.agency.update({
      where: { id: agency2.id },
      data: { gallery, kyc: kycPending, district: "Colombo", status: "PENDING" },
    });
  }

  const lankaTourTrailsDisplayContent = {
    enabled: {
      branding: true,
      whoWeAre: true,
      tours: true,
      showcase: true,
      reviews: true,
      gallery: true,
      offers: true,
      inquiry: true,
    },
    content: {
      heroHeadline: "Find your perfect trip experience.",
      whoWeAreTitle: "WHO WE ARE",
      whoWeAreDescription:
        "Lanka Tour Trails is a boutique Sri Lanka tour operator based in Colombo. We design small-group and private itineraries with certified local guides, transparent pricing, and routes we know by heart.",
      whoWeAreSocialLinks: LANKA_TOUR_TRAILS_SOCIAL_LINKS.map((link) => ({ ...link })),
      whoWeAreImages: [],
      packagesTitle: "Ready-Made Packages",
      packagesSubtitle: "Curated routes with local guides, transport, and stays included.",
      ratingScore: "4.9",
      ratingSuffix: "/5",
      highlights: [
        "Handcrafted itineraries for every traveler",
        "Certified local guides and safe routes",
        "Years of on-the-ground experience",
      ],
      ctaLabel: "Plan your trip",
      featuredImageUrl: MEDIA.hero,
      featuredQuote:
        "We expected sand and silence. We found peace, stars, and people who love what they do.",
      packages: [],
      offers: [
        {
          title: "Early bird special",
          description: "Book 30 days ahead and save on any ready-made tour.",
          priceLabel: "Save up to 15%",
          badge: "Limited",
        },
      ],
    },
  };

  const genericDisplayContent = {
    enabled: lankaTourTrailsDisplayContent.enabled,
    content: {
      ...lankaTourTrailsDisplayContent.content,
      whoWeAreDescription: "",
      whoWeAreSocialLinks: [],
    },
  };

  await prisma.displaySettings.upsert({
    where: { agencyId: agency1.id },
    update: { sections: lankaTourTrailsDisplayContent },
    create: { agencyId: agency1.id, sections: lankaTourTrailsDisplayContent, theme: {} },
  });

  await prisma.displaySettings.upsert({
    where: { agencyId: agency2.id },
    update: { sections: genericDisplayContent },
    create: { agencyId: agency2.id, sections: genericDisplayContent, theme: {} },
  });

  const tourist1 = await prisma.user.upsert({
    where: { phone: PHONES.tourist1 },
    update: {},
    create: {
      phone: PHONES.tourist1,
      name: "Emma Tourist",
      role: "TOURIST",
      touristProfile: {
        create: {
          interests: ["wildlife", "tea", "beach"],
          loyaltyPoints: 120,
          dietaryNotes: "Vegetarian-friendly meals preferred",
        },
      },
    },
  });

  const tourist2 = await prisma.user.upsert({
    where: { phone: PHONES.tourist2 },
    update: {},
    create: {
      phone: PHONES.tourist2,
      name: "James Walker",
      role: "TOURIST",
      touristProfile: {
        create: { interests: ["culture", "hiking"], loyaltyPoints: 45 },
      },
    },
  });

  const tourist3 = await prisma.user.upsert({
    where: { phone: PHONES.tourist3 },
    update: {},
    create: {
      phone: PHONES.tourist3,
      name: "Priya Sharma",
      role: "TOURIST",
      touristProfile: { create: { interests: ["family", "beach"], loyaltyPoints: 200 } },
    },
  });

  const driverUser1 = await prisma.user.upsert({
    where: { phone: PHONES.driver1 },
    update: { role: "DRIVER", walletBalance: 9600 },
    create: {
      phone: PHONES.driver1,
      name: "Nimal Perera",
      role: "DRIVER",
      walletBalance: 9600,
    },
  });

  const driverUser2 = await prisma.user.upsert({
    where: { phone: PHONES.driver2 },
    update: { role: "DRIVER" },
    create: {
      phone: PHONES.driver2,
      name: "Sunil Fernando",
      role: "DRIVER",
      walletBalance: 4200,
    },
  });

  await prisma.driverProfile.upsert({
    where: { userId: driverUser1.id },
    update: {
      licenseNo: "B321-9845",
      vehicle: "Toyota KDH",
      status: "Available",
      blockedDates: ["2026-05-05", "2026-05-08"],
    },
    create: {
      userId: driverUser1.id,
      licenseNo: "B321-9845",
      vehicle: "Toyota KDH",
      status: "Available",
      blockedDates: ["2026-05-05", "2026-05-08"],
      metadata: { experience: "5 Years", languages: "English, Sinhala" },
    },
  });

  await prisma.driverProfile.upsert({
    where: { userId: driverUser2.id },
    update: { licenseNo: "B445-1122", vehicle: "Micro Van", status: "On tour" },
    create: {
      userId: driverUser2.id,
      licenseNo: "B445-1122",
      vehicle: "Micro Van",
      status: "On tour",
      metadata: { experience: "3 Years", languages: "English, Tamil" },
    },
  });

  const agencyDriver1 = await prisma.agencyDriver.upsert({
    where: { userId: driverUser1.id },
    update: { agencyId: agency1.id },
    create: {
      agencyId: agency1.id,
      userId: driverUser1.id,
      name: "Nimal Perera",
      phone: PHONES.driver1,
      licenseNo: "B321-9845",
      vehicle: "Toyota KDH",
      status: "Available",
    },
  });

  const agencyDriver2 = await prisma.agencyDriver.upsert({
    where: { userId: driverUser2.id },
    update: { agencyId: agency1.id },
    create: {
      agencyId: agency1.id,
      userId: driverUser2.id,
      name: "Sunil Fernando",
      phone: PHONES.driver2,
      licenseNo: "B445-1122",
      vehicle: "Micro Van",
      status: "Scheduled",
    },
  });

  const influencerUser1 = await prisma.user.upsert({
    where: { phone: PHONES.influencer1 },
    update: {},
    create: {
      phone: PHONES.influencer1,
      name: "Island Vibes",
      role: "INFLUENCER",
      walletBalance: 200,
      influencerProfile: {
        create: { bio: "Sri Lanka travel creator", socialLinks: { instagram: "@islandvibes" } },
      },
    },
  });

  const influencerUser2 = await prisma.user.upsert({
    where: { phone: PHONES.influencer2 },
    update: {},
    create: {
      phone: PHONES.influencer2,
      name: "Lanka Lens",
      role: "INFLUENCER",
      walletBalance: 85,
      influencerProfile: {
        create: { bio: "Photo tours & hidden gems", socialLinks: { youtube: "@lankalens" } },
      },
    },
  });

  let influencer1 = await prisma.influencerProfile.findUniqueOrThrow({
    where: { userId: influencerUser1.id },
  });
  let influencer2 = await prisma.influencerProfile.findUniqueOrThrow({
    where: { userId: influencerUser2.id },
  });

  // —— Entities ——
  const hotel = await ensureEntity(agency1.id, "Sigiriya Village Hotel", {
    type: "HOTEL",
    city: "Sigiriya",
    district: "Matale",
    priceHint: 18000,
    durationMin: 720,
    contact: "+94771110001",
    description: "Eco-lodge at the foot of Sigiriya with pool and cultural shows.",
    media: {
      mainImageUrl: MEDIA.cultural,
      items: [{ kind: "image", url: MEDIA.nature, label: "Garden view" }],
    },
  });

  const viewpoint = await ensureEntity(agency1.id, "Pidurangala Sunrise Hike", {
    type: "VIEWPOINT",
    city: "Sigiriya",
    district: "Matale",
    priceHint: 3500,
    durationMin: 180,
    description: "Climb before dawn for panoramic views of Sigiriya Rock at sunrise.",
    media: { mainImageUrl: MEDIA.nature, items: [] },
  });

  const restaurant = await ensureEntity(agency1.id, "Curry Leaf Restaurant", {
    type: "RESTAURANT",
    city: "Kandy",
    district: "Kandy",
    priceHint: 2800,
    durationMin: 90,
    description: "Traditional rice and curry with lake-view terrace seating.",
    media: { mainImageUrl: MEDIA.cultural, items: [] },
    metadata: { avgPricePerPerson: 2800, openHoursDays: "Daily 11:00–22:00" },
  });

  const activity = await ensureEntity(agency1.id, "Whale Watching Mirissa", {
    type: "ACTIVITY",
    city: "Mirissa",
    district: "Matara",
    priceHint: 12500,
    durationMin: 240,
    description: "Morning boat trip with marine naturalist guide.",
    media: { mainImageUrl: MEDIA.nature, items: [] },
  });

  const ellaHotel = await ensureEntity(agency1.id, "Ella Mount View Lodge", {
    type: "HOTEL",
    city: "Ella",
    district: "Uva",
    priceHint: 14500,
    durationMin: 720,
  });

  let hillGroup = await prisma.entityGroup.findFirst({
    where: { agencyId: agency1.id, name: "Ella Premium Picks" },
  });
  if (!hillGroup) {
    hillGroup = await prisma.entityGroup.create({
      data: {
        agencyId: agency1.id,
        name: "Ella Premium Picks",
        description: "Best viewpoints and stays in the highlands",
        items: {
          create: [
            { entityId: ellaHotel.id, sortOrder: 0 },
            { entityId: viewpoint.id, sortOrder: 1 },
          ],
        },
      },
    });
  }

  // —— Tours ——
  const tour1 = await prisma.tour.upsert({
    where: { agencyId_slug: { agencyId: agency1.id, slug: "cultural-triangle-escape" } },
    update: { coverUrl: MEDIA.cultural, isPublished: true },
    create: {
      agencyId: agency1.id,
      title: "Cultural Triangle Escape",
      slug: "cultural-triangle-escape",
      summary: "Sigiriya, Dambulla & Polonnaruwa in 3 days",
      description: "Explore ancient capitals with a certified guide and flexible add-ons.",
      days: 3,
      basePriceLkr: 89500,
      influencerCommissionLkr: 7160,
      seasonTag: "Year-round",
      districtTags: ["Cultural Triangle", "Sigiriya"],
      coverUrl: MEDIA.cultural,
      isPublished: true,
    },
  });

  const tour2 = await prisma.tour.upsert({
    where: { agencyId_slug: { agencyId: agency1.id, slug: "south-coast-slow" } },
    update: { coverUrl: MEDIA.coast, isPublished: true },
    create: {
      agencyId: agency1.id,
      title: "South Coast Slow Travel",
      slug: "south-coast-slow",
      summary: "Galle, Mirissa & whale watching",
      description: "Relaxed coastal route with optional marine excursions.",
      days: 5,
      basePriceLkr: 142000,
      influencerCommissionLkr: 11360,
      seasonTag: "Nov–Apr best",
      districtTags: ["Galle", "Mirissa"],
      coverUrl: MEDIA.coast,
      isPublished: true,
    },
  });

  const tour3 = await prisma.tour.upsert({
    where: { agencyId_slug: { agencyId: agency1.id, slug: "ella-tea-trails" } },
    update: { isPublished: true },
    create: {
      agencyId: agency1.id,
      title: "Ella Tea Trails",
      slug: "ella-tea-trails",
      summary: "Train, hikes & plantation stays",
      days: 4,
      basePriceLkr: 118000,
      districtTags: ["Ella", "Nuwara Eliya"],
      coverUrl: MEDIA.nature,
      isPublished: true,
    },
  });

  const tourDraft = await prisma.tour.upsert({
    where: { agencyId_slug: { agencyId: agency2.id, slug: "colombo-city-break" } },
    update: {},
    create: {
      agencyId: agency2.id,
      title: "Colombo City Break",
      slug: "colombo-city-break",
      summary: "48 hours in the capital",
      days: 2,
      basePriceLkr: 45000,
      districtTags: ["Colombo"],
      coverUrl: MEDIA.agencyCover,
      isPublished: false,
    },
  });

  await prisma.tourDay.upsert({
    where: { tourId_dayNumber: { tourId: tour1.id, dayNumber: 1 } },
    update: {},
    create: {
      tourId: tour1.id,
      dayNumber: 1,
      title: "Arrival & rock fortress",
      items: {
        create: [
          { entityId: hotel.id, kind: "REQUIRED", priceLkr: 18000, sortOrder: 0 },
          { entityId: viewpoint.id, kind: "OPTIONAL", priceLkr: 3500, sortOrder: 1, label: "Sunrise hike" },
        ],
      },
    },
  });

  await prisma.tourDay.upsert({
    where: { tourId_dayNumber: { tourId: tour2.id, dayNumber: 1 } },
    update: {},
    create: {
      tourId: tour2.id,
      dayNumber: 1,
      title: "Coast arrival",
      items: {
        create: [
          { entityId: activity.id, kind: "OPTIONAL", priceLkr: 12500, sortOrder: 0, label: "Whale watching" },
          { entityId: restaurant.id, kind: "REQUIRED", priceLkr: 2800, sortOrder: 1 },
        ],
      },
    },
  });

  influencer1 = await prisma.influencerProfile.update({
    where: { id: influencer1.id },
    data: {
      slug: "island-vibes",
      display: {
        headline: "Island Vibes — Sri Lanka picks",
        tagline: "My favourite ready-made tours with local agencies.",
        tourIds: [tour1.id, tour2.id, tour3.id],
      },
    },
  });

  influencer2 = await prisma.influencerProfile.update({
    where: { id: influencer2.id },
    data: {
      slug: "lanka-lens",
      display: {
        headline: "Lanka Lens — photo routes",
        tagline: "Golden-hour itineraries I actually book for clients.",
        tourIds: [tour1.id, tour3.id],
      },
    },
  });

  // —— Reviews ——
  await prisma.review.createMany({
    data: [
      { agencyId: agency1.id, authorName: "Sarah M.", rating: 5, body: "Flawless itinerary and great guides." },
      { agencyId: agency1.id, authorName: "James K.", rating: 5, body: "Loved the optional tea plantation visit." },
      { agencyId: agency1.id, authorName: "Anika R.", rating: 4, body: "Whale watching was the highlight!" },
      { agencyId: agency1.id, authorName: "Tom H.", rating: 5, body: "Responsive agency, fair pricing." },
    ],
    skipDuplicates: true,
  });

  // —— Referrals ——
  const refIsland10 = await prisma.referralCode.upsert({
    where: { code: "ISLAND10" },
    update: {},
    create: {
      influencerId: influencer1.id,
      tourId: tour1.id,
      code: "ISLAND10",
      commissionPct: 8,
      clickCount: 42,
    },
  });

  const refLanka20 = await prisma.referralCode.upsert({
    where: { code: "LANKA20" },
    update: {},
    create: {
      influencerId: influencer2.id,
      tourId: tour2.id,
      code: "LANKA20",
      commissionPct: 10,
      clickCount: 18,
    },
  });

  if (!(await prisma.referralAttribution.findFirst({ where: { referralCodeId: refIsland10.id } }))) {
    await prisma.referralAttribution.create({
      data: { referralCodeId: refIsland10.id, userId: tourist1.id, sessionId: "demo-session-1" },
    });
  }

  // —— Offers ——
  let agencyOffer = await prisma.offer.findFirst({
    where: { agencyId: agency1.id, title: "Early Bird Cultural Triangle" },
  });
  if (!agencyOffer) {
    agencyOffer = await prisma.offer.create({
      data: {
        agencyId: agency1.id,
        title: "Early Bird Cultural Triangle",
        description: "Register before slots fill — limited seats each week.",
        imageUrl: MEDIA.cultural,
        rewardText: "Unlock group rewards as more travelers join",
        offerMonth: new Date().toISOString().slice(0, 7),
        rewardTiers: [
          { registrationsRequired: 50, winnersCount: 2, rewardLabel: "free dinners" },
          { registrationsRequired: 100, winnersCount: 1, rewardLabel: "a free tour" },
        ],
        registrationCap: 100,
        validFrom: daysAgo(1),
        validUntil: daysFromNow(14),
        tourPriceLkr: 89500,
        discountedLkr: 84500,
        tours: { create: [{ tourId: tour1.id }] },
      },
    });
  }

  let platformOffer = await prisma.offer.findFirst({
    where: { agencyId: null, title: "TourPilot Launch — Hill Country" },
  });
  if (!platformOffer) {
    platformOffer = await prisma.offer.create({
      data: {
        agencyId: null,
        title: "TourPilot Launch — Hill Country",
        description: "Platform-wide promo on featured Ella routes.",
        imageUrl: MEDIA.nature,
        rewardText: "Earn 150 loyalty points",
        registrationCap: 200,
        validFrom: daysAgo(2),
        validUntil: daysFromNow(21),
        tourPriceLkr: 118000,
        discountedLkr: 109000,
        tours: { create: [{ tourId: tour3.id }] },
      },
    });
  }

  for (const [userId, offerId] of [
    [tourist1.id, agencyOffer.id],
    [tourist2.id, platformOffer.id],
  ] as const) {
    await prisma.offerRegistration.upsert({
      where: { offerId_userId: { offerId, userId } },
      update: {},
      create: {
        offerId,
        userId,
        screenshotUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400",
        message: "",
      },
    });
  }

  // —— Inquiries & trip room ——
  let inquirySent = await prisma.inquiry.findFirst({
    where: { touristId: tourist1.id, agencyId: agency1.id, tourId: tour1.id, type: "READY_MADE" },
  });
  if (!inquirySent) {
    inquirySent = await prisma.inquiry.create({
      data: {
        touristId: tourist1.id,
        agencyId: agency1.id,
        tourId: tour1.id,
        type: "READY_MADE",
        status: "SENT_TO_TOURIST",
        pax: 2,
        startDate: daysFromNow(30),
        endDate: daysFromNow(33),
        message: "We would love the cultural triangle with a sunrise hike add-on.",
        referralCodeId: refIsland10.id,
        statusHistory: {
          create: [
            { status: "NEW", actorId: tourist1.id },
            { status: "AGENCY_REVIEWING", actorId: agencyUser1.id },
            { status: "SENT_TO_TOURIST", actorId: agencyUser1.id },
          ],
        },
      },
    });
  }

  if (!(await prisma.inquiryMessage.findFirst({ where: { inquiryId: inquirySent.id } }))) {
    await prisma.inquiryMessage.createMany({
      data: [
        {
          inquiryId: inquirySent.id,
          authorId: tourist1.id,
          kind: "TOURIST",
          body: "Hi! We're two adults interested in the cultural triangle tour.",
        },
        {
          inquiryId: inquirySent.id,
          authorId: agencyUser1.id,
          kind: "AGENCY",
          body: "Thanks Emma — I've prepared a draft itinerary with an optional sunrise hike.",
        },
      ],
    });
  }

  const shareToken = "demo-cultural-triangle";
  let itinerary = await prisma.itinerary.findFirst({ where: { inquiryId: inquirySent.id } });
  if (!itinerary) {
    itinerary = await prisma.itinerary.create({
      data: {
        inquiryId: inquirySent.id,
        title: "Cultural Triangle — your dream route",
        notes: "Slow mornings, ancient fortresses, golden light over the plains.",
        baseTotal: 18000,
        optionalTotal: 3500,
        grandMax: 21500,
        isSent: true,
        sentAt: daysAgo(1),
        shareToken,
      },
    });
    const day = await prisma.itineraryDay.create({
      data: { itineraryId: itinerary.id, dayNumber: 1, title: "Rock fortress & village stay" },
    });
    await prisma.itineraryLineItem.createMany({
      data: [
        {
          itineraryId: itinerary.id,
          dayId: day.id,
          entityId: hotel.id,
          label: "Sigiriya Village Hotel",
          kind: "REQUIRED",
          priceLkr: 18000,
          sortOrder: 0,
        },
        {
          itineraryId: itinerary.id,
          dayId: day.id,
          entityId: viewpoint.id,
          label: "Pidurangala sunrise hike",
          kind: "OPTIONAL",
          priceLkr: 3500,
          sortOrder: 1,
        },
      ],
    });
  }

  if (!(await prisma.inquiryResponse.findFirst({ where: { inquiryId: inquirySent.id } }))) {
    await prisma.inquiryResponse.create({
      data: {
        inquiryId: inquirySent.id,
        authorId: agencyUser1.id,
        message: "Please review your personalised itinerary — optional items can be toggled.",
        kind: "CUSTOM_ITINERARY",
        itineraryId: itinerary.id,
      },
    });
  }

  let proposal = await prisma.inquiryProposal.findUnique({ where: { inquiryId: inquirySent.id } });
  if (!proposal) {
    proposal = await prisma.inquiryProposal.create({
      data: {
        inquiryId: inquirySent.id,
        message: "We recommend this ready-made tour plus your custom day-one plan.",
        items: {
          create: [
            { kind: "READY_MADE", tourId: tour1.id, sortOrder: 0 },
            { kind: "CUSTOM", itineraryId: itinerary.id, sortOrder: 1 },
          ],
        },
      },
    });
  }

  let inquiryCustom = await prisma.inquiry.findFirst({
    where: { touristId: tourist2.id, agencyId: agency1.id, type: "CUSTOM" },
  });
  if (!inquiryCustom) {
    inquiryCustom = await prisma.inquiry.create({
      data: {
        touristId: tourist2.id,
        agencyId: agency1.id,
        type: "CUSTOM",
        status: "AGENCY_REVIEWING",
        pax: 4,
        budgetBand: "LKR 400,000 – 500,000",
        interests: ["beach", "wildlife"],
        message: "Family trip — need child-friendly pacing and one rest day.",
        statusHistory: { create: { status: "NEW", actorId: tourist2.id } },
      },
    });
  }

  let inquiryAccepted = await prisma.inquiry.findFirst({
    where: { touristId: tourist3.id, agencyId: agency1.id, tourId: tour2.id },
  });
  if (!inquiryAccepted) {
    inquiryAccepted = await prisma.inquiry.create({
      data: {
        touristId: tourist3.id,
        agencyId: agency1.id,
        tourId: tour2.id,
        type: "READY_MADE",
        status: "ACCEPTED",
        pax: 2,
        message: "South coast looks perfect — please confirm whale watching slot.",
        statusHistory: {
          create: [
            { status: "NEW", actorId: tourist3.id },
            { status: "ACCEPTED", actorId: tourist3.id },
          ],
        },
      },
    });
  }

  // —— Driver assignment ——
  if (!(await prisma.driverAssignment.findFirst({ where: { inquiryId: inquiryAccepted.id } }))) {
    await prisma.driverAssignment.create({
      data: {
        agencyDriverId: agencyDriver1.id,
        inquiryId: inquiryAccepted.id,
        tourId: tour2.id,
        title: "Mirissa pickup — south coast tour",
        startDate: daysFromNow(45),
        endDate: daysFromNow(50),
        notes: "Airport transfer + coastal legs",
        status: "Scheduled",
      },
    });
  }

  // —— Saved tours ——
  await prisma.savedTour.upsert({
    where: { userId_tourId: { userId: tourist1.id, tourId: tour2.id } },
    update: {},
    create: { userId: tourist1.id, tourId: tour2.id },
  });
  await prisma.savedTour.upsert({
    where: { userId_tourId: { userId: tourist2.id, tourId: tour3.id } },
    update: {},
    create: { userId: tourist2.id, tourId: tour3.id },
  });

  // —— Wallet ledger ——
  const ledgerRows = [
    { userId: agencyUser1.id, type: "TOPUP" as const, amountLkr: 500, balanceAfter: 500, note: "Welcome credit" },
    { userId: driverUser1.id, type: "TOPUP" as const, amountLkr: 10000, balanceAfter: 10000, note: "Initial top-up" },
    { userId: driverUser1.id, type: "LOGIN_FEE" as const, amountLkr: -400, balanceAfter: 9600, note: "Login fee" },
    { userId: influencerUser1.id, type: "COMMISSION" as const, amountLkr: 150, balanceAfter: 200, note: "Demo commission" },
  ];
  for (const row of ledgerRows) {
    const exists = await prisma.walletLedger.findFirst({
      where: { userId: row.userId, type: row.type, note: row.note },
    });
    if (!exists) {
      await prisma.walletLedger.create({ data: row });
    }
  }

  // —— CMS ——
  await prisma.cmsPage.upsert({
    where: { slug: "home" },
    update: {},
    create: {
      slug: "home",
      title: "TourPilot Home",
      blocks: [
        { type: "hero", headline: "Navigate Sri Lanka with confidence" },
        { type: "featured_agencies" },
        { type: "offers" },
      ],
    },
  });

  await prisma.cmsPage.upsert({
    where: { slug: "about" },
    update: {},
    create: {
      slug: "about",
      title: "About TourPilot",
      blocks: [{ type: "text", body: "Connecting tourists, agencies, influencers, and drivers." }],
    },
  });

  // —— Agency staff (optional demo) ——
  const staffPhone = "+94771230001";
  const staffUser = await prisma.user.upsert({
    where: { phone: staffPhone },
    update: {},
    create: {
      phone: staffPhone,
      name: "Kamal Operations",
      role: "AGENCY",
      walletBalance: 0,
    },
  });

  await prisma.agencyStaff.upsert({
    where: { agencyId_userId: { agencyId: agency1.id, userId: staffUser.id } },
    update: { title: "Operations lead" },
    create: { agencyId: agency1.id, userId: staffUser.id, title: "Operations lead" },
  });

  const extended = await seedExtendedData({
    prisma,
    phones: PHONES,
    agency1,
    agency2,
    agencyUser1,
    agencyUser2,
    tourist1,
    tourist2,
    tourist3,
    driverUser1,
    driverUser2,
    influencerUser1,
    influencerUser2,
    influencer1,
    influencer2,
    agencyDriver1,
    tour1,
    tour2,
    tour3,
    hillGroup,
    hotel,
    viewpoint,
    restaurant,
    activity,
    ellaHotel,
    refIsland10,
    refLanka20,
    agencyOffer,
    platformOffer,
    inquirySent,
  });

  await printTableCounts(prisma);

  console.log("\nDemo seed complete.\n");
  console.log("Login accounts (OTP / admin password):");
  console.log("  Admin:      ", PHONES.admin, "(password:", process.env.ADMIN_SEED_PASSWORD || "admin123", ")");
  console.log("  Agency 1:   ", PHONES.agency1, "→", agency1.slug);
  console.log("  Agency 2:   ", PHONES.agency2, "→", agency2.slug, "(PENDING approval)");
  console.log("  Wild Coast: +94773334400 →", extended.wildAgency.slug, "(approved)");
  console.log("  Rejected:   ", "+94778889900 →", extended.rejectedAgency.slug);
  console.log("  Tourists:   ", PHONES.tourist1, PHONES.tourist2, PHONES.tourist3);
  console.log("  Influencers:", PHONES.influencer1, "/i/island-vibes");
  console.log("              ", PHONES.influencer2, "/i/lanka-lens");
  console.log("  Drivers:    ", PHONES.driver1, PHONES.driver2);
  console.log("\nHighlights:");
  console.log("  Tours:", [tour1.slug, tour2.slug, tour3.slug].join(", "));
  console.log("  Share itineraries:", `/itinerary/${shareToken}`, ", /itinerary/demo-south-coast-quote");
  console.log("  Referral codes: ISLAND10, LANKA20");
  console.log("  Offers:", agencyOffer.title, "+", platformOffer.title);
  console.log("\nRe-run anytime: npm run db:seed:demo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
