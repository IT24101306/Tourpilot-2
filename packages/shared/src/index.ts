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

export type EntityType =
  | "HOTEL"
  | "VIEWPOINT"
  | "ACTIVITY"
  | "RESTAURANT"
  | "TRANSPORT"
  | "FREE_TIME"
  | "OTHER";

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
