import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../confirm/ConfirmActionContext";
import { ImageUrlField } from "../ImageUrlField";
import { ModuleHeader } from "../module/ModuleHeader";
import { formatOfferMonthLabel, type OfferRewardTier } from "@tourpilot/shared";
import { isFreeOffer } from "../../lib/offerPricing";
import { validateOfferDraft } from "../../lib/offerForm";
import { FormValidationMessages } from "../FormFieldError";
import { offerShareFeedback, offerShareUrl, shareOffer } from "../../lib/offerShare";
import { OfferRewardTiersEditor } from "./OfferRewardTiersEditor";

export type ManagedOffer = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  rewardText: string;
  offerMonth: string | null;
  rewardTiers: OfferRewardTier[];
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

export type OfferTourLite = {
  id: string;
  title: string;
  slug: string;
  isPublished: boolean;
  basePriceLkr: number;
  agency?: { id: string; name: string; slug: string };
};

type OfferRegistration = {
  id: string;
  offerId: string;
  userId: string;
  screenshotUrl: string;
  termsAcceptedAt: string;
  createdAt: string;
  user: { id: string; name: string; phone: string; createdAt: string };
};

type OfferDraft = {
  title: string;
  description: string;
  imageUrl: string;
  rewardText: string;
  offerMonth: string | null;
  rewardTiers: OfferRewardTier[];
  registrationCap: number;
  validFrom: string;
  validUntil: string;
  tourPriceLkr: number;
  discountedLkr: number | "";
  isFreeTour: boolean;
  isActive: boolean;
};

export type OffersDashboardProps = {
  module: "governance" | "catalog";
  shellClassName: string;
  title: string;
  subtitle: string;
  descriptionPlaceholder: string;
  listPath: string;
  registrationsPath: (offerId: string) => string;
  updatePath: (offerId: string) => string;
  deletePath: (offerId: string) => string;
  backLink?: { to: string; label: string };
};

function toLocalDateTimeValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function currentOfferMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function emptyDraft(): OfferDraft {
  const now = new Date();
  const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return {
    title: "",
    description: "",
    imageUrl: "",
    rewardText: "",
    offerMonth: currentOfferMonth(),
    rewardTiers: [
      { registrationsRequired: 50, winnersCount: 50, rewardLabel: "free dinners" },
      { registrationsRequired: 100, winnersCount: 1, rewardLabel: "a free tour" },
    ],
    registrationCap: 50,
    validFrom: toLocalDateTimeValue(now),
    validUntil: toLocalDateTimeValue(in7),
    tourPriceLkr: 0,
    discountedLkr: "",
    isFreeTour: false,
    isActive: true,
  };
}

function offerToDraft(o: ManagedOffer): OfferDraft {
  return {
    title: o.title,
    description: o.description ?? "",
    imageUrl: o.imageUrl ?? "",
    rewardText: o.rewardText,
    offerMonth: o.offerMonth,
    rewardTiers: o.rewardTiers ?? [],
    registrationCap: o.registrationCap,
    validFrom: toLocalDateTimeValue(new Date(o.validFrom)),
    validUntil: toLocalDateTimeValue(new Date(o.validUntil)),
    tourPriceLkr: o.tourPriceLkr,
    discountedLkr: o.discountedLkr ?? "",
    isFreeTour: isFreeOffer(o.discountedLkr),
    isActive: o.isActive,
  };
}

function resolveDiscountedLkr(draft: OfferDraft): number | undefined | null {
  if (draft.isFreeTour) return 0;
  if (draft.discountedLkr === "") return undefined;
  return Number(draft.discountedLkr);
}

export function OffersDashboard({
  module,
  shellClassName,
  title,
  subtitle,
  descriptionPlaceholder,
  listPath,
  registrationsPath,
  updatePath,
  deletePath,
  backLink,
}: OffersDashboardProps) {
  const { token } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [offers, setOffers] = useState<ManagedOffer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<OfferDraft>(() => emptyDraft());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [registrations, setRegistrations] = useState<OfferRegistration[] | null>(null);
  const [regsMsg, setRegsMsg] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const selected = useMemo(
    () => (selectedId ? offers.find((o) => o.id === selectedId) ?? null : null),
    [offers, selectedId]
  );

  async function refresh() {
    if (!token) return;
    const o = await api<ManagedOffer[]>(listPath, { token });
    setOffers(o);
  }

  useEffect(() => {
    if (!token) return;
    refresh().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, listPath]);

  useEffect(() => {
    if (!selected) {
      setDraft(emptyDraft());
      setRegistrations(null);
      setRegsMsg("");
      return;
    }
    setDraft(offerToDraft(selected));
    setFieldErrors({});
    setRegistrations(null);
    setRegsMsg("");
  }, [selected]);

  function resetNew() {
    setSelectedId(null);
    setMsg("");
    setFieldErrors({});
    setDraft(emptyDraft());
  }

  function offerDraftSummary(mode: "create" | "update") {
    return [
      { label: "Action", value: mode === "create" ? "Create offer" : "Update offer" },
      { label: "Title", value: draft.title.trim() || "(untitled)" },
      { label: "Reward", value: draft.rewardText.trim() || "—" },
      { label: "Cap", value: String(draft.registrationCap) },
      {
        label: "Valid",
        value: `${new Date(draft.validFrom).toLocaleDateString()} – ${new Date(draft.validUntil).toLocaleDateString()}`,
      },
      {
        label: "Price",
        value: draft.isFreeTour
          ? "Free tour"
          : `LKR ${Number(draft.tourPriceLkr).toLocaleString()}${
              draft.discountedLkr !== "" ? ` → ${Number(draft.discountedLkr).toLocaleString()}` : ""
            }`,
      },
      { label: "Tour choice", value: "Traveler picks at registration" },
      { label: "Status", value: draft.isActive ? "Active" : "Inactive" },
    ];
  }

  function submitCreate() {
    if (!token) return;
    const errors = validateOfferDraft(draft);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    requestConfirm({
      title: "Create offer?",
      description: "Review the offer details before publishing to travelers.",
      confirmLabel: "Create offer",
      summary: offerDraftSummary("create"),
      onConfirm: async () => {
        setBusy(true);
        setMsg("");
        try {
          await api(listPath, {
            method: "POST",
            token,
            body: JSON.stringify({
              title: draft.title,
              description: draft.description || undefined,
              imageUrl: draft.imageUrl.trim() || "",
              rewardText: draft.rewardText,
              offerMonth: draft.offerMonth,
              rewardTiers: draft.rewardTiers,
              registrationCap: Number(draft.registrationCap),
              validFrom: new Date(draft.validFrom).toISOString(),
              validUntil: new Date(draft.validUntil).toISOString(),
              tourPriceLkr: Number(draft.tourPriceLkr),
              discountedLkr: resolveDiscountedLkr(draft),
              tourIds: [],
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
      },
    });
  }

  function submitUpdate() {
    if (!token || !selectedId) return;
    const errors = validateOfferDraft(draft);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    requestConfirm({
      title: "Save offer changes?",
      description: "Existing registrations keep their spot; terms apply to new sign-ups.",
      confirmLabel: "Save changes",
      summary: offerDraftSummary("update"),
      onConfirm: async () => {
        setBusy(true);
        setMsg("");
        try {
          await api(updatePath(selectedId), {
            method: "PATCH",
            token,
            body: JSON.stringify({
              title: draft.title,
              description: draft.description === "" ? null : draft.description,
              imageUrl: draft.imageUrl.trim() || null,
              rewardText: draft.rewardText,
              offerMonth: draft.offerMonth,
              rewardTiers: draft.rewardTiers,
              registrationCap: Number(draft.registrationCap),
              validFrom: new Date(draft.validFrom).toISOString(),
              validUntil: new Date(draft.validUntil).toISOString(),
              tourPriceLkr: Number(draft.tourPriceLkr),
              discountedLkr: draft.isFreeTour ? 0 : draft.discountedLkr === "" ? null : Number(draft.discountedLkr),
              isActive: draft.isActive,
              tourIds: [],
            }),
          });
          setMsg("Offer updated.");
          await refresh();
        } catch (e) {
          setMsg(e instanceof ApiError ? e.message : "Update failed");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  async function loadRegistrations() {
    if (!token || !selectedId) return;
    setRegsMsg("");
    try {
      const regs = await api<OfferRegistration[]>(registrationsPath(selectedId), { token });
      setRegistrations(regs);
    } catch (e) {
      setRegsMsg(e instanceof ApiError ? e.message : "Failed to load registrations");
      setRegistrations(null);
    }
  }

  function deleteSelected() {
    if (!token || !selectedId) return;
    const offerTitle = selected?.title ?? "this offer";
    requestConfirm({
      title: "Delete offer?",
      description: "This cannot be undone. All registrations will be removed.",
      variant: "danger",
      confirmLabel: "Delete offer",
      summary: [
        { label: "Offer", value: offerTitle },
        { label: "Registrations", value: String(selected?.registeredCount ?? 0), tone: "warning" },
      ],
      onConfirm: async () => {
        setBusy(true);
        setMsg("");
        try {
          await api(deletePath(selectedId), { method: "DELETE", token });
          setMsg("Offer deleted.");
          setSelectedId(null);
          setRegistrations(null);
          await refresh();
        } catch (e) {
          setMsg(e instanceof ApiError ? e.message : "Delete failed");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  return (
    <div className={shellClassName}>
      <ModuleHeader module={module} title={title} subtitle={subtitle}>
        <button type="button" className="btn btn-teal" onClick={resetNew} disabled={busy}>
          New offer
        </button>
        {backLink && (
          <Link to={backLink.to} className="btn btn-ghost">
            {backLink.label}
          </Link>
        )}
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
                        {o.isActive ? "Active" : "Inactive"}
                        {formatOfferMonthLabel(o.offerMonth)
                          ? ` · ${formatOfferMonthLabel(o.offerMonth)}`
                          : ""}
                        {isFreeOffer(o.discountedLkr) ? " · Free tour" : ""} · {o.registeredCount}{" "}
                        registered
                        {(o.rewardTiers?.length ?? 0) > 0
                          ? ` · ${o.rewardTiers!.length} reward tier${o.rewardTiers!.length === 1 ? "" : "s"}`
                          : ""}
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
                <div className="gov-panel-head-actions">
                  {draft.isActive && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={async () => {
                        const result = await shareOffer({
                          id: selectedId,
                          title: draft.title || "TourPilot offer",
                          description: draft.description,
                          rewardText: draft.rewardText,
                        });
                        const fb = offerShareFeedback(result);
                        setShareMsg(fb);
                        if (fb) setTimeout(() => setShareMsg(""), 2500);
                      }}
                    >
                      Share offer
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy || !draft.isActive}
                    title={draft.isActive ? offerShareUrl(selectedId) : "Activate offer to get a public link"}
                    onClick={async () => {
                      if (!draft.isActive) return;
                      try {
                        await navigator.clipboard.writeText(offerShareUrl(selectedId));
                        setShareMsg("Public link copied.");
                        setTimeout(() => setShareMsg(""), 2500);
                      } catch {
                        setShareMsg("Could not copy link.");
                      }
                    }}
                  >
                    Copy link
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={deleteSelected} disabled={busy}>
                    Delete
                  </button>
                </div>
              )}
            </div>
            {shareMsg && <p className="muted gov-share-hint">{shareMsg}</p>}
            <FormValidationMessages errors={fieldErrors} />

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
                <span>Headline / summary</span>
                <input
                  value={draft.rewardText}
                  onChange={(e) => setDraft((d) => ({ ...d, rewardText: e.target.value }))}
                  placeholder="Unlock group rewards as more travelers join"
                />
              </label>

              <label className="field">
                <span>Dedicated month</span>
                <input
                  type="month"
                  value={draft.offerMonth ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, offerMonth: e.target.value || null }))}
                />
              </label>

              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <span>Description</span>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder={descriptionPlaceholder}
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

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <OfferRewardTiersEditor
                  tiers={draft.rewardTiers}
                  onChange={(rewardTiers) => setDraft((d) => ({ ...d, rewardTiers }))}
                  registrationCap={draft.registrationCap}
                  previewRegisteredCount={selected?.registeredCount ?? 0}
                />
              </div>

              {selectedId && (
                <label className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
                  />
                  <span>Active (shown on your display page when within dates)</span>
                </label>
              )}

              <label className="field" style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={draft.isFreeTour}
                  onChange={(e) => {
                    const isFreeTour = e.target.checked;
                    setDraft((d) => ({
                      ...d,
                      isFreeTour,
                      discountedLkr: isFreeTour ? 0 : "",
                      rewardText:
                        isFreeTour && !d.rewardText.trim()
                          ? "Free tour for registered travelers"
                          : d.rewardText,
                    }));
                  }}
                />
                <span>Free tour offer — registered travelers pay LKR 0</span>
              </label>

              <label className="field">
                <span>Regular tour price (LKR)</span>
                <input
                  type="number"
                  min={0}
                  value={draft.tourPriceLkr}
                  onChange={(e) => setDraft((d) => ({ ...d, tourPriceLkr: Number(e.target.value) }))}
                  placeholder="Shown as the original price"
                />
              </label>

              {!draft.isFreeTour && (
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
              )}

              <p className="muted" style={{ gridColumn: "1 / -1", margin: 0 }}>
                Travelers choose any published readymade tour when they register — you do not link
                packages here.
              </p>
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
                        {r.screenshotUrl && (
                          <a
                            href={r.screenshotUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gov-reg-screenshot"
                          >
                            View screenshot
                          </a>
                        )}
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
