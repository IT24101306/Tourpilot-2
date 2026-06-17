import type { AgencyInquiry } from "./types";
import type { TaskItem } from "../../types/tasks";
import { formatInquiryStatus } from "./types";
import {
  isCommissionNegotiationOpen,
  type CommissionNegotiation,
} from "../../lib/commissionNegotiationTypes";

export function buildAgencyTasks(
  inquiries: AgencyInquiry[],
  commissionRequests: CommissionNegotiation[] = []
): TaskItem[] {
  const tasks: TaskItem[] = [];

  for (const req of commissionRequests) {
    if (!isCommissionNegotiationOpen(req) || req.pendingActor !== "AGENCY") continue;
    tasks.push({
      id: `commission-${req.id}`,
      title: `Commission: ${req.influencer.name}`,
      hint: `${req.tour.title} · offered ${req.currentOfferPct}% · negotiate in Tasks`,
      priority: "high",
      dueLabel: "Today",
      dueToday: true,
      category: "Commission",
      link: "/dashboard/agency/tasks",
      sourceKey: req.id,
    });
  }

  for (const inq of inquiries) {
    const traveler = inq.tourist?.name ?? "Traveler";
    const trip = inq.tour?.title ?? "Custom trip";
    const base = {
      sourceKey: inq.id,
      link: `/dashboard/agency/trip-room/${inq.id}`,
      category: formatInquiryStatus(inq.status),
    };

    switch (inq.status) {
      case "NEW":
        tasks.push({
          id: `inq-${inq.id}-first-response`,
          title: `Reply to ${traveler}`,
          hint: `New inquiry · ${trip} · ${inq.pax} guests`,
          priority: "high",
          dueLabel: "Today",
          dueToday: true,
          ...base,
        });
        break;
      case "REVISION_REQUESTED":
        tasks.push({
          id: `inq-${inq.id}-revise`,
          title: `Revise proposal for ${traveler}`,
          hint: "Traveler requested changes — update options in trip room",
          priority: "high",
          dueLabel: "Today",
          dueToday: true,
          ...base,
        });
        break;
      case "AGENCY_REVIEWING":
      case "ITINERARY_DRAFT":
        tasks.push({
          id: `inq-${inq.id}-proposal`,
          title: `Finish proposal for ${traveler}`,
          hint: `${trip} — send or update in trip room`,
          priority: "medium",
          dueLabel: "This week",
          ...base,
        });
        break;
      case "SENT_TO_TOURIST":
      case "TOURIST_VIEWED":
        tasks.push({
          id: `inq-${inq.id}-followup`,
          title: `Follow up with ${traveler}`,
          hint: "Proposal sent — waiting on decision",
          priority: "medium",
          dueLabel: "In 2 days",
          ...base,
        });
        break;
      case "ACCEPTED":
        tasks.push({
          id: `inq-${inq.id}-ops`,
          title: `Confirm ops for ${traveler}`,
          hint: "Assign driver, hotels, and final timings",
          priority: "high",
          dueLabel: "Before travel date",
          dueToday: true,
          ...base,
        });
        break;
      default:
        break;
    }
  }

  tasks.push({
    id: "agency-review-drivers",
    title: "Review driver availability",
    hint: "Check who is free for upcoming confirmed trips",
    priority: "low",
    dueLabel: "Weekly",
    category: "Fleet",
    link: "/dashboard/agency/drivers",
  });

  return tasks.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
}

function priorityRank(p: TaskItem["priority"]) {
  if (p === "high") return 0;
  if (p === "medium") return 1;
  return 2;
}
