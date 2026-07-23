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
  const canSave = Boolean(token && user?.role === "TOURIST");

  const refresh = useCallback(async () => {
    if (!canSave) {
      setKnown(true);
      return;
    }
    const { tourIds } = await api<{ tourIds: string[] }>("/saved-tours/ids", { token: token! });
    setSaved(tourIds.includes(tourId));
    setKnown(true);
  }, [canSave, token, tourId]);

  useEffect(() => {
    refresh().catch(() => setKnown(true));
  }, [refresh]);

  async function toggle() {
    if (!token || !canSave || loading) return;
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

  if (!canSave) {
    return (
      <Link
        to={loginPath(currentPath(location))}
        className={`save-tour-btn save-tour-btn--guest${className ? ` ${className}` : ""}`}
        title="Log in to add to favourites"
        aria-label="Add to favourites"
        onClick={stopNav}
      >
        <span className="save-tour-btn-icon" aria-hidden="true">
          ♡
        </span>
        {showLabel ? <span>Add to favourites</span> : null}
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
      aria-label={saved ? "Remove from favourites" : "Add to favourites"}
      title={saved ? "Remove from favourites" : "Add to favourites"}
    >
      <span className="save-tour-btn-icon" aria-hidden="true">
        {saved ? "♥" : "♡"}
      </span>
      {showLabel && <span>{saved ? "Saved" : "Add to favourites"}</span>}
    </button>
  );
}
