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

/** Fallback defaults when platform settings / API are unavailable. */
export const DEFAULT_LOGIN_FEE_LKR: Record<UserRole, number> = {
  TOURIST: 0,
  AGENCY: 50,
  INFLUENCER: 25,
  DRIVER: 25,
  ADMIN: 0,
};

/** @deprecated Prefer platform settings / DEFAULT_LOGIN_FEE_LKR */
export const LOGIN_FEE_LKR = DEFAULT_LOGIN_FEE_LKR;

export function dashboardPathForRole(role: UserRole): string {
  switch (role) {
    case "AGENCY":
      return "/dashboard/agency";
    case "INFLUENCER":
      return "/dashboard/i";
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

export { MAX_AGENCY_HERO_SLIDES } from "./displayLimits.js";

export {
  CEYLON_TRAILS_HERO_IMAGES,
  DEFAULT_TOUR_COVER_URL,
  LANKA_TOUR_TRAILS_LOGO,
  LANKA_TOUR_TRAILS_SOCIAL_LINKS,
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
  describeOfferRewardTier,
  formatOfferMonthLabel,
  offerRewardTierCompactLabel,
  offerRewardTierForEveryone,
  offerRewardTierHeadline,
  offerRewardTierDisplayLine,
  offerRewardTierIcon,
  offerRewardTierMilestoneHeading,
  summarizeOfferRewardTiers,
  OFFER_MONTH_ABBREVS,
  parseOfferMonthParts,
  parseOfferRewardTiers,
  type OfferRewardTier,
} from "./offerTypes.js";

export {
  buildEntityMediaStore,
  entityMainImageUrl,
  normalizeEntityMedia,
  type EntityMediaBundle,
  type EntityMediaItem,
  type EntityMediaKind,
} from "./entityMedia.js";

export {
  calendarDaysBetween,
  endDateFromStartAndTourDays,
  formatTourDaysNights,
  tourNightsFromDays,
} from "./tourDuration.js";

export {
  DISPLAY_CURRENCIES,
  DISPLAY_CURRENCY_LABELS,
  LISTING_CURRENCY,
  LKR_PER_DISPLAY_UNIT,
  LKR_PER_USD,
  convertLkrToDisplay,
  formatDisplayMoney,
  formatFromLkr,
  isBakedUsdPriceLabel,
  isDisplayCurrency,
  parseUsdAmountFromLabel,
  resolveAmountLkrForDisplay,
  resolveLkrRates,
  usdToLkr,
  type DisplayCurrency,
  type FxRatesPayload,
  type LkrRateTable,
} from "./currency.js";

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

export {
  normalizeSocialTagHandle,
  resolveSocialTagHandle,
  type SocialLinkLike,
} from "./socialTagHandle.js";

export {
  DEFAULT_PRICING_PAGE,
  formatPricingLkr,
  normalizePricingFeatureLine,
  normalizePricingFeatureLines,
  parsePricingPageContent,
  type PricingAddonFeature,
  type PricingFeatureLine,
  type PricingFilterOption,
  type PricingIncludedSection,
  type PricingPackage,
  type PricingPageContent,
} from "./pricingPage.js";

export {
  DEFAULT_SUPPORT_CONTENT,
  parseSupportContent,
  type SupportAgent,
  type SupportContent,
} from "./supportContent.js";

export {
  SESSION_INACTIVITY_DEFAULT_MINUTES,
  SESSION_INACTIVITY_MAX_MINUTES,
  SESSION_INACTIVITY_MIN_MINUTES,
  clampSessionInactivityMinutes,
  formatSessionInactivity,
  resolveSessionInactivityMinutes,
  splitSessionInactivityForEdit,
  toSessionInactivityMinutes,
  type SessionInactivityUnit,
} from "./sessionInactivity.js";

export {
  TRIAL_DAYS,
  TRIAL_REMINDER_HOURS_BEFORE,
  buildTrialStatus,
  isTrialActive,
  isTrialExpiredUnpaid,
  registerProUrlForPackage,
  trialEndsAtFrom,
  type PackageBilling,
  type SelectedPackageInput,
  type TrialStatusView,
} from "./trial.js";

export {
  isRichTextEmpty,
  normalizeRichHtml,
  sanitizeRichHtml,
  stripRichHtml,
} from "./richText.js";

export {
  TRUST_BADGE_DEFS,
  evaluateTrustBadges,
  earnedBadgeKeys,
  type TrustBadgeKey,
  type TrustBadgeDef,
  type TrustBadgeStats,
  type EarnedTrustBadge,
} from "./trustBadges.js";

export {
  computeMarginPct,
  buildMarginCoachTips,
  type MarginCoachInput,
  type MarginCoachTip,
  type MarginCoachTone,
} from "./marginCoach.js";

export {
  pipelineNextActions,
  softAiMomentsForContext,
  chatAssistSuggestions,
  draftProposalIntro,
  type SoftAiMoment,
  type ChatAssistSuggestion,
  type PipelineNextAction,
} from "./softAi.js";
