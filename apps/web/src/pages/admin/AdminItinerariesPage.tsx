import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";

type AdminItinerary = {
  id: string;
  title: string | null;
  shareToken: string | null;
  isSent: boolean;
  sentAt: string | null;
  createdAt: string;
  inquiry: {
    id: string;
    status: string;
    agency: { name: string; slug: string };
    tourist: { name: string };
  };
};

export function AdminItinerariesPage() {
  const { token } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [rows, setRows] = useState<AdminItinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const data = await api<AdminItinerary[]>("/admin/itineraries", { token });
    setRows(data);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  function patchShare(row: AdminItinerary, body: { revoke?: boolean; regenerate?: boolean }) {
    if (!token) return;
    const action = body.revoke ? "Revoke share link" : "Regenerate share link";
    requestConfirm({
      title: `${action}?`,
      description: body.revoke
        ? "The current public itinerary link will stop working."
        : "A new public link will be created; the old link will stop working.",
      confirmLabel: body.revoke ? "Revoke link" : "Regenerate link",
      variant: body.revoke ? "danger" : "default",
      summary: [
        { label: "Itinerary", value: row.title || "Untitled itinerary" },
        { label: "Agency", value: row.inquiry.agency.name },
        { label: "Tourist", value: row.inquiry.tourist.name },
        { label: "Inquiry status", value: row.inquiry.status },
        { label: "Action", value: action },
      ],
      onConfirm: async () => {
        setWorkingId(row.id);
        setMsg("");
        try {
          await api(`/admin/itineraries/${row.id}/share`, {
            method: "PATCH",
            token,
            body: JSON.stringify(body),
          });
          setMsg("Share link updated.");
          await load();
        } catch (e) {
          setMsg(e instanceof ApiError ? e.message : "Update failed");
        } finally {
          setWorkingId(null);
        }
      },
    });
  }

  return (
    <div className="module-shell module-governance">
      <ModuleHeader
        module="governance"
        title="Itineraries"
        subtitle="Shared proposal links sent from agency trip rooms."
      />

      {msg && <p className="gov-status-msg">{msg}</p>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="gov-table-wrap">
          <table className="agency-table gov-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Inquiry</th>
                <th>Agency / tourist</th>
                <th>Share</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const shareUrl = row.shareToken
                  ? `${window.location.origin}/itinerary/${row.shareToken}`
                  : null;
                return (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.title || "Untitled itinerary"}</strong>
                      <p className="muted gov-cell-sub">
                        {row.isSent ? "Sent" : "Draft"}
                        {row.sentAt && ` · ${new Date(row.sentAt).toLocaleDateString()}`}
                      </p>
                    </td>
                    <td>
                      <span className={`agency-status ${row.inquiry.status === "ACCEPTED" ? "ok" : "warn"}`}>
                        {row.inquiry.status}
                      </span>
                    </td>
                    <td>
                      {row.inquiry.agency.name}
                      <p className="muted gov-cell-sub">{row.inquiry.tourist.name}</p>
                    </td>
                    <td>
                      {shareUrl ? (
                        <a href={shareUrl} target="_blank" rel="noreferrer" className="mini-btn">
                          Open share
                        </a>
                      ) : (
                        <span className="muted">No link</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="mini-btn"
                        disabled={workingId === row.id}
                        onClick={() => patchShare(row, { regenerate: true })}
                      >
                        Regenerate
                      </button>
                      {row.shareToken && (
                        <button
                          type="button"
                          className="mini-btn mini-btn--danger"
                          disabled={workingId === row.id}
                          onClick={() => patchShare(row, { revoke: true })}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
