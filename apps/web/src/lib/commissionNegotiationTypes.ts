export type CommissionMessage = {
  id: string;
  authorRole: "INFLUENCER" | "AGENCY";
  action: "REQUEST" | "NEGOTIATE" | "AGREE" | "REJECT";
  proposedPct: number | null;
  body: string;
  createdAt: string;
};

export type CommissionNegotiation = {
  id: string;
  status: "PENDING" | "NEGOTIATING" | "APPROVED" | "REJECTED";
  requestedPct: number;
  currentOfferPct: number;
  pendingActor: "INFLUENCER" | "AGENCY";
  offerByRole: "INFLUENCER" | "AGENCY" | null;
  approvedPct: number | null;
  message: string;
  agencyNote: string | null;
  createdAt: string;
  updatedAt: string;
  tour: { id: string; title: string; slug: string };
  influencer: { id: string; name: string; phone: string };
  agency: { id: string; name: string };
  messages: CommissionMessage[];
};

export function isCommissionNegotiationOpen(row: CommissionNegotiation) {
  return row.status === "PENDING" || row.status === "NEGOTIATING";
}

export function commissionStatusLabel(status: CommissionNegotiation["status"]) {
  switch (status) {
    case "PENDING":
      return "Awaiting agency";
    case "NEGOTIATING":
      return "In negotiation";
    case "APPROVED":
      return "Agreed";
    case "REJECTED":
      return "Declined";
    default:
      return status;
  }
}
