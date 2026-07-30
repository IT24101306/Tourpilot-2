import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
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
  /** Current user id — used to hide self from typing indicators. */
  viewerUserId?: string;
  enabled?: boolean;
  /** Fallback poll interval when socket is disconnected (ms). */
  intervalMs?: number;
  onThread?: (thread: ThreadMessage[]) => void;
};

/**
 * WhatsApp-style realtime chat via Socket.IO, with HTTP polling fallback.
 */
export function useChatLive({
  inquiryId,
  token,
  viewerUserId,
  enabled = true,
  intervalMs = 8000,
  onThread,
}: Options) {
  const [typing, setTyping] = useState<TypingUser[]>([]);
  const [live, setLive] = useState(false);
  const onThreadRef = useRef(onThread);
  onThreadRef.current = onThread;
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentTyping = useRef(false);
  const composeActive = useRef(false);
  const socketRef = useRef<Socket | null>(null);
  const viewerRef = useRef(viewerUserId);
  viewerRef.current = viewerUserId;

  const applyTyping = useCallback((list: TypingUser[]) => {
    const me = viewerRef.current;
    setTyping(me ? list.filter((t) => t.userId !== me) : list);
  }, []);

  const sync = useCallback(async () => {
    if (!enabled || !token || !inquiryId) return;
    try {
      const data = await api<ChatSync>(`/inquiries/${inquiryId}/chat`, { token });
      applyTyping(data.typing ?? []);
      onThreadRef.current?.(data.thread ?? []);
    } catch {
      /* keep last good state while offline briefly */
    }
  }, [enabled, token, inquiryId, applyTyping]);

  // Realtime socket
  useEffect(() => {
    if (!enabled || !token || !inquiryId) return;

    const socket = io({
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setLive(true);
      socket.emit("join", { inquiryId }, (ack: { ok?: boolean; typing?: TypingUser[] } | undefined) => {
        if (ack?.typing) applyTyping(ack.typing);
      });
      void sync();
    });

    socket.on("disconnect", () => {
      setLive(false);
    });

    socket.on("message", (payload: { inquiryId?: string }) => {
      if (payload?.inquiryId !== inquiryId) return;
      void sync();
      socket.emit("read", { inquiryId });
    });

    socket.on(
      "presence",
      (payload: { inquiryId?: string; typing?: TypingUser[] }) => {
        if (payload?.inquiryId !== inquiryId) return;
        applyTyping(payload.typing ?? []);
      }
    );

    socket.on("read", (payload: { inquiryId?: string }) => {
      if (payload?.inquiryId !== inquiryId) return;
      void sync();
    });

    return () => {
      socket.emit("leave", { inquiryId });
      socket.disconnect();
      socketRef.current = null;
      setLive(false);
    };
  }, [enabled, token, inquiryId, sync, applyTyping]);

  // Fallback polling only when socket is not live
  useEffect(() => {
    if (!enabled || live) return;
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
  }, [enabled, live, sync, intervalMs]);

  const postTypingHttp = useCallback(
    (isTyping: boolean) => {
      if (!enabled || !token || !inquiryId) return;
      void api(`/inquiries/${inquiryId}/typing`, {
        method: "POST",
        token,
        body: JSON.stringify({ typing: isTyping }),
      }).catch(() => undefined);
    },
    [enabled, token, inquiryId]
  );

  const postTyping = useCallback(
    (isTyping: boolean) => {
      if (!enabled || !token || !inquiryId) return;
      lastSentTyping.current = isTyping;
      const socket = socketRef.current;
      if (socket?.connected) {
        socket.emit("typing", { inquiryId, typing: isTyping });
        return;
      }
      postTypingHttp(isTyping);
    },
    [enabled, token, inquiryId, postTypingHttp]
  );

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
  }, []);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!enabled || !token || !inquiryId) return;
      if (isTyping) {
        postTyping(true);
        if (!heartbeatTimer.current) {
          heartbeatTimer.current = setInterval(() => {
            if (composeActive.current) postTyping(true);
          }, 2000);
        }
        return;
      }
      clearHeartbeat();
      if (!lastSentTyping.current) return;
      postTyping(false);
    },
    [enabled, token, inquiryId, postTyping, clearHeartbeat]
  );

  const onComposeChange = useCallback(
    (value: string) => {
      if (!enabled) return;
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (value.trim()) {
        composeActive.current = true;
        sendTyping(true);
        typingTimer.current = setTimeout(() => {
          composeActive.current = false;
          sendTyping(false);
        }, 2800);
      } else {
        composeActive.current = false;
        sendTyping(false);
      }
    },
    [enabled, sendTyping]
  );

  const stopTyping = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    composeActive.current = false;
    clearHeartbeat();
    sendTyping(false);
  }, [sendTyping, clearHeartbeat]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      clearHeartbeat();
      if (lastSentTyping.current) {
        lastSentTyping.current = false;
        const socket = socketRef.current;
        if (socket?.connected) {
          socket.emit("typing", { inquiryId, typing: false });
        } else {
          void api(`/inquiries/${inquiryId}/typing`, {
            method: "POST",
            token,
            body: JSON.stringify({ typing: false }),
          }).catch(() => undefined);
        }
      }
    };
  }, [inquiryId, token, clearHeartbeat]);

  return { typing, sync, onComposeChange, stopTyping, live };
}
