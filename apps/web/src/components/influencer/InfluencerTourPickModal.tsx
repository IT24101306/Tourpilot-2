import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { RegisterTermsConsent } from "../auth/RegisterTermsConsent";
import { DashboardModal, ModalActions, ModalField } from "../DashboardModal";
import type { InfluencerTourDisplaySettings } from "../../lib/influencerDisplay";

export type InfluencerDisplayTourOption = {
  id: string;
  title: string;
  days: number;
  publicPriceLkr: number;
  minDisplayPriceLkr: number;
  influencerCommissionLkr: number;
  influencerCommissionPct: number;
  influencerInstructions: string | null;
  agency: { id: string; name: string; slug: string };
  commissionRequest?: {
    id: string;
    status: "PENDING" | "NEGOTIATING" | "APPROVED" | "REJECTED";
    requestedPct: number;
    currentOfferPct?: number;
    pendingActor?: "INFLUENCER" | "AGENCY";
    approvedPct: number | null;
    message: string;
    agencyNote?: string | null;
  } | null;
};

type Props = {
  open: boolean;
  tour: InfluencerDisplayTourOption | null;
  settings: InfluencerTourDisplaySettings;
  token: string | null;
  onClose: () => void;
  onConfirm: (settings: InfluencerTourDisplaySettings) => void;
  onCommissionRequestSent?: () => void;
  isEditing?: boolean;
};

export function InfluencerTourPickModal({
  open,
  tour,
  settings,
  token,
  onClose,
  onConfirm,
  onCommissionRequestSent,
  isEditing = false,
}: Props) {
  const [termsAccepted, setTermsAccepted] = useState(Boolean(settings.termsAcceptedAt));
  const [hideAgencyName, setHideAgencyName] = useState(Boolean(settings.hideAgencyName));
  const [displayPrice, setDisplayPrice] = useState(
    settings.displayPriceLkr ? String(settings.displayPriceLkr) : ""
  );
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestedPct, setRequestedPct] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestStatus, setRequestStatus] = useState("");
  const [requestSaving, setRequestSaving] = useState(false);

  useEffect(() => {
    if (!open || !tour) return;
    setTermsAccepted(Boolean(settings.termsAcceptedAt));
    setHideAgencyName(Boolean(settings.hideAgencyName));
    setDisplayPrice(settings.displayPriceLkr ? String(settings.displayPriceLkr) : "");
    setShowRequestForm(false);
    setRequestedPct("");
    setRequestMessage("");
    setRequestStatus("");
  }, [open, tour, settings]);

  if (!tour) return null;

  const minPrice = tour.minDisplayPriceLkr;
  const parsedDisplayPrice = displayPrice.trim() ? Number(displayPrice) : null;
  const displayPriceInvalid =
    parsedDisplayPrice != null &&
    (!Number.isFinite(parsedDisplayPrice) || parsedDisplayPrice < minPrice);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!termsAccepted) return;
    if (displayPriceInvalid) return;

    onConfirm({
      termsAcceptedAt: settings.termsAcceptedAt || new Date().toISOString(),
      hideAgencyName,
      ...(parsedDisplayPrice != null && parsedDisplayPrice > minPrice
        ? { displayPriceLkr: Math.round(parsedDisplayPrice) }
        : {}),
    });
  }

  async function sendCommissionRequest(e: FormEvent) {
    e.preventDefault();
    if (!token || !tour) return;
    const pct = Number(requestedPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
      setRequestStatus("Enter a commission percentage between 0 and 50.");
      return;
    }
    if (requestMessage.trim().length < 10) {
      setRequestStatus("Please explain why you are requesting a different rate (at least 10 characters).");
      return;
    }

    setRequestSaving(true);
    setRequestStatus("");
    try {
      await api("/influencer/commission-requests", {
        method: "POST",
        token,
        body: JSON.stringify({
          tourId: tour.id,
          requestedPct: pct,
          message: requestMessage.trim(),
        }),
      });
      setRequestStatus("Request sent to the agency. You will be notified when they respond.");
      setShowRequestForm(false);
      onCommissionRequestSent?.();
    } catch (err) {
      setRequestStatus(err instanceof ApiError ? err.message : "Could not send request");
    } finally {
      setRequestSaving(false);
    }
  }

  const commissionLabel =
    tour.commissionRequest?.status === "APPROVED" && tour.commissionRequest.approvedPct != null
      ? `${tour.commissionRequest.approvedPct}% (custom approved)`
      : `${tour.influencerCommissionPct}%`;

  return (
    <DashboardModal
      open={open}
      title={`Feature: ${tour.title}`}
      subtitle={`${tour.agency.name} · ${tour.days} days · listed at LKR ${tour.publicPriceLkr.toLocaleString()}`}
      onClose={onClose}
      dialogClassName="influencer-tour-pick-dialog"
    >
      <form onSubmit={handleSubmit}>
        {tour.influencerInstructions ? (
          <div className="influencer-tour-pick-instructions">
            <h4>Agency instructions</h4>
            <p>{tour.influencerInstructions}</p>
          </div>
        ) : null}

        <div className="influencer-tour-pick-commission">
          <div>
            <span className="muted">Your commission</span>
            <strong>
              {commissionLabel} · LKR {tour.influencerCommissionLkr.toLocaleString()} per booking
            </strong>
          </div>
          {tour.commissionRequest?.status === "PENDING" ||
          tour.commissionRequest?.status === "NEGOTIATING" ? (
            <p className="muted">
              Commission negotiation in progress
              {tour.commissionRequest.currentOfferPct != null
                ? ` · current offer ${tour.commissionRequest.currentOfferPct}%`
                : ""}
              .{" "}
              <Link to="/dashboard/influencer/commission-requests">Open rate talks →</Link>
            </p>
          ) : tour.commissionRequest?.status === "REJECTED" ? (
            <p className="muted">
              Your last commission request was declined.
              {tour.commissionRequest.agencyNote ? ` ${tour.commissionRequest.agencyNote}` : ""}
            </p>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowRequestForm((v) => !v)}
            >
              {showRequestForm ? "Cancel request" : "Request different commission"}
            </button>
          )}
        </div>

        {showRequestForm ? (
          <div className="influencer-tour-pick-request">
            <ModalField label="Requested commission %">
              <input
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={requestedPct}
                onChange={(e) => setRequestedPct(e.target.value)}
                placeholder={`Current: ${tour.influencerCommissionPct}%`}
                required
              />
            </ModalField>
            <ModalField label="Message to agency" full>
              <textarea
                rows={4}
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Explain your audience, expected volume, or why a different rate makes sense…"
                required
              />
            </ModalField>
            <button
              type="button"
              className="btn btn-teal"
              disabled={requestSaving}
              onClick={(e) => void sendCommissionRequest(e)}
            >
              {requestSaving ? "Sending…" : "Send request to agency"}
            </button>
            {requestStatus ? <p className="partner-toast">{requestStatus}</p> : null}
          </div>
        ) : null}

        <ModalField label="Price on your page (LKR)" full>
          <input
            type="number"
            min={minPrice}
            step={100}
            value={displayPrice}
            onChange={(e) => setDisplayPrice(e.target.value)}
            placeholder={String(minPrice)}
          />
          <p className="display-field-hint muted">
            Minimum LKR {minPrice.toLocaleString()} (agency listed price). You may increase it, not
            decrease it.
          </p>
          {displayPriceInvalid ? (
            <p className="form-error">Price cannot be lower than LKR {minPrice.toLocaleString()}.</p>
          ) : null}
        </ModalField>

        <label className="influencer-tour-pick-hide-agency">
          <input
            type="checkbox"
            checked={hideAgencyName}
            onChange={(e) => setHideAgencyName(e.target.checked)}
          />
          <span>Hide agency name on my public page</span>
        </label>

        <RegisterTermsConsent
          checked={termsAccepted}
          onChange={setTermsAccepted}
          id={`influencer-tour-terms-${tour.id}`}
        />

        <ModalActions
          onCancel={onClose}
          submitLabel={isEditing ? "Save tour options" : "Add to my display page"}
          canSubmit={termsAccepted && !displayPriceInvalid}
        />
      </form>
    </DashboardModal>
  );
}
