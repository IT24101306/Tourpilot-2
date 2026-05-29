import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ImageUrlField } from "../../components/ImageUrlField";
import { ModuleHeader } from "../../components/module/ModuleHeader";

type AdminOffer = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  rewardText: string;
  registrationCap: number;
  validFrom: string;
  validUntil: string;
  tourPriceLkr: number;
  discountedLkr: number | null;
  isActive: boolean;
  tourIds: string[];
  registeredCount: number;
  spotsLeft: number;
};

type AdminTourLite = {
  id: string;
  title: string;
  slug: string;
  isPublished: boolean;
  basePriceLkr: number;
  agency: { id: string; name: string; slug: string };
};

type OfferRegistration = {
  id: string;
  offerId: string;
  userId: string;
  createdAt: string;
  user: { id: string; name: string; phone: string; createdAt: string };
};

type OfferDraft = {
  title: string;
  description: string;
  imageUrl: string;
  rewardText: string;
  registrationCap: number;
  validFrom: string;
  validUntil: string;
  tourPriceLkr: number;
  discountedLkr: number | "";
  isActive: boolean;
  tourIds: string[];
};

function toLocalDateTimeValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function emptyDraft(): OfferDraft {
  const now = new Date();
  const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return {
    title: "",
    description: "",
    imageUrl: "",
    rewardText: "",
    registrationCap: 50,
    validFrom: toLocalDateTimeValue(now),
    validUntil: toLocalDateTimeValue(in7),
    tourPriceLkr: 0,
    discountedLkr: "",
    isActive: true,
    tourIds: [],
  };
}

function offerToDraft(o: AdminOffer): OfferDraft {
  return {
    title: o.title,
    description: o.description ?? "",
    imageUrl: o.imageUrl ?? "",
    rewardText: o.rewardText,
    registrationCap: o.registrationCap,
    validFrom: toLocalDateTimeValue(new Date(o.validFrom)),
    validUntil: toLocalDateTimeValue(new Date(o.validUntil)),
    tourPriceLkr: o.tourPriceLkr,
    discountedLkr: o.discountedLkr ?? "",
    isActive: o.isActive,
    tourIds: o.tourIds ?? [],
  };
}

export function AdminOffersPage() {
  const { token } = useAuth();
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [tours, setTours] = useState<AdminTourLite[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<OfferDraft>(() => emptyDraft());
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [registrations, setRegistrations] = useState<OfferRegistration[] | null>(null);
  const [regsMsg, setRegsMsg] = useState<string>("");

  const selected = useMemo(
    () => (selectedId ? offers.find((o) => o.id === selectedId) ?? null : null),
    [offers, selectedId]
  );

  async function refresh() {
    if (!token) return;
    const [o, t] = await Promise.all([
      api<AdminOffer[]>("/offers", { token }),
      api<AdminTourLite[]>("/tours/admin/all", { token }),
    ]);
    setOffers(o);
    setTours(t);
  }

  useEffect(() => {
    if (!token) return;
    refresh().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!selected) {
      setDraft(emptyDraft());
      setRegistrations(null);
      setRegsMsg("");
      return;
    }
    setDraft(offerToDraft(selected));
    setRegistrations(null);
    setRegsMsg("");
  }, [selected]);

  function resetNew() {
    setSelectedId(null);
    setMsg("");
    setDraft(emptyDraft());
  }

  async function submitCreate() {
    if (!token) return;
    setBusy(true);
    setMsg("");
    try {
      await api("/offers", {
        method: "POST",
        token,
        body: JSON.stringify({
          title: draft.title,
          description: draft.description || undefined,
          imageUrl: draft.imageUrl.trim() || "",
          rewardText: draft.rewardText,
          registrationCap: Number(draft.registrationCap),
          validFrom: new Date(draft.validFrom).toISOString(),
          validUntil: new Date(draft.validUntil).toISOString(),
          tourPriceLkr: Number(draft.tourPriceLkr),
          discountedLkr: draft.discountedLkr === "" ? undefined : Number(draft.discountedLkr),
          tourIds: draft.tourIds,
        }),
      });
      setMsg("Offer created.");
      await refresh();
      resetNew();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitUpdate() {
    if (!token || !selectedId) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`/offers/${selectedId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          title: draft.title,
          description: draft.description === "" ? null : draft.description,
          imageUrl: draft.imageUrl.trim() || null,
          rewardText: draft.rewardText,
          registrationCap: Number(draft.registrationCap),
          validFrom: new Date(draft.validFrom).toISOString(),
          validUntil: new Date(draft.validUntil).toISOString(),
          tourPriceLkr: Number(draft.tourPriceLkr),
          discountedLkr: draft.discountedLkr === "" ? null : Number(draft.discountedLkr),
          isActive: draft.isActive,
          tourIds: draft.tourIds,
        }),
      });
      setMsg("Offer updated.");
      await refresh();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadRegistrations() {
    if (!token || !selectedId) return;
    setRegsMsg("");
    try {
      const regs = await api<OfferRegistration[]>(`/admin/offers/${selectedId}/registrations`, { token });
      setRegistrations(regs);
    } catch (e) {
      setRegsMsg(e instanceof ApiError ? e.message : "Failed to load registrations");
      setRegistrations(null);
    }
  }

  async function deleteSelected() {
    if (!token || !selectedId) return;
    const offerTitle = selected?.title ?? "this offer";
    // eslint-disable-next-line no-alert
    const ok = window.confirm(`Delete "${offerTitle}"? This will also remove all registrations.`);
    if (!ok) return;

    setBusy(true);
    setMsg("");
    try {
      await api(`/offers/${selectedId}`, { method: "DELETE", token });
      setMsg("Offer deleted.");
      setSelectedId(null);
      setRegistrations(null);
      await refresh();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="module-shell module-governance">
      <ModuleHeader
        module="governance"
        title="Loyalty offers"
        subtitle="Configure caps, pricing, tour eligibility, and monitor registrations."
      >
        <button type="button" className="btn btn-teal" onClick={resetNew} disabled={busy}>
          New offer
        </button>
        <Link to="/dashboard/admin" className="btn btn-ghost">
          Overview
        </Link>
      </ModuleHeader>

      {msg && <p className="gov-status-msg">{msg}</p>}

      <div className="gov-offers-layout">
        <aside className="gov-offers-sidebar">
          <h3 className="gov-panel-title">All offers</h3>
          {offers.length === 0 ? (
            <p className="muted">No offers yet.</p>
          ) : (
            <ul className="gov-offer-pick-list">
              {offers.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className={`gov-offer-pick${selectedId === o.id ? " active" : ""}`}
                    onClick={() => setSelectedId(o.id)}
                    disabled={busy}
                  >
                    <span className="gov-offer-pick-main">
                      <strong>{o.title}</strong>
                      <span className="muted">
                        {o.isActive ? "Active" : "Inactive"} · {o.registeredCount} registered
                      </span>
                    </span>
                    <span className="gov-offer-pick-spots">{o.spotsLeft} left</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="gov-offers-main">
          <div className="gov-panel">
            <div className="gov-panel-head">
              <h3 className="gov-panel-title">{selectedId ? "Edit offer" : "Create offer"}</h3>
              {selectedId && (
                <button type="button" className="btn btn-ghost" onClick={deleteSelected} disabled={busy}>
                  Delete
                </button>
              )}
            </div>

            <div className="grid-2">
              <label className="field">
                <span>Title</span>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="Summer special"
                />
              </label>

              <label className="field">
                <span>Reward text</span>
                <input
                  value={draft.rewardText}
                  onChange={(e) => setDraft((d) => ({ ...d, rewardText: e.target.value }))}
                  placeholder="Earn 100 loyalty points"
                />
              </label>

              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <span>Description</span>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Short details shown on Offers page"
                  rows={3}
                />
              </label>

              <ImageUrlField
                className="field image-url-field--full"
                label="Cover image (optional)"
                value={draft.imageUrl}
                onChange={(imageUrl) => setDraft((d) => ({ ...d, imageUrl }))}
                token={token}
                placeholder="Paste a link or upload from your device"
                hint="If empty, the first linked tour's cover is used, then a default stock photo."
              />

              <label className="field">
                <span>Valid from</span>
                <input
                  type="datetime-local"
                  value={draft.validFrom}
                  onChange={(e) => setDraft((d) => ({ ...d, validFrom: e.target.value }))}
                />
              </label>

              <label className="field">
                <span>Valid until</span>
                <input
                  type="datetime-local"
                  value={draft.validUntil}
                  onChange={(e) => setDraft((d) => ({ ...d, validUntil: e.target.value }))}
                />
              </label>

              <label className="field">
                <span>Registration cap</span>
                <input
                  type="number"
                  min={1}
                  value={draft.registrationCap}
                  onChange={(e) => setDraft((d) => ({ ...d, registrationCap: Number(e.target.value) }))}
                />
              </label>

              {selectedId && (
                <label className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
                  />
                  <span>Active</span>
                </label>
              )}

              <label className="field">
                <span>Tour price (LKR)</span>
                <input
                  type="number"
                  min={0}
                  value={draft.tourPriceLkr}
                  onChange={(e) => setDraft((d) => ({ ...d, tourPriceLkr: Number(e.target.value) }))}
                />
              </label>

              <label className="field">
                <span>Discounted (LKR)</span>
                <input
                  type="number"
                  min={0}
                  value={draft.discountedLkr}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      discountedLkr: e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                  placeholder="(optional)"
                />
              </label>

              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <span>Applies to tours</span>
                <select
                  multiple
                  value={draft.tourIds}
                  onChange={(e) => {
                    const next = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setDraft((d) => ({ ...d, tourIds: next }));
                  }}
                  style={{ height: 180 }}
                >
                  {tours.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} — {t.agency.name} {t.isPublished ? "" : "(unpublished)"}
                    </option>
                  ))}
                </select>
                <span className="muted" style={{ display: "block", marginTop: 6 }}>
                  Tip: hold Ctrl/⌘ to multi-select.
                </span>
              </label>
            </div>

            <div className="gov-form-actions">
              {selectedId ? (
                <button type="button" className="btn btn-primary" onClick={submitUpdate} disabled={busy}>
                  Save changes
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={submitCreate} disabled={busy}>
                  Create offer
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => refresh()} disabled={busy || !token}>
                Refresh
              </button>
            </div>
          </div>

          {selectedId && (
            <div className="gov-panel">
              <div className="gov-panel-head">
                <h3 className="gov-panel-title">Registrations</h3>
                <button type="button" className="btn btn-ghost" onClick={loadRegistrations} disabled={!token || busy}>
                  Load
                </button>
              </div>

              {regsMsg && <p className="gov-status-msg">{regsMsg}</p>}

              {registrations == null ? (
                <p className="muted">Click “Load” to view registrations.</p>
              ) : registrations.length === 0 ? (
                <p className="muted">No registrations yet.</p>
              ) : (
                <ul className="gov-reg-list">
                  {registrations.map((r) => (
                    <li key={r.id} className="gov-reg-row">
                      <span>
                        <strong>{r.user.name}</strong>
                        <span className="muted gov-reg-phone">{r.user.phone}</span>
                      </span>
                      <span className="muted">{new Date(r.createdAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

