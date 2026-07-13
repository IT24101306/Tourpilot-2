import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import { lockBodyScroll, unlockBodyScroll } from "../../lib/scrollLock";
import { TripRoomView } from "../negotiation/TripRoomView";

type Props = {
  open: boolean;
  inquiryId: string | null;
  onClose: () => void;
};

/** Full trip room (chat + proposals) as an in-page drawer for tourists. */
export function TouristTripRoomDrawer({ open, inquiryId, onClose }: Props) {
  const { token } = useAuth();

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !inquiryId || !token) return null;

  return createPortal(
    <div className="tourist-trip-drawer" role="presentation" onClick={onClose}>
      <div
        className="tourist-trip-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Trip room"
        onClick={(e) => e.stopPropagation()}
      >
        <TripRoomView
          inquiryId={inquiryId}
          token={token}
          role="TOURIST"
          backTo="/trips"
          backLabel="My travel"
          embedded
          onClose={onClose}
        />
      </div>
    </div>,
    document.body
  );
}
