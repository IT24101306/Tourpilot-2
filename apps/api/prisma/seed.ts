import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminPhone = "0779998888";
  const agencyPhone = "0771234567";
  const touristPhone = "0771112233";
  const influencerPhone = "0774445566";

  const admin = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {},
    create: {
      phone: adminPhone,
      name: "TourPilot Admin",
      role: "ADMIN",
      walletBalance: 0,
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
        "https://images.unsplash.com/photo-1682687982501-1e58ab814714?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
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
    update: {},
    create: {
      agencyId: agency.id,
      sections: [
        { type: "hero", title: "Ceylon Trails" },
        { type: "tours" },
        { type: "reviews" },
      ],
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
    offer: offer.title,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
