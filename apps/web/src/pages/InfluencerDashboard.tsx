import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { CreateReferralCodeModal } from "../components/influencer/CreateReferralCodeModal";
import "../styles/dashboard.css";

type TabId = "overview" | "tours" | "codes" | "commissions" | "how-it-works";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "tours", label: "Agency Tours" },
  { id: "codes", label: "Referral Codes" },
  { id: "commissions", label: "Commissions" },
  { id: "how-it-works", label: "How It Works" },
];

type TourRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  days: number;
  basePriceLkr: number;
  coverUrl: string | null;
  seasonTag: string | null;
  agency: { id: string; name: string; slug: string };
};

type CodeRow = {
  id: string;
  code: string;
  commissionPct: number;
  clickCount: number;
  isActive: boolean;
  inquiryCount: number;
  commissionCount: number;
  shareUrl?: string;
  sharePath: string;
  tour: TourRow | null;
};

type CommissionRow = {
  id: string;
  amountLkr: number;
  status: string;
  createdAt: string;
  code: string;
  inquiry: {
    id: string;
    status: string;
    tourist: { name: string };
  };
};

type DashboardData = {
  profile: { id: string; name: string; bio: string | null };
  stats: {
    totalEarned: number;
    pendingCommission: number;
    totalClicks: number;
    activeCodes: number;
    totalInquiries: number;
  };
  codes: CodeRow[];
  commissions: CommissionRow[];
};

export function InfluencerDashboard() {
  const { token } = useAuth();
  const [tab, setTab] = useState<TabId>("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [tours, setTours] = useState<TourRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [agencyFilter, setAgencyFilter] = useState("all");
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [preselectedTourId, setPreselectedTourId] = useState<string | undefined>();

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [dash, tourList] = await Promise.all([
        api<DashboardData>("/influencer/dashboard", { token }),
        api<TourRow[]>("/influencer/tours", { token }),
      ]);
      setData(dash);
      setTours(tourList);
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const agencies = useMemo(() => {
    const map = new Map<string, string>();
    tours.forEach((t) => map.set(t.agency.id, t.agency.name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tours]);

  const filteredTours = useMemo(() => {
    if (agencyFilter === "all") return tours;
    return tours.filter((t) => t.agency.id === agencyFilter);
  }, [tours, agencyFilter]);

  const codesByTourId = useMemo(() => {
    const map = new Map<string, CodeRow>();
    data?.codes.forEach((c) => {
      if (c.tour?.id && c.isActive) map.set(c.tour.id, c);
    });
    return map;
  }, [data?.codes]);

  function openCreateForTour(tourId?: string) {
    setPreselectedTourId(tourId);
    setCodeModalOpen(true);
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${label} copied.`);
      setTimeout(() => setStatus(""), 2000);
    } catch {
      setStatus("Could not copy to clipboard.");
    }
  }

  if (loading || !data) {
    return (
      <section className="agent-tab-panel" style={{ padding: "24px 20px" }}>
        <p className="muted">Loading influencer dashboard…</p>
      </section>
    );
  }

  const { profile, stats, codes, commissions } = data;

  return (
    <>
      <nav className="agent-tabs" aria-label="Influencer dashboard tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`agent-tab-btn${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="agent-tab-panels">
        {status && <p className="driver-status">{status}</p>}

        {tab === "overview" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>Welcome, {profile.name}</h2>
              <p>
                Promote ready-made tours from agencies. When tourists inquire using your referral
                link and the agency sends an itinerary, you earn commission.
              </p>
            </div>
            <div className="agent-stat-grid">
              <div className="agent-stat-card">
                <h3>Total earned</h3>
                <p className="agent-stat-value">LKR {stats.totalEarned.toLocaleString()}</p>
                <p className="muted">Approved & paid commissions</p>
              </div>
              <div className="agent-stat-card">
                <h3>Pending</h3>
                <p className="agent-stat-value">LKR {stats.pendingCommission.toLocaleString()}</p>
                <p className="muted">Awaiting agency approval</p>
              </div>
              <div className="agent-stat-card">
                <h3>Link clicks</h3>
                <p className="agent-stat-value">{stats.totalClicks}</p>
                <p className="muted">Across all referral codes</p>
              </div>
              <div className="agent-stat-card">
                <h3>Referred inquiries</h3>
                <p className="agent-stat-value">{stats.totalInquiries}</p>
                <p className="muted">{stats.activeCodes} active codes</p>
              </div>
            </div>
            <div className="panel-head" style={{ marginTop: 24 }}>
              <button type="button" className="btn btn-primary" onClick={() => openCreateForTour()}>
                Create referral code
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginLeft: 8 }}
                onClick={() => setTab("tours")}
              >
                Browse agency tours
              </button>
            </div>
          </article>
        )}

        {tab === "tours" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>Ready-made tours from agencies</h2>
              <p>Pick a tour to generate a unique referral link. Tourists land on the tour page with your code tracked.</p>
            </div>
            <div className="agent-toolbar">
              <label className="muted">
                Agency{" "}
                <select value={agencyFilter} onChange={(e) => setAgencyFilter(e.target.value)}>
                  <option value="all">All agencies</option>
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {filteredTours.length === 0 ? (
              <p className="muted">No published ready-made tours yet.</p>
            ) : (
              <div className="influencer-tour-grid">
                {filteredTours.map((tour) => {
                  const existing = codesByTourId.get(tour.id);
                  return (
                    <div key={tour.id} className="influencer-tour-card">
                      {tour.coverUrl ? (
                        <img src={tour.coverUrl} alt="" className="influencer-tour-cover" />
                      ) : (
                        <div className="influencer-tour-cover placeholder" />
                      )}
                      <div className="influencer-tour-body">
                        <p className="influencer-tour-agency">{tour.agency.name}</p>
                        <h3>{tour.title}</h3>
                        <p className="muted">
                          {tour.days} days · LKR {tour.basePriceLkr.toLocaleString()}
                          {tour.seasonTag ? ` · ${tour.seasonTag}` : ""}
                        </p>
                        {tour.summary && <p className="influencer-tour-summary">{tour.summary}</p>}
                        <div className="influencer-tour-actions">
                          <Link
                            to={`/tours/${tour.agency.slug}/${tour.slug}`}
                            className="btn btn-ghost"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Preview
                          </Link>
                          {existing ? (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() =>
                                copyText(
                                  existing.shareUrl ||
                                    `${window.location.origin}${existing.sharePath}`,
                                  "Referral link"
                                )
                              }
                            >
                              Copy {existing.code}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => openCreateForTour(tour.id)}
                            >
                              Create code
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        )}

        {tab === "codes" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>Your referral codes</h2>
              <button type="button" className="btn btn-primary" onClick={() => openCreateForTour()}>
                New code
              </button>
            </div>
            {codes.length === 0 ? (
              <p className="muted">No codes yet. Browse agency tours to create your first link.</p>
            ) : (
              <div className="agent-table-wrap">
                <table className="agent-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Tour</th>
                      <th>Commission</th>
                      <th>Clicks</th>
                      <th>Inquiries</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.code}</strong>
                          {!c.isActive && <span className="muted"> (inactive)</span>}
                        </td>
                        <td>
                          {c.tour ? (
                            <>
                              {c.tour.agency.name} — {c.tour.title}
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>{c.commissionPct}%</td>
                        <td>{c.clickCount}</td>
                        <td>{c.inquiryCount}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() =>
                              copyText(
                                c.shareUrl || `${window.location.origin}${c.sharePath}`,
                                "Link"
                              )
                            }
                          >
                            Copy link
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        )}

        {tab === "commissions" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>Commissions</h2>
              <p>Earnings when agencies send itineraries to tourists who used your referral code.</p>
            </div>
            {commissions.length === 0 ? (
              <p className="muted">No commissions yet. Share your links to start earning.</p>
            ) : (
              <div className="agent-table-wrap">
                <table className="agent-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Code</th>
                      <th>Tourist</th>
                      <th>Inquiry</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((c) => (
                      <tr key={c.id}>
                        <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                        <td>{c.code}</td>
                        <td>{c.inquiry.tourist.name}</td>
                        <td>
                          <span className={`agent-status-pill ${inquiryPillClass(c.inquiry.status)}`}>
                            {c.inquiry.status}
                          </span>
                        </td>
                        <td className="price">LKR {c.amountLkr.toLocaleString()}</td>
                        <td>
                          <span className={`agent-status-pill ${commissionPillClass(c.status)}`}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        )}

        {tab === "how-it-works" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>How referral commissions work</h2>
            </div>
            <ol className="influencer-steps">
              <li>
                <strong>Browse agency tours</strong> — Only published ready-made packages appear in
                the Agency Tours tab.
              </li>
              <li>
                <strong>Create a code per tour</strong> — You get a shareable link like{" "}
                <code>/tours/agency-slug/tour-slug?ref=YOURCODE</code>.
              </li>
              <li>
                <strong>Share with your audience</strong> — Clicks are tracked automatically when
                someone opens your link.
              </li>
              <li>
                <strong>Tourist inquires</strong> — They submit a tour inquiry on the agency site
                with your code attached.
              </li>
              <li>
                <strong>You earn commission</strong> — When the agency replies with a custom
                itinerary, a pending commission is created at your agreed percentage.
              </li>
            </ol>
          </article>
        )}
      </section>

      {token && (
        <CreateReferralCodeModal
          open={codeModalOpen}
          token={token}
          tours={tours}
          preselectedTourId={preselectedTourId}
          onClose={() => setCodeModalOpen(false)}
          onCreated={loadAll}
        />
      )}
    </>
  );
}

function inquiryPillClass(status: string) {
  if (status === "ACCEPTED" || status === "BOOKED") return "ok";
  if (status === "DECLINED") return "late";
  return "warn";
}

function commissionPillClass(status: string) {
  if (status === "PAID" || status === "APPROVED") return "ok";
  if (status === "DECLINED") return "late";
  return "warn";
}
