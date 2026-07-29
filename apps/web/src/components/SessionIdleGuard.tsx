import { useEffect, useRef } from "react";
import { api } from "../api/client";
import { agencyFeaturesOf, useAuth } from "../context/AuthContext";
import { useChatSession } from "../context/ChatSessionContext";

/**
 * For agencies with session inactivity enabled: when the tab sits idle past the
 * timeout, probe /auth/me so the server can return SESSION_INACTIVE and the
 * client redirects to login — even if the user never clicks again.
 *
 * While the user is in a side chat / trip room, idle checks are paused (chat
 * sync also refreshes server lastActiveAt). Confirmed exit clears that state.
 */
export function SessionIdleGuard() {
  const { user, token, logout } = useAuth();
  const { isInChat } = useChatSession();
  const lastActivityRef = useRef(Date.now());
  const isInChatRef = useRef(isInChat);
  isInChatRef.current = isInChat;

  const features = agencyFeaturesOf(user);
  const enabled =
    user?.role === "AGENCY" && Boolean(features.sessionInactivityTimeout) && Boolean(token);

  const timeoutMinutes = Math.max(1, Number(user?.agency?.sessionInactivityMinutes) || 180);

  useEffect(() => {
    if (!enabled || !token) return;

    const mark = () => {
      lastActivityRef.current = Date.now();
    };

    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
    ];
    for (const ev of events) {
      window.addEventListener(ev, mark, { passive: true });
    }

    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      // In an open chat room: treat as active (sync keeps the session warm too).
      if (isInChatRef.current) {
        lastActivityRef.current = Date.now();
        return;
      }
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs < timeoutMinutes * 60 * 1000) return;
      void api("/auth/me", { token }).catch(() => {
        logout();
      });
    }, 15_000);

    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, mark);
      }
      window.clearInterval(id);
    };
  }, [enabled, token, timeoutMinutes, logout]);

  return null;
}
