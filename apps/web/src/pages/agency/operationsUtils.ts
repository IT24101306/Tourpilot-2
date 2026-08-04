import type { AgencyInquiry } from "./types";
import { formatInquiryStatus, inquiryStatusClass, isToday } from "./types";

export type OpsFilter = "all" | "today" | "action" | "waiting" | "confirmed";

export type OpsQueueKey = "action" | "waiting" | "confirmed" | "closed";

const ACTION_STATUSES = new Set(["NEW", "AGENCY_REVIEWING", "REVISION_REQUESTED", "ITINERARY_DRAFT"]);
const WAITING_STATUSES = new Set(["SENT_TO_TOURIST", "TOURIST_VIEWED"]);
const CONFIRMED_STATUSES = new Set(["ACCEPTED", "IN_PROGRESS", "COMPLETED"]);
const CLOSED_STATUSES = new Set(["DECLINED", "EXPIRED"]);

export function queueForStatus(status: string): OpsQueueKey {
  if (ACTION_STATUSES.has(status)) return "action";
  if (WAITING_STATUSES.has(status)) return "waiting";
  if (CONFIRMED_STATUSES.has(status)) return "confirmed";
  if (CLOSED_STATUSES.has(status)) return "closed";
  return "action";
}

export function filterInquiries(list: AgencyInquiry[], filter: OpsFilter): AgencyInquiry[] {
  switch (filter) {
    case "today":
      return list.filter((i) => isToday(i.createdAt));
    case "action":
      return list.filter((i) => ACTION_STATUSES.has(i.status));
    case "waiting":
      return list.filter((i) => WAITING_STATUSES.has(i.status));
    case "confirmed":
      return list.filter((i) => CONFIRMED_STATUSES.has(i.status));
    default:
      return list;
  }
}

export function opsMetrics(inquiries: AgencyInquiry[]) {
  return {
    today: inquiries.filter((i) => isToday(i.createdAt)).length,
    needsAction: inquiries.filter((i) => ACTION_STATUSES.has(i.status)).length,
    waitingTourist: inquiries.filter((i) => WAITING_STATUSES.has(i.status)).length,
    confirmed: inquiries.filter((i) => CONFIRMED_STATUSES.has(i.status)).length,
    total: inquiries.length,
  };
}

export function groupByQueue(inquiries: AgencyInquiry[]): Record<OpsQueueKey, AgencyInquiry[]> {
  const groups: Record<OpsQueueKey, AgencyInquiry[]> = {
    action: [],
    waiting: [],
    confirmed: [],
    closed: [],
  };
  for (const inq of inquiries) {
    groups[queueForStatus(inq.status)].push(inq);
  }
  return groups;
}

export function inquirySummary(inq: AgencyInquiry): string {
  const trip = inq.tour?.title ?? "Custom trip";
  return `${trip} · ${inq.pax} guest${inq.pax === 1 ? "" : "s"}`;
}

export function nextActionLabel(status: string): string {
  switch (status) {
    case "NEW":
      return "Send first response";
    case "AGENCY_REVIEWING":
    case "ITINERARY_DRAFT":
      return "Update proposal";
    case "REVISION_REQUESTED":
      return "Revise proposal";
    case "SENT_TO_TOURIST":
    case "TOURIST_VIEWED":
      return "Follow up with traveler";
    case "ACCEPTED":
      return "Start trip when ready";
    case "IN_PROGRESS":
      return "Complete trip when finished";
    case "COMPLETED":
      return "Trip done — check reviews";
    default:
      return "View details";
  }
}

export { formatInquiryStatus, inquiryStatusClass };
