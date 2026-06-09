import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { DashboardModal } from "../DashboardModal";
import type { DiscoveryOffer } from "./DiscoveryOfferCard";

export type OfferRegistrant = {
  id: string;
  registeredAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
};

type Props = {
  open: boolean;
  offer: Pick<DiscoveryOffer, "id" | "title"> | null;
  onClose: () => void;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function RegistrantAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [failed, setFailed] = useState(!avatarUrl);

  if (!avatarUrl || failed) {
    return (
      <span className="offer-registrant-avatar offer-registrant-avatar--fallback" aria-hidden="true">
        {initials(name)}
      </span>
    );
  }

  return (
    <img
      className="offer-registrant-avatar"
      src={avatarUrl}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function OfferRegistrantsModal({ open, offer, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registrants, setRegistrants] = useState<OfferRegistrant[]>([]);

  useEffect(() => {
    if (!open || !offer) return;

    let cancelled = false;
    setLoading(true);
    setError("");
    setRegistrants([]);

    void api<OfferRegistrant[]>(`/offers/${offer.id}/registrations`)
      .then((rows) => {
        if (!cancelled) setRegistrants(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load registrations");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, offer?.id]);

  return (
    <DashboardModal
      open={open && !!offer}
      title="Registered travelers"
      subtitle={offer?.title}
      onClose={onClose}
      dialogClassName="offer-registrants-dialog"
    >
      {loading ? (
        <p className="muted offer-registrants-status">Loading…</p>
      ) : error ? (
        <p className="form-error offer-registrants-status">{error}</p>
      ) : registrants.length === 0 ? (
        <p className="muted offer-registrants-status">No one has registered for this offer yet.</p>
      ) : (
        <ul className="offer-registrant-list">
          {registrants.map((row) => (
            <li key={row.id} className="offer-registrant-row">
              <RegistrantAvatar name={row.user.name} avatarUrl={row.user.avatarUrl} />
              <span className="offer-registrant-name">{row.user.name}</span>
            </li>
          ))}
        </ul>
      )}
    </DashboardModal>
  );
}
