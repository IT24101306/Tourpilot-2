import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { DriverAvailabilityCalendar } from "../components/driver/DriverAvailabilityCalendar";
import { DashboardModal, ModalActions, ModalField } from "../components/DashboardModal";
import "../styles/dashboard.css";

type TabId =
  | "overview"
  | "assigned"
  | "schedule"
  | "vehicle"
  | "earnings"
  | "profile"
  | "calendar"
  | "display";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "assigned", label: "Assigned Tours" },
  { id: "schedule", label: "Today Schedule" },
  { id: "vehicle", label: "Vehicle" },
  { id: "earnings", label: "Earnings" },
  { id: "profile", label: "Profile" },
  { id: "calendar", label: "Calendar" },
  { id: "display", label: "Display" },
];

type DriverProfile = {
  name: string;
  phone: string;
  email: string | null;
  licenseNo: string | null;
  vehicle: string | null;
  status: string;
  bio: string | null;
  experience: string;
  languages: string;
  availabilityNotes: string;
};

type DashboardData = {
  profile: DriverProfile;
  agencyDriver: {
    id: string;
    agencyId: string;
    agencyName: string;
    status: string;
  } | null;
  blockedDates: string[];
  articles: unknown[];
};

const MOCK_ASSIGNED = [
  { code: "TR-4820", route: "Ella Loop", time: "09:30 - 12:15", guests: 4, status: "Scheduled" },
  { code: "TR-4827", route: "Nine Arches + Tea Estate", time: "14:00 - 17:30", guests: 2, status: "Scheduled" },
  { code: "TR-4811", route: "Sunset Viewpoint", time: "17:45 - 19:15", guests: 3, status: "Scheduled" },
];

const MOCK_SCHEDULE = [
  { time: "09:30", title: "Pickup — Ella City Hotel", done: false },
  { time: "10:15", title: "Scenic stop — Ravana Falls", done: false },
  { time: "11:00", title: "Drop — Little Adam's Peak trailhead", done: false },
  { time: "14:00", title: "Pickup — Nine Arches Bridge", done: false },
];

export function DriverDashboard() {
  const { token, refreshUser } = useAuth();
  const [tab, setTab] = useState<TabId>("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [tourFilter, setTourFilter] = useState("all");
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<DriverProfile | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<DashboardData>("/drivers/me", { token });
      setData(res);
      setBlockedDates(res.blockedDates);
      setProfileForm(res.profile);
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const filteredTours = useMemo(() => {
    if (tourFilter === "all") return MOCK_ASSIGNED;
    return MOCK_ASSIGNED.filter((t) => t.status === tourFilter);
  }, [tourFilter]);

  async function saveBlockedDates(dates: string[]) {
    if (!token) return;
    setBlockedDates(dates);
    setCalendarSaving(true);
    try {
      const res = await api<{ blockedDates: string[] }>("/drivers/me/blocked-dates", {
        method: "PUT",
        token,
        body: JSON.stringify({ dates }),
      });
      setBlockedDates(res.blockedDates);
      setStatus("Availability updated.");
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Failed to save availability");
      loadDashboard();
    } finally {
      setCalendarSaving(false);
    }
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!token || !profileForm) return;
    setProfileSaving(true);
    setStatus("");
    try {
      await api("/drivers/me/profile", {
        method: "PUT",
        token,
        body: JSON.stringify({
          name: profileForm.name,
          licenseNo: profileForm.licenseNo,
          vehicle: profileForm.vehicle,
          status: profileForm.status,
          bio: profileForm.bio,
          experience: profileForm.experience,
          languages: profileForm.languages,
          availabilityNotes: profileForm.availabilityNotes,
        }),
      });
      await refreshUser();
      await loadDashboard();
      setProfileModalOpen(false);
      setStatus("Profile saved.");
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  }

  if (loading || !data) {
    return (
      <section className="agent-tab-panel">
        <p className="muted">Loading driver dashboard…</p>
      </section>
    );
  }

  const { profile, agencyDriver } = data;
  const displayStatus = agencyDriver?.status || profile.status;

  return (
    <>
      <nav className="agent-tabs" aria-label="Driver dashboard tabs">
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
              <h2>Driver Overview</h2>
              <p>Live duty summary, active assignments, and service quality indicators.</p>
              {agencyDriver && (
                <p className="muted" style={{ marginTop: 8 }}>
                  Linked to <strong>{agencyDriver.agencyName}</strong>
                </p>
              )}
            </div>
            <div className="agent-stat-grid">
              <div className="agent-stat-card">
                <h3>Today Trips</h3>
                <p className="agent-stat-value">3</p>
                <p className="muted">2 completed, 1 upcoming</p>
              </div>
              <div className="agent-stat-card">
                <h3>Current Status</h3>
                <p className="agent-stat-value">{displayStatus}</p>
                <p className="muted">Ready for immediate assignment</p>
              </div>
              <div className="agent-stat-card">
                <h3>Distance Today</h3>
                <p className="agent-stat-value">146 km</p>
                <p className="muted">Fuel efficiency: 12.8 km/l</p>
              </div>
              <div className="agent-stat-card">
                <h3>Rating</h3>
                <p className="agent-stat-value">4.9</p>
                <p className="muted">Based on last 40 trips</p>
              </div>
            </div>
            <div className="agent-stat-grid" style={{ marginTop: 16 }}>
              <div className="agent-stat-card">
                <h3>Upcoming Pickup</h3>
                <p className="muted">09:30 AM — Ella City Hotel</p>
              </div>
              <div className="agent-stat-card">
                <h3>Next Drop</h3>
                <p className="muted">11:00 AM — Little Adam&apos;s Peak</p>
              </div>
              <div className="agent-stat-card">
                <h3>Dispatcher Note</h3>
                <p className="muted">Guest prefers short scenic stop.</p>
              </div>
            </div>
          </article>
        )}

        {tab === "assigned" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>Assigned Tours</h2>
              <p>Trips currently assigned to your profile.</p>
            </div>
            <div className="table-tools">
              <select
                className="table-filter"
                value={tourFilter}
                onChange={(e) => setTourFilter(e.target.value)}
                aria-label="Filter assigned tours"
              >
                <option value="all">All Status</option>
                <option value="Scheduled">Scheduled</option>
                <option value="On Route">On Route</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="table-wrap">
              <table className="hotel-table">
                <thead>
                  <tr>
                    <th>Tour Code</th>
                    <th>Route</th>
                    <th>Time</th>
                    <th>Guests</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTours.map((t) => (
                    <tr key={t.code}>
                      <td>
                        <strong>{t.code}</strong>
                      </td>
                      <td>{t.route}</td>
                      <td>{t.time}</td>
                      <td>{t.guests}</td>
                      <td>
                        <span className="status-pill scheduled">{t.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        )}

        {tab === "schedule" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>Today Schedule</h2>
              <p>Checklist for each ride segment.</p>
            </div>
            <ul className="driver-schedule-list">
              {MOCK_SCHEDULE.map((item) => (
                <li key={item.time}>
                  <span className="driver-schedule-time">{item.time}</span>
                  <span>{item.title}</span>
                </li>
              ))}
            </ul>
          </article>
        )}

        {tab === "vehicle" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>Vehicle Details</h2>
              <p>Vehicle assignment, compliance, and readiness checks.</p>
            </div>
            <div className="agent-stat-grid two-col">
              <div className="agent-stat-card">
                <h3>Vehicle Model</h3>
                <p className="agent-stat-value">{profile.vehicle || "Not set"}</p>
                <p className="muted">Update in Profile tab</p>
              </div>
              <div className="agent-stat-card">
                <h3>Maintenance</h3>
                <p className="agent-stat-value">In Date</p>
                <p className="muted">Next service: 08 May 2026</p>
              </div>
              <div className="agent-stat-card">
                <h3>Insurance</h3>
                <p className="agent-stat-value">Valid</p>
                <p className="muted">Expires: 19 Dec 2026</p>
              </div>
              <div className="agent-stat-card">
                <h3>Fuel Card</h3>
                <p className="agent-stat-value">Active</p>
                <p className="muted">Monthly limit: LKR 140,000</p>
              </div>
            </div>
          </article>
        )}

        {tab === "earnings" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>Earnings</h2>
              <p>Trip income and incentives overview.</p>
            </div>
            <div className="agent-stat-grid three-col">
              <div className="agent-stat-card">
                <h3>This Week</h3>
                <p className="agent-stat-value">LKR 28,500</p>
                <p className="muted">6 completed rides</p>
              </div>
              <div className="agent-stat-card">
                <h3>Incentive</h3>
                <p className="agent-stat-value">LKR 4,000</p>
                <p className="muted">On-time completion bonus</p>
              </div>
              <div className="agent-stat-card">
                <h3>Pending Payout</h3>
                <p className="agent-stat-value">LKR 9,600</p>
                <p className="muted">Releases on Monday</p>
              </div>
            </div>
          </article>
        )}

        {tab === "profile" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>Driver Profile</h2>
              <p>Keep your availability and contact details up to date.</p>
            </div>
            <div className="table-tools">
              <select
                className="table-filter"
                value={profile.status}
                onChange={async (e) => {
                  const next = e.target.value;
                  if (!token) return;
                  try {
                    await api("/drivers/me/profile", {
                      method: "PUT",
                      token,
                      body: JSON.stringify({ status: next }),
                    });
                    loadDashboard();
                  } catch {
                    setStatus("Failed to update status");
                  }
                }}
              >
                <option value="Available">Available</option>
                <option value="On Tour">On Tour</option>
                <option value="Off Duty">Off Duty</option>
              </select>
              <button type="button" className="btn btn-primary" onClick={() => setProfileModalOpen(true)}>
                Edit Profile
              </button>
            </div>
            <div className="table-wrap">
              <table className="hotel-table">
                <tbody>
                  <tr>
                    <th style={{ width: 220 }}>Driver Name</th>
                    <td>{profile.name}</td>
                  </tr>
                  <tr>
                    <th>Phone</th>
                    <td>{profile.phone}</td>
                  </tr>
                  <tr>
                    <th>License</th>
                    <td>{profile.licenseNo || "—"}</td>
                  </tr>
                  <tr>
                    <th>Experience</th>
                    <td>{profile.experience || "—"}</td>
                  </tr>
                  <tr>
                    <th>Languages</th>
                    <td>{profile.languages || "—"}</td>
                  </tr>
                  <tr>
                    <th>Availability Notes</th>
                    <td>{profile.availabilityNotes || "No notes"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        )}

        {tab === "calendar" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>Availability Calendar</h2>
              <p>Mark unavailable dates by clicking a day. Your agency sees blocked days on their dashboard.</p>
            </div>
            {calendarSaving && <p className="muted">Saving…</p>}
            <DriverAvailabilityCalendar
              blockedDates={blockedDates}
              onBlockedDatesChange={saveBlockedDates}
            />
          </article>
        )}

        {tab === "display" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>My Driver Display</h2>
              <p>Manage articles and your public driver profile.</p>
            </div>
            {data.articles.length === 0 ? (
              <p className="muted">No articles yet. Article publishing will be available in a future update.</p>
            ) : (
              <ul className="display-item-list">
                {data.articles.map((a, i) => (
                  <li key={i}>{JSON.stringify(a)}</li>
                ))}
              </ul>
            )}
          </article>
        )}
      </section>

      {profileForm && (
        <DashboardModal
          open={profileModalOpen}
          title="Update Driver Profile"
          subtitle="Edit your profile and keep the operations team informed."
          onClose={() => setProfileModalOpen(false)}
        >
          <form onSubmit={saveProfile}>
            <div className="entity-form-grid">
              <ModalField label="Driver name">
                <input
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  required
                  autoFocus
                />
              </ModalField>
              <ModalField label="License">
                <input
                  value={profileForm.licenseNo || ""}
                  onChange={(e) => setProfileForm({ ...profileForm, licenseNo: e.target.value })}
                />
              </ModalField>
              <ModalField label="Vehicle">
                <input
                  value={profileForm.vehicle || ""}
                  onChange={(e) => setProfileForm({ ...profileForm, vehicle: e.target.value })}
                />
              </ModalField>
              <ModalField label="Experience">
                <input
                  value={profileForm.experience}
                  onChange={(e) => setProfileForm({ ...profileForm, experience: e.target.value })}
                />
              </ModalField>
              <ModalField label="Languages">
                <input
                  value={profileForm.languages}
                  onChange={(e) => setProfileForm({ ...profileForm, languages: e.target.value })}
                />
              </ModalField>
              <ModalField label="Availability notes" full>
                <textarea
                  rows={3}
                  value={profileForm.availabilityNotes}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, availabilityNotes: e.target.value })
                  }
                />
              </ModalField>
            </div>
            <ModalActions
              onCancel={() => setProfileModalOpen(false)}
              submitLabel="Save profile"
              saving={profileSaving}
            />
          </form>
        </DashboardModal>
      )}
    </>
  );
}
