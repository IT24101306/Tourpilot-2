import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { ThreadMessage } from "../components/inquiry/InquiryThread";

export type TypingUser = {
  userId: string;
  name: string;
  role: string;
  until: string;
};

type ChatSync = {
  thread: ThreadMessage[];
  typing: TypingUser[];
  counterpartyLastReadAt: string | null;
  updatedAt: string;
};

type Options = {
  inquiryId: string;
  token: string;
  enabled?: boolean;
  /** How often to poll (ms). */
  intervalMs?: number;
  onThread?: (thread: ThreadMessage[]) => void;
};

/**
 * WhatsApp-style chat sync: quiet polling, mark-read, and typing heartbeats.
 */
export function useChatLive({
  inquiryId,
  token,
  enabled = true,
  intervalMs = 2500,
  onThread,
}: Options) {
  const [typing, setTyping] = useState<TypingUser[]>([]);
  const onThreadRef = useRef(onThread);
  onThreadRef.current = onThread;
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentTyping = useRef(false);

  const sync = useCallback(async () => {
    if (!enabled || !token || !inquiryId) return;
    try {
      const data = await api<ChatSync>(`/inquiries/${inquiryId}/chat`, { token });
      setTyping(data.typing ?? []);
      onThreadRef.current?.(data.thread ?? []);
    } catch {
      /* keep last good state while offline briefly */
    }
  }, [enabled, token, inquiryId]);

  useEffect(() => {
    if (!enabled) return;
    void sync();
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void sync();
    }, intervalMs);

    function onVis() {
      if (document.visibilityState === "visible") void sync();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, sync, intervalMs]);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!enabled || !token || !inquiryId) return;
      if (lastSentTyping.current === isTyping && isTyping) return;
      lastSentTyping.current = isTyping;
      void api(`/inquiries/${inquiryId}/typing`, {
        method: "POST",
        token,
        body: JSON.stringify({ typing: isTyping }),
      }).catch(() => undefined);
    },
    [enabled, token, inquiryId]
  );

  const onComposeChange = useCallback(
    (value: string) => {
      if (!enabled) return;
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (value.trim()) {
        sendTyping(true);
        typingTimer.current = setTimeout(() => sendTyping(false), 2800);
      } else {
        sendTyping(false);
      }
    },
    [enabled, sendTyping]
  );

  const stopTyping = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    sendTyping(false);
  }, [sendTyping]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (lastSentTyping.current) {
        lastSentTyping.current = false;
        void api(`/inquiries/${inquiryId}/typing`, {
          method: "POST",
          token,
          body: JSON.stringify({ typing: false }),
        }).catch(() => undefined);
      }
    };
  }, [inquiryId, token]);

  return { typing, sync, onComposeChange, stopTyping };
}
