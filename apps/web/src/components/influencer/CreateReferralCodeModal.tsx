import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { DashboardModal, ModalActions, ModalField } from "../DashboardModal";

type TourOption = {
  id: string;
  title: string;
  days: number;
  basePriceLkr: number;
  agency: { name: string; slug: string };
  slug: string;
};

type Props = {
  open: boolean;
  token: string;
  tours: TourOption[];
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
  const [commissionPct, setCommissionPct] = useState(8);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdLink, setCreatedLink] = useState("");

  useEffect(() => {
    if (open) {
      setTourId(preselectedTourId || "");
      setCode("");
      setCommissionPct(8);
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
          commissionPct,
        }),
      });
      const link =
        result.shareUrl ||
        `${window.location.origin}/tours/${tours.find((t) => t.id === tourId)?.agency.slug}/${tours.find((t) => t.id === tourId)?.slug}?ref=${result.code}`;
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
      subtitle="Promote a ready-made tour. You earn commission when tourists inquire using your link."
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
              <select
                value={tourId}
                onChange={(e) => setTourId(e.target.value)}
                required
              >
                <option value="">Select tour…</option>
                {tours.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.agency.name} — {t.title} ({t.days}d · LKR {t.basePriceLkr.toLocaleString()})
                  </option>
                ))}
              </select>
            </ModalField>
            {selectedTour && (
              <p className="muted full" style={{ gridColumn: "1 / -1", margin: 0 }}>
                Tourists who use your link and book with {selectedTour.agency.name} can generate
                commission when the agency sends them an itinerary.
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
            <ModalField label="Your commission %">
              <input
                type="number"
                min={1}
                max={50}
                value={commissionPct}
                onChange={(e) => setCommissionPct(Number(e.target.value))}
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
