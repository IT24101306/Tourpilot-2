import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { currentPath, loginPath } from "../../utils/authRedirect";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

type Props = {
  tourId: string;
  className?: string;
  /** When true, show a short label beside the icon */
  showLabel?: boolean;
  onChange?: (saved: boolean) => void;
};

export function SaveTourButton({ tourId, className = "", showLabel = false, onChange }: Props) {
  const location = useLocation();
  const { user, token } = useAuth();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [known, setKnown] = useState(false);

  const refresh = useCallback(async () => {
    if (!token || user?.role !== "TOURIST") {
      setKnown(true);
      return;
    }
    const { tourIds } = await api<{ tourIds: string[] }>("/saved-tours/ids", { token });
    setSaved(tourIds.includes(tourId));
    setKnown(true);
  }, [token, user?.role, tourId]);

  useEffect(() => {
    refresh().catch(() => setKnown(true));
  }, [refresh]);

  if (user?.role !== "TOURIST") return null;

  async function toggle() {
    if (!token || loading) return;
    setLoading(true);
    try {
      if (saved) {
        await api(`/saved-tours/${tourId}`, { method: "DELETE", token });
        setSaved(false);
        onChange?.(false);
      } else {
        await api(`/saved-tours/${tourId}`, { method: "POST", token });
        setSaved(true);
        onChange?.(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function stopNav(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  if (!user) {
    return (
      <Link
        to={loginPath(currentPath(location))}
        className={`save-tour-btn save-tour-btn--guest ${className}`}
        title="Log in to save"
        onClick={stopNav}
      >
        {showLabel ? "Save tour" : "♡"}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`save-tour-btn${saved ? " save-tour-btn--saved" : ""}${className ? ` ${className}` : ""}`}
      onClick={(e) => {
        stopNav(e);
        void toggle();
      }}
      disabled={loading || !known}
      aria-pressed={saved}
      title={saved ? "Remove from saved tours" : "Save to wishlist"}
    >
      <span className="save-tour-btn-icon" aria-hidden="true">
        {saved ? "♥" : "♡"}
      </span>
      {showLabel && <span>{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}
