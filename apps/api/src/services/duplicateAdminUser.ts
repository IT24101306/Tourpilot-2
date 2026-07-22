import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asJson } from "../utils/json.js";
import { slugify } from "../utils/slug.js";
import { isValidInternationalPhone, toStoredPhone } from "../utils/phone.js";

export type DuplicateUserInput = {
  name: string;
  phone: string;
  email?: string | null;
  role: "TOURIST" | "AGENCY" | "INFLUENCER" | "DRIVER" | "ADMIN";
  isActive?: boolean;
  walletBalance?: number;
  loginFeeLkr?: number | null;
  /** Optional new agency name/slug base when cloning an agency. */
  agencyName?: string;
};

export type DuplicateUserResult = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  isActive: boolean;
  walletBalance: number;
  loginFeeOverride: number | null;
  agency: {
    id: string;
    name: string;
    slug: string;
    entitiesCloned: number;
    groupsCloned: number;
    toursCloned: number;
  } | null;
};

async function uniqueAgencySlug(
  tx: Prisma.TransactionClient,
  baseName: string,
  ownerId: string
): Promise<string> {
  let slug = slugify(baseName) || "agency";
  const taken = await tx.agency.findUnique({ where: { slug }, select: { id: true } });
  if (taken) slug = `${slug}-${ownerId.slice(-6)}`;
  const stillTaken = await tx.agency.findUnique({ where: { slug }, select: { id: true } });
  if (stillTaken) slug = `${slug}-${Date.now().toString(36)}`;
  return slug;
}

/**
 * Duplicate a user. When the source owns an agency, also clones display settings,
 * entities, entity groups, and tours (with day plans), remapping entity/group FKs.
 */
export async function duplicateAdminUser(
  sourceUserId: string,
  input: DuplicateUserInput
): Promise<DuplicateUserResult> {
  const phone = toStoredPhone(input.phone);
  if (!isValidInternationalPhone(phone)) {
    const err = new Error(
      "Invalid phone number. Include country code (e.g. +94771234567)."
    );
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  const exists = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (exists) {
    const err = new Error("Account already exists for this phone");
    (err as Error & { status: number }).status = 409;
    throw err;
  }

  const source = await prisma.user.findUnique({
    where: { id: sourceUserId },
    include: {
      agency: {
        include: {
          displaySettings: true,
          entities: true,
          entityGroups: { include: { items: true } },
          tours: {
            include: {
              tourDays: {
                include: { items: true },
                orderBy: { dayNumber: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!source) {
    const err = new Error("Source user not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }

  const wallet = Math.max(0, Math.round(input.walletBalance ?? 0));
  const loginFee =
    input.loginFeeLkr === undefined
      ? source.loginFeeLkr != null
        ? Math.round(Number(source.loginFeeLkr))
        : undefined
      : input.loginFeeLkr === null
        ? null
        : Math.round(input.loginFeeLkr);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name.trim(),
        phone,
        email: input.email ?? null,
        role: input.role,
        isActive: input.isActive ?? true,
        walletBalance: wallet,
        loginFeeLkr: loginFee === undefined ? undefined : loginFee,
      },
    });

    if (wallet > 0) {
      await tx.walletLedger.create({
        data: {
          userId: user.id,
          type: "ADJUSTMENT",
          amountLkr: wallet,
          balanceAfter: wallet,
          note: "Admin: opening balance (duplicated account)",
        },
      });
    }

    let agencySummary: DuplicateUserResult["agency"] = null;

    const sourceAgency = source.agency;
    if (sourceAgency && input.role === "AGENCY") {
      const agencyName = (input.agencyName?.trim() || sourceAgency.name).trim();
      const slug = await uniqueAgencySlug(tx, agencyName, user.id);

      const newAgency = await tx.agency.create({
        data: {
          ownerId: user.id,
          name: agencyName,
          slug,
          tagline: sourceAgency.tagline,
          description: sourceAgency.description,
          logoUrl: sourceAgency.logoUrl,
          coverUrl: sourceAgency.coverUrl,
          district: sourceAgency.district,
          status: sourceAgency.status === "REJECTED" ? "PENDING" : sourceAgency.status,
          pageConfig: sourceAgency.pageConfig == null ? undefined : asJson(sourceAgency.pageConfig),
          gallery: sourceAgency.gallery == null ? undefined : asJson(sourceAgency.gallery),
          contactPhone: phone,
          contactEmail: sourceAgency.contactEmail,
          influencerCommissionPct: sourceAgency.influencerCommissionPct,
          kyc: sourceAgency.kyc == null ? undefined : asJson(sourceAgency.kyc),
          kycSubmittedAt: sourceAgency.kycSubmittedAt,
          featureDriversAndPartners: sourceAgency.featureDriversAndPartners,
          featureSupport: sourceAgency.featureSupport,
          featureWalletTopup: sourceAgency.featureWalletTopup,
          featureOffers: sourceAgency.featureOffers,
          featureDisplay: sourceAgency.featureDisplay,
          featureReadyMadeTours: sourceAgency.featureReadyMadeTours,
          featureCustomInquiries: sourceAgency.featureCustomInquiries,
          featureNegotiationsBookings: sourceAgency.featureNegotiationsBookings,
          featureCustomDomain: sourceAgency.featureCustomDomain,
          featureExternalStorefront: sourceAgency.featureExternalStorefront,
          featureSessionInactivityTimeout: sourceAgency.featureSessionInactivityTimeout,
          sessionInactivityHours: sourceAgency.sessionInactivityHours,
          sessionInactivityMinutes: sourceAgency.sessionInactivityMinutes,
          customDomain: null,
          customDomainStatus: "NONE",
          customDomainVerifiedAt: null,
        },
      });

      if (sourceAgency.displaySettings) {
        await tx.displaySettings.create({
          data: {
            agencyId: newAgency.id,
            sections: asJson(sourceAgency.displaySettings.sections),
            theme:
              sourceAgency.displaySettings.theme == null
                ? undefined
                : asJson(sourceAgency.displaySettings.theme),
          },
        });
      }

      const entityIdMap = new Map<string, string>();
      for (const entity of sourceAgency.entities) {
        const created = await tx.entity.create({
          data: {
            agencyId: newAgency.id,
            name: entity.name,
            type: entity.type,
            city: entity.city,
            district: entity.district,
            description: entity.description,
            durationMin: entity.durationMin,
            priceHint: entity.priceHint,
            contact: entity.contact,
            lat: entity.lat,
            lng: entity.lng,
            media: entity.media == null ? undefined : asJson(entity.media),
            metadata: entity.metadata == null ? undefined : asJson(entity.metadata),
          },
        });
        entityIdMap.set(entity.id, created.id);
      }

      const groupIdMap = new Map<string, string>();
      for (const group of sourceAgency.entityGroups) {
        const created = await tx.entityGroup.create({
          data: {
            agencyId: newAgency.id,
            name: group.name,
            description: group.description,
          },
        });
        groupIdMap.set(group.id, created.id);

        for (const item of group.items) {
          const newEntityId = entityIdMap.get(item.entityId);
          if (!newEntityId) continue;
          await tx.entityGroupItem.create({
            data: {
              groupId: created.id,
              entityId: newEntityId,
              sortOrder: item.sortOrder,
            },
          });
        }
      }

      let toursCloned = 0;
      for (const tour of sourceAgency.tours) {
        const newTour = await tx.tour.create({
          data: {
            agencyId: newAgency.id,
            title: tour.title,
            slug: tour.slug,
            summary: tour.summary,
            description: tour.description,
            days: tour.days,
            tourKind: tour.tourKind,
            basePriceLkr: tour.basePriceLkr,
            influencerCommissionPct: tour.influencerCommissionPct,
            influencerCommissionLkr: tour.influencerCommissionLkr,
            seasonTag: tour.seasonTag,
            districtTags:
              tour.districtTags == null ? undefined : asJson(tour.districtTags),
            coverUrl: tour.coverUrl,
            media: tour.media == null ? undefined : asJson(tour.media),
            influencerInstructions: tour.influencerInstructions,
            isPublished: tour.isPublished,
          },
        });
        toursCloned += 1;

        for (const day of tour.tourDays) {
          const newDay = await tx.tourDay.create({
            data: {
              tourId: newTour.id,
              dayNumber: day.dayNumber,
              title: day.title,
              transportVehicleId: day.transportVehicleId,
              transportLabel: day.transportLabel,
              transportRateLkr: day.transportRateLkr,
              transportSellingPriceLkr: day.transportSellingPriceLkr,
            },
          });

          for (const item of day.items) {
            await tx.tourDayItem.create({
              data: {
                tourDayId: newDay.id,
                entityId: item.entityId ? entityIdMap.get(item.entityId) ?? null : null,
                groupId: item.groupId ? groupIdMap.get(item.groupId) ?? null : null,
                kind: item.kind,
                label: item.label,
                priceLkr: item.priceLkr,
                sellingPriceLkr: item.sellingPriceLkr,
                scheduledTime: item.scheduledTime,
                sortOrder: item.sortOrder,
                notes: item.notes,
              },
            });
          }
        }
      }

      agencySummary = {
        id: newAgency.id,
        name: newAgency.name,
        slug: newAgency.slug,
        entitiesCloned: entityIdMap.size,
        groupsCloned: groupIdMap.size,
        toursCloned,
      };
    }

    return { user, agencySummary };
  });

  const loginFeeOverride =
    result.user.loginFeeLkr != null ? Math.round(Number(result.user.loginFeeLkr)) : null;

  return {
    id: result.user.id,
    name: result.user.name,
    phone: result.user.phone,
    email: result.user.email,
    role: result.user.role,
    isActive: result.user.isActive,
    walletBalance: Number(result.user.walletBalance),
    loginFeeOverride,
    agency: result.agencySummary,
  };
}
