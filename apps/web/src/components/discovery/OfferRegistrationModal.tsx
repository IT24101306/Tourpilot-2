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
      setError("Upload your social media story screenshot to register — it is required.");
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
      title="Register for this offer"
      subtitle={
        offer
          ? `${offer.title} — share this offer on your story, then upload proof below.`
          : undefined
      }
      onClose={onClose}
      dialogClassName="offer-register-dialog"
    >
      <form onSubmit={handleSubmit}>
        <div className="offer-register-form">
          <div className="offer-register-requirement" role="note">
            <p className="offer-register-requirement__badge">Required before you can register</p>
            <h4 className="offer-register-requirement__title">Post this offer on your social story</h4>
            <ol className="offer-register-requirement__steps">
              <li>
                Share <strong>{offer?.title ?? "this offer"}</strong> on Instagram, Facebook, or
                TikTok as a <strong>story</strong> (or equivalent short-form post).
              </li>
              <li>Tag the agency or include the offer link if shown on the card.</li>
              <li>Take a <strong>screenshot of your live story</strong> showing the post.</li>
              <li>Upload that screenshot below — registration cannot be completed without it.</li>
            </ol>
          </div>

          <ImageUrlField
            label="Social media story screenshot"
            value={screenshotUrl}
            onChange={setScreenshotUrl}
            token={token}
            hint="Required — upload a clear screenshot of your story featuring this offer (JPEG, PNG, or WebP)."
            placeholder="Upload story screenshot"
            className="offer-register-upload"
          />

          <label className="offer-register-terms">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
            />
            <span>I agree to the terms and conditions for this offer</span>
          </label>

          {error && <p className="form-error">{error}</p>}
        </div>

        <ModalActions
          onCancel={onClose}
          submitLabel={submitting ? "Submitting…" : "Submit registration"}
          saving={submitting}
          canSubmit={Boolean(screenshotUrl.trim() && termsAccepted)}
        />
      </form>
    </DashboardModal>
  );
}
