import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { ChatRoomPopup } from "../../components/inquiry/ChatRoomPopup";
import type { NegotiationListItem } from "../../types/negotiation";
import { formatInquiryStatus, inquiryStatusClass } from "./types";

const ACTIVE = new Set([
  "NEW",
  "AGENCY_REVIEWING",
  "ITINERARY_DRAFT",
  "SENT_TO_TOURIST",
  "TOURIST_VIEWED",
  "REVISION_REQUESTED",
]);
const BOOKED = new Set(["ACCEPTED", "IN_PROGRESS"]);
const CLOSED = new Set(["COMPLETED", "DECLINED", "EXPIRED"]);

export function AgencyNegotiationsPage() {
  const { token } = useAuth();
  const [inquiries, setInquiries] = useState<NegotiationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chatInquiry, setChatInquiry] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError("");
    api<NegotiationListItem[]>("/inquiries/mine", { token })
      .then(setInquiries)
      .catch((err) => {
        setInquiries([]);
        setError(err instanceof Error ? err.message : "Failed to load inquiries");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const active = inquiries.filter((i) => ACTIVE.has(i.status));
  const booked = inquiries.filter((i) => BOOKED.has(i.status));
  const closed = inquiries.filter((i) => CLOSED.has(i.status));

  return (
    <div className="module-shell module-negotiation">
      <ModuleHeader
        module="negotiation"
        title="Trip negotiations"
        subtitle="Active planning on the left — booked trips and closed inquiries on the right."
      >
        <Link to="/dashboard/agency/bookings" className="btn btn-ghost">
          Operations queue
        </Link>
      </ModuleHeader>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="muted">Loading negotiations…</p>
      ) : (
        <div className="neg-split-layout">
          <section className="neg-list-section neg-split-col">
            <h3>Active planning ({active.length})</h3>
            {active.length === 0 ? (
              <p className="muted">No active negotiations. New inquiries appear here automatically.</p>
            ) : (
              <ul className="neg-inquiry-list">
                {active.map((inq) => (
                  <li key={inq.id}>
                    <InquiryCard
                      inq={inq}
                      primary
                      onChat={() =>
                        setChatInquiry({
                          id: inq.id,
                          name: inq.tourist?.name ?? "Traveler",
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="neg-split-col neg-split-col--closed">
            <section className="neg-list-section">
              <h3>Booked ({booked.length})</h3>
              {booked.length === 0 ? (
                <p className="muted">Accepted and in-progress trips appear here.</p>
              ) : (
                <ul className="neg-inquiry-list">
                  {booked.map((inq) => (
                    <li key={inq.id}>
                      <InquiryCard
                        inq={inq}
                        onChat={() =>
                          setChatInquiry({
                            id: inq.id,
                            name: inq.tourist?.name ?? "Traveler",
                          })
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="neg-list-section">
              <h3>Closed ({closed.length})</h3>
              {closed.length === 0 ? (
                <p className="muted">Completed, declined, and expired inquiries appear here.</p>
              ) : (
                <ul className="neg-inquiry-list">
                  {closed.map((inq) => (
                    <li key={inq.id}>
                      <InquiryCard
                        inq={inq}
                        muted
                        onChat={() =>
                          setChatInquiry({
                            id: inq.id,
                            name: inq.tourist?.name ?? "Traveler",
                          })
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      <ChatRoomPopup
        open={Boolean(chatInquiry)}
        inquiryId={chatInquiry?.id ?? null}
        partnerName={chatInquiry?.name}
        fullRoomTo={chatInquiry ? `/dashboard/agency/trip-room/${chatInquiry.id}` : undefined}
        onClose={() => setChatInquiry(null)}
      />
    </div>
  );
}

function InquiryCard({
  inq,
  primary,
  muted,
  onChat,
}: {
  inq: NegotiationListItem;
  primary?: boolean;
  muted?: boolean;
  onChat: () => void;
}) {
  return (
    <div className={`neg-inquiry-card${muted ? " muted-card" : ""}`}>
      <div className="neg-inquiry-card-top">
        <strong>{inq.tourist?.name ?? "Traveler"}</strong>
        <span className={`agency-status ${inquiryStatusClass(inq.status)}`}>
          {formatInquiryStatus(inq.status)}
        </span>
      </div>
      {!muted && (
        <p className="muted">
          {inq.type === "READY_MADE" && inq.tour?.title ? (
            <>
              <span className="inquiry-type-pill">Ready-made tour</span> {inq.tour.title}
            </>
          ) : (
            inq.tour?.title ?? "Custom trip"
          )}{" "}
          · {inq.pax} guests ·{" "}
          {inq.proposal ? `${inq.proposal.items.length} option(s)` : "Awaiting proposal"}
        </p>
      )}
      <div className="neg-inquiry-card-actions">
        <button
          type="button"
          className={primary ? "btn btn-primary" : "btn btn-ghost"}
          onClick={onChat}
        >
          Chat
        </button>
        <Link to={`/dashboard/agency/trip-room/${inq.id}`} className="btn btn-ghost">
          {primary ? "Open trip room" : "Trip room"}
        </Link>
      </div>
    </div>
  );
}
