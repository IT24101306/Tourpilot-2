import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import type { AdminTour } from "./types";

export function AdminToursPage() {
  const { token } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [rows, setRows] = useState<AdminTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<AdminTour[]>("/admin/tours", { token })
      .then(setRows)
      .finally(() => setLoading(false));
  }, [token]);

  function togglePublish(t: AdminTour) {
    if (!token) return;
    const nextPublished = !t.isPublished;
    requestConfirm({
      title: nextPublished ? "Publish tour?" : "Unpublish tour?",
      confirmLabel: nextPublished ? "Publish" : "Unpublish",
      summary: [
        { label: "Tour", value: t.title },
        { label: "Agency", value: t.agency.name },
        { label: "Current status", value: t.isPublished ? "Published" : "Draft" },
        { label: "New status", value: nextPublished ? "Published" : "Draft" },
      ],
      onConfirm: async () => {
        setWorkingId(t.id);
        try {
          await api(`/admin/tours/${t.id}`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ isPublished: nextPublished }),
          });
          setRows((prev) =>
            prev.map((row) => (row.id === t.id ? { ...row, isPublished: nextPublished } : row))
          );
        } finally {
          setWorkingId(null);
        }
      },
    });
  }

  return (
    <div className="module-shell module-governance">
      <ModuleHeader module="governance" title="Tours" subtitle="Catalog across all agencies." />

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="gov-table-wrap">
          <table className="agency-table gov-table">
            <thead>
              <tr>
                <th>Tour</th>
                <th>Agency</th>
                <th>Price</th>
                <th>Published</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.title}</strong>
                    <br />
                    <span className="muted">
                      {t.days} days · {t.slug}
                    </span>
                  </td>
                  <td>
                    {t.agency.name}
                    <br />
                    <span className={`gov-status-badge gov-status-badge--${t.agency.status.toLowerCase()}`}>
                      {t.agency.status}
                    </span>
                  </td>
                  <td>LKR {t.basePriceLkr.toLocaleString()}</td>
                  <td>{t.isPublished ? "Yes" : "No"}</td>
                  <td className="gov-table-actions">
                    <Link
                      to={`/tours/${t.agency.slug}/${t.slug}`}
                      className="btn btn-ghost btn-nav"
                      target="_blank"
                    >
                      Preview
                    </Link>
                    <button
                      type="button"
                      className="btn btn-primary btn-nav"
                      disabled={workingId === t.id}
                      onClick={() => togglePublish(t)}
                    >
                      {t.isPublished ? "Unpublish" : "Publish"}
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
