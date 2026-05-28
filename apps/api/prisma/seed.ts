import { PrismaClient } from "@prisma/client";
import { toStoredPhone } from "@tourpilot/shared";
import { hashPassword } from "../src/services/password.js";

const prisma = new PrismaClient();

async function migrateLegacyPhones() {
  const users = await prisma.user.findMany({
    where: { NOT: { phone: { startsWith: "+" } } },
  });
  for (const user of users) {
    const next = toStoredPhone(user.phone);
    if (next !== user.phone) {
      await prisma.user.update({ where: { id: user.id }, data: { phone: next } });
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
      name: "Ceylon Trails Agency",
      role: "AGENCY",
      walletBalance: 500,
    },
  });

  const agency = await prisma.agency.upsert({
    where: { ownerId: agencyUser.id },
    update: {},
    create: {
      ownerId: agencyUser.id,
      name: "Ceylon Trails",
      slug: "ceylon-trails",
      tagline: "Authentic Sri Lanka journeys",
      description: "Boutique tours across cultural triangle, hill country, and south coast.",
      district: "Colombo",
      status: "APPROVED",
      avgRating: 4.8,
      reviewCount: 124,
      contactPhone: agencyPhone,
      gallery: [
        {
          url: "https://images.unsplash.com/photo-1682687982501-1e58ab814714?auto=format&fit=crop&w=1200&q=80",
          label: "Sand Morning",
        },
        {
          url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
          label: "Camp Night",
        },
        {
          url: "https://images.unsplash.com/photo-1464822759021-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
          label: "Nomad Route",
        },
        {
          url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a72fe8?auto=format&fit=crop&w=1200&q=80",
          label: "Warm Horizon",
        },
        {
          url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=80",
          label: "Red Canyon",
        },
        {
          url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80",
          label: "Wild Trail",
        },
      ],
      pageConfig: {
        sections: [
          { type: "hero", title: "Ceylon Trails", subtitle: "Handcrafted island itineraries" },
          { type: "gallery" },
          { type: "tours", title: "Ready-made tours" },
          { type: "reviews" },
          { type: "cta", button: "Send inquiry" },
        ],
      },
    },
  });

  await prisma.displaySettings.upsert({
    where: { agencyId: agency.id },
    update: {
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
          packagesSubtitle:
            "Curated routes with local guides, transport, and stays included.",
          ratingScore: "4.9",
          ratingSuffix: "/5",
          highlights: [
            "56+ guided tours delivered",
            "100% safe routes with certified local guides",
            "5+ years of island travel experience",
          ],
          ctaLabel: "Plan your trip",
          featuredImageUrl:
            "https://images.unsplash.com/photo-1526778548025-fa2f588cd1f1?auto=format&fit=crop&w=1200&q=80",
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
      },
    },
    create: {
      agencyId: agency.id,
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
          packagesSubtitle:
            "Curated routes with local guides, transport, and stays included.",
          ratingScore: "4.9",
          ratingSuffix: "/5",
          highlights: [
            "56+ guided tours delivered",
            "100% safe routes with certified local guides",
            "5+ years of island travel experience",
          ],
          ctaLabel: "Plan your trip",
          featuredImageUrl:
            "https://images.unsplash.com/photo-1526778548025-fa2f588cd1f1?auto=format&fit=crop&w=1200&q=80",
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
    update: {},
    create: {
      phone: driverPhone,
      name: "Nimal Perera",
      role: "DRIVER",
      walletBalance: 9600,
      driverProfile: {
        create: {
          licenseNo: "B321-9845",
          vehicle: "Toyota KDH",
          status: "available",
          bio: "5 years experience · English, Sinhala",
        },
      },
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

  const influencerProfile = await prisma.influencerProfile.findUniqueOrThrow({
    where: { userId: influencerUser.id },
  });

  const tour1 = await prisma.tour.upsert({
    where: { agencyId_slug: { agencyId: agency.id, slug: "cultural-triangle-escape" } },
    update: {},
    create: {
      agencyId: agency.id,
      title: "Cultural Triangle Escape",
      slug: "cultural-triangle-escape",
      summary: "Sigiriya, Dambulla & Polonnaruwa in 3 days",
      days: 3,
      basePriceLkr: 89500,
      seasonTag: "Year-round",
      districtTags: ["Cultural Triangle"],
      coverUrl:
        "https://images.unsplash.com/photo-1580619305218-8423a4bb63b2?auto=format&fit=crop&w=1200&q=80",
      isPublished: true,
    },
  });

  const tour2 = await prisma.tour.upsert({
    where: { agencyId_slug: { agencyId: agency.id, slug: "south-coast-slow" } },
    update: {},
    create: {
      agencyId: agency.id,
      title: "South Coast Slow Travel",
      slug: "south-coast-slow",
      summary: "Galle, Mirissa & whale watching",
      days: 5,
      basePriceLkr: 142000,
      seasonTag: "Nov–Apr best",
      districtTags: ["Galle", "Mirissa"],
      coverUrl:
        "https://images.unsplash.com/photo-1559128805-8c308fd483e6?auto=format&fit=crop&w=1200&q=80",
      isPublished: true,
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
    await prisma.itinerary.create({
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
        days: {
          create: [
            {
              dayNumber: 1,
              title: "Rock fortress & village stay",
              lineItems: {
                create: [
                  {
                    label: "Sigiriya Village Hotel",
                    kind: "REQUIRED",
                    priceLkr: 18000,
                    sortOrder: 0,
                    entityId: hotel.id,
                  },
                  {
                    label: "Pidurangala sunrise hike",
                    kind: "OPTIONAL",
                    priceLkr: 3500,
                    sortOrder: 1,
                    entityId: viewpoint.id,
                  },
                ],
              },
            },
          ],
        },
      },
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

  const driverPhone = "0772223344";
  const driverUser = await prisma.user.upsert({
    where: { phone: driverPhone },
    update: { role: "DRIVER" },
    create: {
      phone: driverPhone,
      name: "Nimal Perera",
      role: "DRIVER",
      walletBalance: 100,
    },
  });

  await prisma.driverProfile.upsert({
    where: { userId: driverUser.id },
    update: {
      licenseNo: "B321-9845",
      vehicle: "Toyota KDH",
      status: "Available",
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

  const offer = await prisma.offer.create({
    data: {
      title: "Early Bird Cultural Triangle",
      description: "Register before slots fill — price shown for transparency.",
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
        { type: "hero", headline: "Navigate Sri Lanka with confidence" },
        { type: "featured_agencies" },
        { type: "offers" },
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
