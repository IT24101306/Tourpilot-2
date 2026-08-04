import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { OpsMetricStrip } from "../../components/module/OpsMetricStrip";
import { OperationsQueue } from "../../components/module/OperationsQueue";
import {
  filterInquiries,
  groupByQueue,
  opsMetrics,
  type OpsFilter,
} from "./operationsUtils";
import { AgencyInquiry, formatInquiryStatus, inquiryStatusClass } from "./types";

export function AgencyBookingsPage() {
  const { token } = useAuth();
  const [inquiries, setInquiries] = useState<AgencyInquiry[]>([]);
  const [filter, setFilter] = useState<OpsFilter>("all");
  const [selectedInquiry, setSelectedInquiry] = useState<string | null>(null);
  const [itineraryLabel, setItineraryLabel] = useState("Day 1 experience");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api<AgencyInquiry[]>("/inquiries/mine", { token })
      .then(setInquiries)
      .finally(() => setLoading(false));
  }, [token]);

  const metrics = useMemo(() => opsMetrics(inquiries), [inquiries]);
  const filtered = useMemo(() => filterInquiries(inquiries, filter), [inquiries, filter]);
  const queues = useMemo(() => groupByQueue(filtered), [filtered]);

  async function refresh() {
    if (!token) return;
    const list = await api<AgencyInquiry[]>("/inquiries/mine", { token });
    setInquiries(list);
  }

  async function lifecycle(inquiryId: string, action: "start" | "complete") {
    if (!token) return;
    setActingId(inquiryId);
    setActionMsg("");
    try {
      await api(`/inquiries/${inquiryId}/lifecycle`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ action }),
      });
      setActionMsg(action === "start" ? "Trip started." : "Trip completed.");
      await refresh();
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setActingId(null);
    }
  }

  async function sendItinerary(inquiryId: string) {
    if (!token) return;
    await api(`/inquiries/${inquiryId}/itinerary`, {
      method: "POST",
      token,
      body: JSON.stringify({
        title: "Your custom Sri Lanka itinerary",
        days: [
          {
            dayNumber: 1,
            title: "Day 1",
            items: [
              { label: itineraryLabel, kind: "REQUIRED", priceLkr: 25000 },
              { label: "Premium jeep safari (optional)", kind: "OPTIONAL", priceLkr: 12000 },
            ],
          },
        ],
        send: true,
      }),
    });
    await refresh();
    setSelectedInquiry(null);
  }

  return (
    <div className="module-shell module-operations">
      <ModuleHeader
        module="operations"
        title="Bookings queue"
        subtitle="Dense, status-driven view of every trip request and what to do next."
      />

      <OpsMetricStrip
        metrics={[
          {
            id: "all",
            label: "All",
            value: metrics.total,
            hint: "Full pipeline",
            active: filter === "all",
            onClick: () => setFilter("all"),
          },
          {
            id: "action",
            label: "Needs action",
            value: metrics.needsAction,
            hint: "Your turn",
            active: filter === "action",
            onClick: () => setFilter("action"),
          },
          {
            id: "today",
            label: "Today",
            value: metrics.today,
            hint: "New today",
            active: filter === "today",
            onClick: () => setFilter("today"),
          },
          {
            id: "waiting",
            label: "Waiting",
            value: metrics.waitingTourist,
            hint: "On traveler",
            active: filter === "waiting",
            onClick: () => setFilter("waiting"),
          },
          {
            id: "confirmed",
            label: "Confirmed",
            value: metrics.confirmed,
            hint: "Won",
            active: filter === "confirmed",
            onClick: () => setFilter("confirmed"),
          },
        ]}
      />

      {actionMsg && <p className="neg-action-status">{actionMsg}</p>}

      {loading ? (
        <p className="muted">Loading bookings…</p>
      ) : filtered.length === 0 ? (
        <div className="ops-empty-panel">
          <p>No bookings match this filter.</p>
          <button type="button" className="btn btn-ghost" onClick={() => setFilter("all")}>
            Show all
          </button>
        </div>
      ) : (
        <OperationsQueue groups={queues} bookingsPath="/dashboard/agency/bookings" />
      )}

      <section className="ops-detail-panel">
        <div className="ops-board-head">
          <h3>Quick actions</h3>
          <p className="muted">
            Start or complete trips here, or build a quick itinerary for open requests.
          </p>
        </div>
        <div className="agency-list">
          {filtered.map((inq) => (
            <div key={inq.id} className="agency-list-item stacked ops-detail-card">
              <div className="agency-list-item-main">
                <span>
                  <strong>{inq.tourist?.name ?? "Traveler"}</strong>
                  {" · "}
                  {inq.tour?.title ?? "Custom trip"}
                </span>
                <span className={`agency-status ${inquiryStatusClass(inq.status)}`}>
                  {formatInquiryStatus(inq.status)}
                </span>
              </div>
              <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.88rem" }}>
                {inq.tourist?.phone}
                {inq.message ? ` — ${inq.message}` : ""}
              </p>
              <div className="neg-inquiry-card-actions" style={{ marginTop: 10 }}>
                <Link to={`/dashboard/agency/trip-room/${inq.id}`} className="btn btn-ghost">
                  Trip room
                </Link>
                {inq.status === "ACCEPTED" && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={actingId === inq.id}
                    onClick={() => lifecycle(inq.id, "start")}
                  >
                    {actingId === inq.id ? "Working…" : "Start trip"}
                  </button>
                )}
                {inq.status === "IN_PROGRESS" && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={actingId === inq.id}
                    onClick={() => lifecycle(inq.id, "complete")}
                  >
                    {actingId === inq.id ? "Working…" : "Complete trip"}
                  </button>
                )}
                {!["ACCEPTED", "IN_PROGRESS", "COMPLETED", "DECLINED", "EXPIRED"].includes(
                  inq.status
                ) && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setSelectedInquiry(inq.id)}
                  >
                    Build &amp; send itinerary
                  </button>
                )}
              </div>
              {selectedInquiry === inq.id && (
                <div className="ops-inline-form">
                  <input
                    value={itineraryLabel}
                    onChange={(e) => setItineraryLabel(e.target.value)}
                    placeholder="Main activity label"
                  />
                  <button
                    type="button"
                    className="btn btn-teal"
                    onClick={() => sendItinerary(inq.id)}
                  >
                    Send itinerary to tourist
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
