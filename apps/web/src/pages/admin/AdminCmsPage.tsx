import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import type { AdminCmsPage } from "./types";

export function AdminCmsPage() {
  const { token } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [pages, setPages] = useState<AdminCmsPage[]>([]);
  const [slug, setSlug] = useState("home");
  const [title, setTitle] = useState("");
  const [blocksJson, setBlocksJson] = useState("[]");
  const [published, setPublished] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    api<AdminCmsPage[]>("/admin/cms", { token })
      .then((list) => {
        setPages(list);
        const page = list.find((p) => p.slug === slug) ?? list[0];
        if (page) selectPage(page);
      })
      .finally(() => setLoading(false));
  }, [token]);

  function selectPage(page: AdminCmsPage) {
    setSlug(page.slug);
    setTitle(page.title);
    setPublished(page.isPublished);
    setBlocksJson(JSON.stringify(page.blocks, null, 2));
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    let blocks: unknown[];
    try {
      blocks = JSON.parse(blocksJson);
      if (!Array.isArray(blocks)) throw new Error("Blocks must be an array");
    } catch {
      setMsg("Invalid JSON in blocks.");
      return;
    }

    requestConfirm({
      title: "Save CMS page?",
      description: "Changes go live according to the published setting below.",
      confirmLabel: "Save page",
      summary: [
        { label: "Slug", value: slug },
        { label: "Title", value: title.trim() || "(untitled)" },
        { label: "Blocks", value: String(blocks.length) },
        { label: "Published", value: published ? "Yes" : "No (draft)" },
      ],
      onConfirm: async () => {
        setSaving(true);
        setMsg("");
        try {
          const saved = await api<AdminCmsPage>(`/admin/cms/${slug}`, {
            method: "PUT",
            token,
            body: JSON.stringify({ title, blocks, isPublished: published }),
          });
          setPages((prev) => {
            const i = prev.findIndex((p) => p.slug === saved.slug);
            if (i >= 0) {
              const next = [...prev];
              next[i] = saved;
              return next;
            }
            return [...prev, saved];
          });
          setMsg("Page saved.");
        } catch {
          setMsg("Save failed.");
        } finally {
          setSaving(false);
        }
      },
    });
  }

  return (
    <div className="module-shell module-governance">
      <ModuleHeader module="governance" title="CMS" subtitle="Edit landing and marketing page blocks." />

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="gov-cms-layout">
          <aside className="gov-cms-slugs">
            <p className="gov-panel-title">Pages</p>
            <ul>
              {pages.map((p) => (
                <li key={p.slug}>
                  <button
                    type="button"
                    className={`gov-cms-slug-btn${p.slug === slug ? " active" : ""}`}
                    onClick={() => selectPage(p)}
                  >
                    {p.slug}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="gov-cms-slug-btn"
                  onClick={() => {
                    const next = prompt("New page slug (e.g. about):");
                    if (!next?.trim()) return;
                    setSlug(next.trim());
                    setTitle(next.trim());
                    setBlocksJson("[]");
                    setPublished(false);
                  }}
                >
                  + New page
                </button>
              </li>
            </ul>
          </aside>

          <form className="gov-panel gov-cms-editor" onSubmit={handleSave}>
            <label htmlFor="cms-slug">Slug</label>
            <input id="cms-slug" value={slug} readOnly className="muted" />
            <label htmlFor="cms-title">Title</label>
            <input id="cms-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <label className="gov-check-row">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              Published
            </label>
            <label htmlFor="cms-blocks">Blocks (JSON array)</label>
            <p className="muted gov-cms-hint">
              <code>home</code>:{" "}
              {`[{ "type": "hero", "headline": "...", "lead": "...", "tags": ["..."], "badge": "..." }, { "type": "featured_agencies", "title": "...", "subtitle": "..." }]`}
              <br />
              <code>terms</code>: {`[{ "type": "section", "heading": "1. Title", "body": "..." }]`}
            </p>
            <textarea
              id="cms-blocks"
              className="gov-cms-json"
              rows={16}
              value={blocksJson}
              onChange={(e) => setBlocksJson(e.target.value)}
            />
            {msg && <p className="gov-status-msg">{msg}</p>}
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save page"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
