import { PrismaClient } from "@prisma/client";
import {
  CEYLON_TRAILS_HERO_IMAGES,
  LANKA_TOUR_TRAILS_LOGO,
  LANKA_TOUR_TRAILS_SOCIAL_LINKS,
  MEDIA,
  toStoredPhone,
} from "@tourpilot/shared";
import { hashPassword } from "../src/services/password.js";

const prisma = new PrismaClient();

async function migrateLegacyPhones() {
  const users = await prisma.$queryRaw<{ id: string; phone: string }[]>`
    SELECT id, phone FROM User WHERE phone NOT LIKE '+%'
  `;
  for (const user of users) {
    const next = toStoredPhone(user.phone);
    if (next === user.phone) continue;
    try {
      await prisma.$executeRaw`UPDATE User SET phone = ${next} WHERE id = ${user.id}`;
    } catch (err) {
      const code = (err as { code?: string; meta?: { code?: string } }).meta?.code;
      if (code !== "1062") throw err;
    }
  }
}

async function main() {
  await migrateLegacyPhones();

  const adminPhone = "+94779998888";
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || "admin123";
  const adminPasswordHash = await hashPassword(adminPassword);
  const agencyPhone = "+94771234567";
  const touristPhone = "+94771112233";
  const influencerPhone = "+94774445566";
  const driverPhone = "+94776655443";

  const admin = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: { passwordHash: adminPasswordHash },
    create: {
      phone: adminPhone,
      name: "TourPilot Admin",
      role: "ADMIN",
      walletBalance: 0,
      passwordHash: adminPasswordHash,
    },
  });

  const agencyUser = await prisma.user.upsert({
    where: { phone: agencyPhone },
    update: {},
    create: {
      phone: agencyPhone,
      name: "Lanka Tour Trails Agency",
      role: "AGENCY",
      walletBalance: 500,
    },
  });

  const demoGallery = [
    { url: MEDIA.tourCover, label: "Reef & coast" },
    { url: MEDIA.cultural, label: "Island trails" },
    { url: MEDIA.coast, label: "South coast" },
    { url: MEDIA.nature, label: "Wild Sri Lanka" },
  ];

  const demoAgencyKyc = {
    legalBusinessName: "Lanka Tour Trails (Pvt) Ltd",
    businessType: "PRIVATE_LIMITED",
    registrationNumber: "PV 123456",
    registeredAddress: "42 Galle Road, Colombo 03, Sri Lanka",
    district: "Colombo",
    businessEmail: "hello@ceylon-trails.demo",
    tourismLicenseNo: "SLTDA-DEMO-001",
    ownerIdType: "NIC",
    ownerIdNumber: "199012345678",
    bankAccountName: "Lanka Tour Trails (Pvt) Ltd",
    bankName: "Demo Bank",
    bankAccountNumber: "1234567890",
    declarationsAccepted: true,
    submittedAt: new Date().toISOString(),
  };

  const agency = await prisma.agency.upsert({
    where: { ownerId: agencyUser.id },
    update: {
      gallery: demoGallery,
      kyc: demoAgencyKyc,
      kycSubmittedAt: new Date(),
      name: "LANKA TOUR TRAILS",
      tagline: "Simply unique",
      logoUrl: LANKA_TOUR_TRAILS_LOGO,
    },
    create: {
      ownerId: agencyUser.id,
      name: "LANKA TOUR TRAILS",
      slug: "ceylon-trails",
      tagline: "Simply unique",
      description: "Boutique tours across cultural triangle, hill country, and south coast.",
      district: "Colombo",
      influencerCommissionPct: 8,
      status: "APPROVED",
      kyc: demoAgencyKyc,
      kycSubmittedAt: new Date(),
      logoUrl: LANKA_TOUR_TRAILS_LOGO,
      avgRating: 4.8,
      reviewCount: 124,
      contactPhone: agencyPhone,
      gallery: demoGallery,
      pageConfig: {
        sections: [
          { type: "hero", title: "LANKA TOUR TRAILS", subtitle: "Simply unique — handcrafted island itineraries" },
          { type: "gallery" },
          { type: "tours", title: "Ready-made tours" },
          { type: "reviews" },
          { type: "cta", button: "Send inquiry" },
        ],
      },
    },
  });

  const ceylonHeroContent = {
    heroHeadline: "Find your perfect trip experience.",
    heroSubheadline:
      "Handcrafted journeys across Sigiriya, hill country, and the south coast — with local experts you can trust.",
    heroImages: CEYLON_TRAILS_HERO_IMAGES.map((slide) => ({ ...slide })),
    whoWeAreTitle: "WHO WE ARE",
    whoWeAreDescription:
      "Lanka Tour Trails is a boutique Sri Lanka tour operator based in Colombo. We design small-group and private itineraries with certified local guides, transparent pricing, and routes we know by heart — from ancient kingdoms to tea country and the south coast.",
    whoWeAreSocialLinks: LANKA_TOUR_TRAILS_SOCIAL_LINKS.map((link) => ({ ...link })),
    whoWeAreImages: [],
    packagesTitle: "Ready-Made Packages",
    packagesSubtitle: "Curated routes with local guides, transport, and stays included.",
    ratingScore: "4.9",
    ratingSuffix: "/5",
    highlights: [
      "56+ guided tours delivered",
      "100% safe routes with certified local guides",
      "5+ years of island travel experience",
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
  };

  await prisma.displaySettings.upsert({
    where: { agencyId: agency.id },
    update: {
      sections: {
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
        content: ceylonHeroContent,
      },
    },
    create: {
      agencyId: agency.id,
      sections: {
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
        content: ceylonHeroContent,
      },
      theme: {},
    },
  });

  const tourist = await prisma.user.upsert({
    where: { phone: touristPhone },
    update: {},
    create: {
      phone: touristPhone,
      name: "Emma Tourist",
      role: "TOURIST",
      walletBalance: 0,
      touristProfile: { create: { interests: ["wildlife", "tea", "beach"], loyaltyPoints: 120 } },
    },
  });

  const driverUser = await prisma.user.upsert({
    where: { phone: driverPhone },
    update: { role: "DRIVER" },
    create: {
      phone: driverPhone,
      name: "Nimal Perera",
      role: "DRIVER",
      walletBalance: 9600,
    },
  });

  await prisma.driverProfile.upsert({
    where: { userId: driverUser.id },
    update: {
      licenseNo: "B321-9845",
      vehicle: "Toyota KDH",
      status: "Available",
      blockedDates: ["2026-05-05", "2026-05-08", "2026-05-12"],
      metadata: {
        experience: "5 Years",
        languages: "English, Sinhala",
        availabilityNotes: "Prefers hill-country routes",
      },
    },
    create: {
      userId: driverUser.id,
      licenseNo: "B321-9845",
      vehicle: "Toyota KDH",
      status: "Available",
      blockedDates: ["2026-05-05", "2026-05-08", "2026-05-12"],
      metadata: {
        experience: "5 Years",
        languages: "English, Sinhala",
        availabilityNotes: "Prefers hill-country routes",
      },
    },
  });

  await prisma.agencyDriver.upsert({
    where: { userId: driverUser.id },
    update: { agencyId: agency.id },
    create: {
      agencyId: agency.id,
      userId: driverUser.id,
      name: "Nimal Perera",
      phone: driverPhone,
      licenseNo: "B321-9845",
      vehicle: "Toyota KDH",
      status: "Available",
    },
  });

  const influencerUser = await prisma.user.upsert({
    where: { phone: influencerPhone },
    update: {},
    create: {
      phone: influencerPhone,
      name: "Island Vibes Influencer",
      role: "INFLUENCER",
      walletBalance: 200,
      influencerProfile: {
        create: { bio: "Sri Lanka travel content creator", socialLinks: { instagram: "@islandvibes" } },
      },
    },
  });

  let influencerProfile = await prisma.influencerProfile.findUniqueOrThrow({
    where: { userId: influencerUser.id },
  });

  const tour1 = await prisma.tour.upsert({
    where: { agencyId_slug: { agencyId: agency.id, slug: "cultural-triangle-escape" } },
    update: { coverUrl: MEDIA.cultural },
    create: {
      agencyId: agency.id,
      title: "Cultural Triangle Escape",
      slug: "cultural-triangle-escape",
      summary: "Sigiriya, Dambulla & Polonnaruwa in 3 days",
      days: 3,
      basePriceLkr: 89500,
      seasonTag: "Year-round",
      districtTags: ["Cultural Triangle"],
      coverUrl: MEDIA.cultural,
      isPublished: true,
    },
  });

  const tour2 = await prisma.tour.upsert({
    where: { agencyId_slug: { agencyId: agency.id, slug: "south-coast-slow" } },
    update: { coverUrl: MEDIA.coast },
    create: {
      agencyId: agency.id,
      title: "South Coast Slow Travel",
      slug: "south-coast-slow",
      summary: "Galle, Mirissa & whale watching",
      days: 5,
      basePriceLkr: 142000,
      seasonTag: "Nov–Apr best",
      districtTags: ["Galle", "Mirissa"],
      coverUrl: MEDIA.coast,
      isPublished: true,
    },
  });

  influencerProfile = await prisma.influencerProfile.update({
    where: { id: influencerProfile.id },
    data: {
      slug: "island-vibes",
      display: {
        headline: "Island Vibes — Sri Lanka picks",
        tagline: "My favourite ready-made tours with local agencies.",
        tourIds: [tour1.id, tour2.id],
      },
    },
  });

  let hotel = await prisma.entity.findFirst({
    where: { agencyId: agency.id, name: "Sigiriya Village Hotel" },
  });
  if (!hotel) {
    hotel = await prisma.entity.create({
      data: {
        agencyId: agency.id,
        name: "Sigiriya Village Hotel",
        type: "HOTEL",
        city: "Sigiriya",
        district: "Matale",
        priceHint: 18000,
        durationMin: 720,
      },
    });
  }

  let viewpoint = await prisma.entity.findFirst({
    where: { agencyId: agency.id, name: "Pidurangala Sunrise Hike" },
  });
  if (!viewpoint) {
    viewpoint = await prisma.entity.create({
      data: {
        agencyId: agency.id,
        name: "Pidurangala Sunrise Hike",
        type: "VIEWPOINT",
        city: "Sigiriya",
        district: "Matale",
        priceHint: 3500,
        durationMin: 180,
      },
    });
  }

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
          { entityId: viewpoint.id, kind: "OPTIONAL", priceLkr: 3500, sortOrder: 1, label: "Sunrise hike add-on" },
        ],
      },
    },
  });

  let demoInquiry = await prisma.inquiry.findFirst({
    where: { touristId: tourist.id, agencyId: agency.id, tourId: tour1.id },
  });
  if (!demoInquiry) {
    demoInquiry = await prisma.inquiry.create({
      data: {
        touristId: tourist.id,
        agencyId: agency.id,
        tourId: tour1.id,
        type: "READY_MADE",
        status: "SENT_TO_TOURIST",
        pax: 2,
        message: "We would love the cultural triangle with a sunrise hike add-on.",
        statusHistory: { create: { status: "NEW", actorId: tourist.id } },
      },
    });
  }

  const demoShareToken = "demo-cultural-triangle";
  const existingItin = await prisma.itinerary.findFirst({
    where: { inquiryId: demoInquiry.id },
  });
  if (!existingItin) {
    const demoItinerary = await prisma.itinerary.create({
      data: {
        inquiryId: demoInquiry.id,
        title: "Cultural Triangle — your dream route",
        notes:
          "Picture slow mornings, ancient rock fortresses, and golden light over the plains.",
        baseTotal: 18000,
        optionalTotal: 3500,
        grandMax: 21500,
        isSent: true,
        shareToken: demoShareToken,
      },
    });
    const demoDay = await prisma.itineraryDay.create({
      data: {
        itineraryId: demoItinerary.id,
        dayNumber: 1,
        title: "Rock fortress & village stay",
      },
    });
    await prisma.itineraryLineItem.createMany({
      data: [
        {
          itineraryId: demoItinerary.id,
          dayId: demoDay.id,
          label: "Sigiriya Village Hotel",
          kind: "REQUIRED",
          priceLkr: 18000,
          sortOrder: 0,
          entityId: hotel.id,
        },
        {
          itineraryId: demoItinerary.id,
          dayId: demoDay.id,
          label: "Pidurangala sunrise hike",
          kind: "OPTIONAL",
          priceLkr: 3500,
          sortOrder: 1,
          entityId: viewpoint.id,
        },
      ],
    });
  }

  await prisma.review.createMany({
    data: [
      { agencyId: agency.id, authorName: "Sarah M.", rating: 5, body: "Flawless itinerary and great guides." },
      { agencyId: agency.id, authorName: "James K.", rating: 5, body: "Loved the optional tea plantation visit." },
    ],
    skipDuplicates: true,
  });

  await prisma.referralCode.upsert({
    where: { code: "ISLAND10" },
    update: {},
    create: {
      influencerId: influencerProfile.id,
      tourId: tour1.id,
      code: "ISLAND10",
      commissionPct: 8,
    },
  });

  const offer = await prisma.offer.create({
    data: {
      agencyId: agency.id,
      title: "Early Bird Cultural Triangle",
      description: "Register before slots fill — price shown for transparency.",
      imageUrl: MEDIA.cultural,
      rewardText: "LKR 5,000 off your booking",
      registrationCap: 100,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      tourPriceLkr: 89500,
      discountedLkr: 84500,
      tours: { create: [{ tourId: tour1.id }] },
    },
  });

  await prisma.cmsPage.upsert({
    where: { slug: "home" },
    update: {},
    create: {
      slug: "home",
      title: "TourPilot Home",
      blocks: [
        {
          type: "hero",
          headline: "Navigate Sri Lanka with confidence",
          lead: "Discover curated tours, compare agencies, and receive transparent itineraries.",
          tags: ["Sri Lanka", "Verified agencies", "Custom itineraries"],
          badge: "Inspired exploration",
        },
        {
          type: "featured_agencies",
          title: "Start with trusted operators",
          subtitle: "Highly rated teams ready to craft your Sri Lanka journey.",
        },
        { type: "offers" },
      ],
    },
  });

  await prisma.cmsPage.upsert({
    where: { slug: "terms" },
    update: {},
    create: {
      slug: "terms",
      title: "Terms & Conditions",
      blocks: [
        {
          type: "section",
          heading: "1. Using TourPilot",
          body: "TourPilot connects travelers with licensed tour operators, influencers, and service providers in Sri Lanka. By creating an account you agree to use the platform lawfully and provide accurate information.",
        },
        {
          type: "section",
          heading: "2. Accounts & verification",
          body: "You are responsible for activity on your account. Phone verification via OTP is required. Professional accounts may be subject to additional review before going live.",
        },
        {
          type: "section",
          heading: "3. Wallet & fees",
          body: "Some account types may incur platform login or service fees debited from your in-app wallet. Top-ups and ledger entries are recorded in your profile.",
        },
        {
          type: "section",
          heading: "4. Contact",
          body: "Questions: support@srilankatourpilot.com",
        },
      ],
    },
  });

  console.log("Seed complete:", {
    admin: admin.phone,
    agency: agency.slug,
    tours: [tour1.slug, tour2.slug],
    tourist: tourist.phone,
    influencer: influencerUser.phone,
    driver: driverUser.phone,
    offer: offer.title,
    demoItinerary: `/itinerary/${demoShareToken}`,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
