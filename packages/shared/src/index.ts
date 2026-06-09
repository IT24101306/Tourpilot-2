export type UserRole = "TOURIST" | "AGENCY" | "INFLUENCER" | "DRIVER" | "ADMIN";

export type InquiryStatus =
  | "NEW"
  | "AGENCY_REVIEWING"
  | "ITINERARY_DRAFT"
  | "SENT_TO_TOURIST"
  | "TOURIST_VIEWED"
  | "REVISION_REQUESTED"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED";

export type InquiryType = "READY_MADE" | "CUSTOM";

export type LineItemKind = "REQUIRED" | "OPTIONAL" | "UPGRADE";

export type EntityType = "HOTEL" | "VIEWPOINT" | "ACTIVITY" | "RESTAURANT" | "OTHER";

export const LOGIN_FEE_LKR: Record<UserRole, number> = {
  TOURIST: 0,
  AGENCY: 50,
  INFLUENCER: 25,
  DRIVER: 25,
  ADMIN: 0,
};

export function dashboardPathForRole(role: UserRole): string {
  switch (role) {
    case "AGENCY":
      return "/dashboard/agency";
    case "INFLUENCER":
      return "/dashboard/influencer";
    case "DRIVER":
      return "/dashboard/driver";
    case "ADMIN":
      return "/dashboard/admin";
    default:
      return "/profile";
  }
}

export {
  combinePhoneParts,
  formatPhoneDisplay,
  isValidInternationalPhone,
  toStoredPhone,
} from "./phone.js";

export {
  CEYLON_TRAILS_HERO_IMAGES,
  DEFAULT_TOUR_COVER_URL,
  MEDIA,
  isUsableImageUrl,
  resolveImageUrl,
} from "./media.js";

export {
  commissionLkrFromBase,
  displayTourPrice,
  tourCommissionLkr,
  tourPublicPriceLkr,
  type TourPriceFields,
} from "./tourPricing.js";

export {
  AGENCY_BUSINESS_TYPES,
  AGENCY_BUSINESS_TYPE_LABELS,
  AGENCY_ID_TYPES,
  SRI_LANKA_DISTRICTS,
  agencyBusinessTypeLabel,
  defaultAgencyKyc,
  type AgencyBusinessType,
  type AgencyIdType,
  type AgencyKycInput,
  type AgencyKycRecord,
} from "./agencyKyc.js";
