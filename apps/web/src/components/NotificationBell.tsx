import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  inquiryId: string | null;
  readAt: string | null;
  createdAt: string;
};

function notificationLink(n: NotificationRow, role: string | undefined) {
  if (!n.inquiryId) return null;
  if (role === "AGENCY") return `/dashboard/agency/trip-room/${n.inquiryId}`;
  if (role === "TOURIST") return `/trips/${n.inquiryId}`;
  if (role === "ADMIN") return `/dashboard/admin/inquiries/${n.inquiryId}/trip-room`;
  return null;
}

export function NotificationBell() {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);

  const refresh = useCallback(async () => {
    if (!token) return;
    const [list, badge] = await Promise.all([
      api<NotificationRow[]>("/notifications/mine?unread=true", { token }),
      api<{ count: number }>("/notifications/mine/unread-count", { token }),
    ]);
    setItems(list.slice(0, 8));
    setCount(badge.count);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refresh().catch(console.error);
    const t = setInterval(() => refresh().catch(console.error), 60_000);
    return () => clearInterval(t);
  }, [token, refresh]);

  if (!token || !user) return null;

  async function markRead(id: string) {
    if (!token) return;
    await api(`/notifications/${id}/read`, { method: "PATCH", token });
    await refresh();
  }

  async function markAllRead() {
    if (!token) return;
    await api("/notifications/read-all", { method: "POST", token });
    await refresh();
  }

  return (
    <div className="notify-bell-wrap">
      <button
        type="button"
        className="agency-icon-btn"
        aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="notify-bell-badge" aria-hidden="true">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="notify-bell-panel">
          <div className="notify-bell-head">
            <strong>Notifications</strong>
            {count > 0 && (
              <button type="button" className="mini-btn" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="muted notify-bell-empty">You&apos;re all caught up.</p>
          ) : (
            <ul className="notify-bell-list">
              {items.map((n) => {
                const href = notificationLink(n, user.role);
                return (
                  <li key={n.id}>
                    {href ? (
                      <Link
                        to={href}
                        className="notify-bell-item"
                        onClick={() => {
                          void markRead(n.id);
                          setOpen(false);
                        }}
                      >
                        <strong>{n.title}</strong>
                        <span>{n.body}</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="notify-bell-item"
                        onClick={() => markRead(n.id)}
                      >
                        <strong>{n.title}</strong>
                        <span>{n.body}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
