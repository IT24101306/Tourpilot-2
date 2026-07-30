import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { lockBodyScroll, unlockBodyScroll } from "../lib/scrollLock";

type ChatSessionContextValue = {
  activeChatId: string | null;
  isInChat: boolean;
  partnerLabel: string | null;
  enterChat: (inquiryId: string, partnerLabel?: string | null) => void;
  leaveChat: () => void;
  /** Show leave confirm; runs `afterLeave` only if the user confirms Exit chat. */
  requestLeaveChat: (afterLeave?: () => void) => void;
  /** Clear presence and run action without confirm (e.g. open full trip room). */
  leaveChatImmediate: (afterLeave?: () => void) => void;
};

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);

type ExitChatDialogProps = {
  open: boolean;
  partnerLabel?: string | null;
  onStay: () => void;
  onExit: () => void;
};

function ExitChatDialog({ open, partnerLabel, onStay, onExit }: ExitChatDialogProps) {
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onStay();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onStay]);

  if (!open) return null;

  const who = partnerLabel?.trim() || "this chat";

  return createPortal(
    <div className="chat-exit-dialog" role="presentation" onClick={onStay}>
      <div
        className="chat-exit-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-exit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="chat-exit-title">Leave chat?</h2>
        <p>
          You&apos;re still in the conversation with <strong>{who}</strong>. Exiting stops live sync
          for this room until you open it again.
        </p>
        <div className="chat-exit-dialog__actions">
          <button type="button" className="btn btn-ghost" onClick={onStay}>
            Stay in chat
          </button>
          <button type="button" className="btn btn-primary" onClick={onExit}>
            Exit chat
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Intercepts in-app link clicks (sidebar, top nav, etc.) while a chat / trip room
 * is open so the user must confirm before leaving.
 */
function ChatNavigationGuard() {
  const { isInChat, requestLeaveChat } = useChatSession();
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    if (!isInChat) return;

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      // Side chat → full trip room (still in conversation)
      if (anchor.closest("[data-chat-nav-allow]")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const next = `${url.pathname}${url.search}${url.hash}`;
      const cur = locationRef.current;
      const current = `${cur.pathname}${cur.search}${cur.hash}`;
      if (next === current) return;

      e.preventDefault();
      e.stopPropagation();
      requestLeaveChat(() => navigate(next));
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isInChat, navigate, requestLeaveChat]);

  return null;
}

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [partnerLabel, setPartnerLabel] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingLeaveRef = useRef<(() => void) | null>(null);
  const allowNavRef = useRef(false);

  const enterChat = useCallback((inquiryId: string, label?: string | null) => {
    setActiveChatId(inquiryId);
    if (label != null) setPartnerLabel(label);
  }, []);

  const leaveChat = useCallback(() => {
    setActiveChatId(null);
    setPartnerLabel(null);
  }, []);

  const requestLeaveChat = useCallback(
    (afterLeave?: () => void) => {
      if (allowNavRef.current || !activeChatId) {
        afterLeave?.();
        return;
      }
      pendingLeaveRef.current = afterLeave ?? null;
      setConfirmOpen(true);
    },
    [activeChatId]
  );

  const leaveChatImmediate = useCallback(
    (afterLeave?: () => void) => {
      setConfirmOpen(false);
      pendingLeaveRef.current = null;
      allowNavRef.current = true;
      leaveChat();
      afterLeave?.();
      window.setTimeout(() => {
        allowNavRef.current = false;
      }, 0);
    },
    [leaveChat]
  );

  const stayInChat = useCallback(() => {
    setConfirmOpen(false);
    pendingLeaveRef.current = null;
  }, []);

  const confirmExit = useCallback(() => {
    const next = pendingLeaveRef.current;
    pendingLeaveRef.current = null;
    setConfirmOpen(false);
    allowNavRef.current = true;
    leaveChat();
    next?.();
    window.setTimeout(() => {
      allowNavRef.current = false;
    }, 0);
  }, [leaveChat]);

  const value = useMemo<ChatSessionContextValue>(
    () => ({
      activeChatId,
      isInChat: Boolean(activeChatId),
      partnerLabel,
      enterChat,
      leaveChat,
      requestLeaveChat,
      leaveChatImmediate,
    }),
    [activeChatId, partnerLabel, enterChat, leaveChat, requestLeaveChat, leaveChatImmediate]
  );

  return (
    <ChatSessionContext.Provider value={value}>
      <ChatNavigationGuard />
      {children}
      <ExitChatDialog
        open={confirmOpen}
        partnerLabel={partnerLabel}
        onStay={stayInChat}
        onExit={confirmExit}
      />
    </ChatSessionContext.Provider>
  );
}

export function useChatSession() {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) {
    throw new Error("useChatSession must be used within ChatSessionProvider");
  }
  return ctx;
}

type ChatExitGuardOptions = {
  active: boolean;
  inquiryId: string | null | undefined;
  partnerLabel?: string | null;
  onLeave: () => void;
  /** Optional ref so parents (e.g. drawer backdrop) can trigger the same confirm flow. */
  exitHandlerRef?: MutableRefObject<(() => void) | null>;
};

/**
 * Registers chat presence while `active`, and wires close/back to the global leave confirm.
 */
export function useChatExitGuard(opts: ChatExitGuardOptions) {
  const { enterChat, leaveChat, requestLeaveChat, leaveChatImmediate } = useChatSession();
  const onLeaveRef = useRef(opts.onLeave);
  onLeaveRef.current = opts.onLeave;

  const { active, inquiryId, partnerLabel, exitHandlerRef } = opts;

  useEffect(() => {
    if (active && inquiryId) {
      enterChat(inquiryId, partnerLabel);
    }
  }, [active, inquiryId, partnerLabel, enterChat]);

  useEffect(() => {
    if (!active || !inquiryId) {
      leaveChat();
      return undefined;
    }
    return () => leaveChat();
  }, [active, inquiryId, leaveChat]);

  const requestExit = useCallback(() => {
    if (!active) {
      onLeaveRef.current();
      return;
    }
    requestLeaveChat(() => onLeaveRef.current());
  }, [active, requestLeaveChat]);

  const leaveWithoutConfirm = useCallback(() => {
    leaveChatImmediate(() => onLeaveRef.current());
  }, [leaveChatImmediate]);

  useEffect(() => {
    if (!exitHandlerRef) return;
    exitHandlerRef.current = requestExit;
    return () => {
      exitHandlerRef.current = null;
    };
  }, [exitHandlerRef, requestExit]);

  return { requestExit, leaveWithoutConfirm };
}
