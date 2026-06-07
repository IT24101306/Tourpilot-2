import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import type { AdminReview } from "./types";

export function AdminReviewsPage() {
  const { token } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [rows, setRows] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<AdminReview[]>("/admin/reviews", { token })
      .then(setRows)
      .finally(() => setLoading(false));
  }, [token]);

  function toggleVisible(r: AdminReview) {
    if (!token) return;
    const nextVisible = !r.isVisible;
    requestConfirm({
      title: nextVisible ? "Show review?" : "Hide review?",
      confirmLabel: nextVisible ? "Show on site" : "Hide from site",
      variant: nextVisible ? "default" : "danger",
      summary: [
        { label: "Author", value: r.authorName ?? "Anonymous" },
        { label: "Agency", value: r.agency.name },
        { label: "Rating", value: `${r.rating}/5` },
        {
          label: "Preview",
          value: (r.body ?? "").length > 100 ? `${(r.body ?? "").slice(0, 100)}…` : r.body ?? "—",
        },
        { label: "New visibility", value: nextVisible ? "Visible" : "Hidden" },
      ],
      onConfirm: async () => {
        setWorkingId(r.id);
        try {
          await api(`/admin/reviews/${r.id}`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ isVisible: nextVisible }),
          });
          setRows((prev) =>
            prev.map((row) => (row.id === r.id ? { ...row, isVisible: nextVisible } : row))
          );
        } finally {
          setWorkingId(null);
        }
      },
    });
  }

  return (
    <div className="module-shell module-governance">
      <ModuleHeader module="governance" title="Reviews" subtitle="Moderate traveler feedback on agencies." />

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="gov-table-wrap">
          <table className="agency-table gov-table">
            <thead>
              <tr>
                <th>Agency</th>
                <th>Author</th>
                <th>Rating</th>
                <th>Visible</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/agencies/${r.agency.slug}`}>{r.agency.name}</Link>
                  </td>
                  <td>
                    <strong>{r.authorName}</strong>
                    {r.body && <p className="muted">{r.body}</p>}
                  </td>
                  <td>★ {r.rating}</td>
                  <td>{r.isVisible ? "Yes" : "Hidden"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-nav"
                      disabled={workingId === r.id}
                      onClick={() => toggleVisible(r)}
                    >
                      {r.isVisible ? "Hide" : "Show"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
