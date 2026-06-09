import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { DashboardModal, ModalActions } from "../DashboardModal";
import { ImageUrlField } from "../ImageUrlField";
import type { DiscoveryOffer } from "./DiscoveryOfferCard";

type Props = {
  open: boolean;
  offer: DiscoveryOffer | null;
  token: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function OfferRegistrationModal({ open, offer, token, onClose, onSuccess }: Props) {
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScreenshotUrl("");
    setTermsAccepted(false);
    setError("");
    setSubmitting(false);
  }, [open, offer?.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!offer || !token) return;

    if (!screenshotUrl.trim()) {
      setError("Please upload one screenshot to complete registration.");
      return;
    }
    if (!termsAccepted) {
      setError("You must agree to the terms and conditions.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await api(`/offers/${offer.id}/register`, {
        method: "POST",
        token,
        body: JSON.stringify({
          screenshotUrl: screenshotUrl.trim(),
          termsAccepted: true,
        }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardModal
      open={open && !!offer}
      title="Register for offer"
      subtitle={offer ? offer.title : undefined}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <div className="offer-register-form">
          <p className="muted offer-register-lead">
            Upload one screenshot (payment proof, booking confirmation, or required promo capture)
            and confirm you agree to the terms.
          </p>

          <ImageUrlField
            label="Screenshot"
            value={screenshotUrl}
            onChange={setScreenshotUrl}
            token={token}
            hint="One image required — JPEG, PNG, or WebP."
            placeholder="Upload your screenshot"
          />

          <label className="offer-register-terms">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
            />
            <span>I agree to the terms and conditions</span>
          </label>

          {error && <p className="form-error">{error}</p>}
        </div>

        <ModalActions
          onCancel={onClose}
          submitLabel={submitting ? "Submitting…" : "Complete registration"}
          saving={submitting}
        />
      </form>
    </DashboardModal>
  );
}
