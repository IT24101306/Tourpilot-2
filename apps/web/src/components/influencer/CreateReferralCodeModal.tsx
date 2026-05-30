import { FormEvent, useEffect, useState } from "react";
import { tourPublicPriceLkr } from "@tourpilot/shared";
import { api, ApiError } from "../../api/client";
import type { InfluencerTour } from "../../pages/influencer/types";
import { DashboardModal, ModalActions, ModalField } from "../DashboardModal";

type Props = {
  open: boolean;
  token: string;
  tours: InfluencerTour[];
  preselectedTourId?: string;
  onClose: () => void;
  onCreated: () => void;
};

export function CreateReferralCodeModal({
  open,
  token,
  tours,
  preselectedTourId,
  onClose,
  onCreated,
}: Props) {
  const [tourId, setTourId] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdLink, setCreatedLink] = useState("");

  useEffect(() => {
    if (open) {
      setTourId(preselectedTourId || "");
      setCode("");
      setError("");
      setCreatedLink("");
    }
  }, [open, preselectedTourId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!tourId) {
      setError("Select a ready-made tour to promote.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result = await api<{ code: string; shareUrl?: string }>("/influencer/codes", {
        method: "POST",
        token,
        body: JSON.stringify({
          tourId,
          code: code.trim() || undefined,
        }),
      });
      const tour = tours.find((t) => t.id === tourId);
      const link =
        result.shareUrl ||
        `${window.location.origin}/tours/${tour?.agency.slug}/${tour?.slug}?ref=${result.code}`;
      setCreatedLink(link);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create referral code");
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!createdLink) return;
    await navigator.clipboard.writeText(createdLink);
  }

  const selectedTour = tours.find((t) => t.id === tourId);

  return (
    <DashboardModal
      open={open}
      title="Create referral code"
      subtitle="Promote a ready-made tour. You earn the commission set by the agency when tourists book through your link."
      onClose={onClose}
      dialogClassName="influencer-code-dialog"
    >
      {createdLink ? (
        <div>
          <p className="display-inquiry-hint" style={{ marginBottom: 12 }}>
            Referral code created. Share this link with your audience:
          </p>
          <div className="partner-share-box">
            <code>{createdLink}</code>
          </div>
          <div className="dialog-actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={copyLink}>
              Copy link
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="entity-form-grid">
            <ModalField label="Ready-made tour" full>
              <select value={tourId} onChange={(e) => setTourId(e.target.value)} required>
                <option value="">Select tour…</option>
                {tours.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.agency.name} — {t.title} ({t.days}d · LKR{" "}
                    {tourPublicPriceLkr(t).toLocaleString()} listed)
                  </option>
                ))}
              </select>
            </ModalField>
            {selectedTour && (
              <p className="muted full" style={{ gridColumn: "1 / -1", margin: 0 }}>
                Listed at LKR {selectedTour.publicPriceLkr.toLocaleString()}.
                {selectedTour.influencerCommissionLkr > 0 ? (
                  <>
                    {" "}
                    You earn{" "}
                    <strong>LKR {selectedTour.influencerCommissionLkr.toLocaleString()}</strong> per
                    qualifying booking.
                  </>
                ) : (
                  " This tour has no influencer commission configured yet."
                )}
              </p>
            )}
            <ModalField label="Custom code (optional)">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="e.g. ISLAND10"
                maxLength={20}
              />
            </ModalField>
          </div>
          {error && <p style={{ color: "#9b1c1c", fontWeight: 700 }}>{error}</p>}
          <ModalActions onCancel={onClose} submitLabel="Generate referral code" saving={saving} />
        </form>
      )}
    </DashboardModal>
  );
}
