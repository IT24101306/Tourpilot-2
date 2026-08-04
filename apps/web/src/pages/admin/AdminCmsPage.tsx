import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import type { AdminCmsPage } from "./types";

type SectionBlock = {
  type?: string;
  heading?: string;
  body?: string;
  items?: Array<{ slug?: string; title?: string; summary?: string }>;
  [key: string]: unknown;
};

const LEGAL_SLUGS = new Set([
  "terms",
  "privacy-policy",
  "business-terms",
  "tour-agent-agreement",
  "third-party-provider",
  "cancellation-refund",
]);

function isSectionEditorFriendly(blocks: unknown): blocks is SectionBlock[] {
  if (!Array.isArray(blocks) || blocks.length === 0) return false;
  return blocks.every((b) => {
    if (!b || typeof b !== "object") return false;
    const row = b as SectionBlock;
    if (row.type === "toc") return Array.isArray(row.items);
    return typeof row.heading === "string" || typeof row.body === "string";
  });
}

export function AdminCmsPage() {
  const { token } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [pages, setPages] = useState<AdminCmsPage[]>([]);
  const [slug, setSlug] = useState("home");
  const [title, setTitle] = useState("");
  const [blocksJson, setBlocksJson] = useState("[]");
  const [sections, setSections] = useState<SectionBlock[] | null>(null);
  const [useSectionEditor, setUseSectionEditor] = useState(false);
  const [published, setPublished] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    api<AdminCmsPage[]>("/admin/cms", { token })
      .then((list) => {
        setPages(list);
        const preferred =
          list.find((p) => p.slug === "terms") ??
          list.find((p) => p.slug === slug) ??
          list[0];
        if (preferred) selectPage(preferred);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const isLegalPage = LEGAL_SLUGS.has(slug);

  function selectPage(page: AdminCmsPage) {
    setSlug(page.slug);
    setTitle(page.title);
    setPublished(page.isPublished);
    setBlocksJson(JSON.stringify(page.blocks, null, 2));
    if (LEGAL_SLUGS.has(page.slug) && isSectionEditorFriendly(page.blocks)) {
      setSections(page.blocks as SectionBlock[]);
      setUseSectionEditor(true);
    } else {
      setSections(null);
      setUseSectionEditor(false);
    }
    setMsg("");
  }

  function syncSectionsToJson(next: SectionBlock[]) {
    setSections(next);
    setBlocksJson(JSON.stringify(next, null, 2));
  }

  function updateSection(index: number, patch: Partial<SectionBlock>) {
    if (!sections) return;
    const next = sections.map((s, i) => (i === index ? { ...s, ...patch } : s));
    syncSectionsToJson(next);
  }

  function addSection() {
    if (!sections) return;
    syncSectionsToJson([
      ...sections,
      { type: "section", heading: "New section", body: "" },
    ]);
  }

  function removeSection(index: number) {
    if (!sections) return;
    syncSectionsToJson(sections.filter((_, i) => i !== index));
  }

  function switchToJson() {
    setUseSectionEditor(false);
  }

  function switchToSections() {
    try {
      const parsed = JSON.parse(blocksJson) as unknown;
      if (!isSectionEditorFriendly(parsed)) {
        setMsg("JSON must be an array of section/toc blocks to use the section editor.");
        return;
      }
      setSections(parsed);
      setUseSectionEditor(true);
      setMsg("");
    } catch {
      setMsg("Invalid JSON — fix it before switching to the section editor.");
    }
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    let blocks: unknown[];
    try {
      if (useSectionEditor && sections) {
        blocks = sections;
      } else {
        blocks = JSON.parse(blocksJson);
      }
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
          selectPage(saved);
          setMsg("Page saved.");
        } catch {
          setMsg("Save failed.");
        } finally {
          setSaving(false);
        }
      },
    });
  }

  const pageGroups = useMemo(() => {
    const legal = pages.filter((p) => LEGAL_SLUGS.has(p.slug));
    const other = pages.filter((p) => !LEGAL_SLUGS.has(p.slug));
    return { legal, other };
  }, [pages]);

  return (
    <div className="module-shell module-governance">
      <ModuleHeader
        module="governance"
        title="CMS"
        subtitle="Edit marketing pages and legal terms (sourced from the terms folder, editable anytime)."
      />

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="gov-cms-layout">
          <aside className="gov-cms-slugs">
            {pageGroups.legal.length > 0 ? (
              <>
                <p className="gov-panel-title">Legal / terms</p>
                <ul>
                  {pageGroups.legal.map((p) => (
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
                </ul>
              </>
            ) : null}

            <p className="gov-panel-title">Pages</p>
            <ul>
              {pageGroups.other.map((p) => (
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
                    setSections(null);
                    setUseSectionEditor(false);
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

            {isLegalPage ? (
              <div className="gov-cms-editor-mode">
                <button
                  type="button"
                  className={`btn btn-ghost${useSectionEditor ? " is-active" : ""}`}
                  onClick={switchToSections}
                >
                  Section editor
                </button>
                <button
                  type="button"
                  className={`btn btn-ghost${!useSectionEditor ? " is-active" : ""}`}
                  onClick={switchToJson}
                >
                  Raw JSON
                </button>
              </div>
            ) : null}

            {useSectionEditor && sections ? (
              <div className="gov-cms-sections">
                <p className="muted gov-cms-hint">
                  Edit headings and body text for this legal document. Changes publish to{" "}
                  <code>/terms{slug === "terms" ? "" : `/${slug}`}</code>.
                </p>
                {sections.map((section, index) => (
                  <div key={index} className="gov-cms-section-card">
                    <div className="gov-cms-section-card__head">
                      <strong>
                        {section.type === "toc" ? "Table of contents" : `Section ${index + 1}`}
                      </strong>
                      {section.type !== "toc" ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => removeSection(index)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    {section.type === "toc" ? (
                      <p className="muted">
                        TOC links are managed with the legal seed. Switch to Raw JSON to edit link
                        titles/summaries if needed.
                      </p>
                    ) : (
                      <>
                        <label>Heading</label>
                        <input
                          value={section.heading ?? ""}
                          onChange={(e) => updateSection(index, { heading: e.target.value })}
                        />
                        <label>Body</label>
                        <textarea
                          rows={8}
                          value={section.body ?? ""}
                          onChange={(e) => updateSection(index, { body: e.target.value })}
                        />
                      </>
                    )}
                  </div>
                ))}
                <button type="button" className="btn btn-teal" onClick={addSection}>
                  + Add section
                </button>
              </div>
            ) : (
              <>
                <label htmlFor="cms-blocks">Blocks (JSON array)</label>
                <p className="muted gov-cms-hint">
                  <code>home</code>: hero / featured blocks · <code>terms</code> &amp; legal slugs:{" "}
                  {`[{ "type": "section", "heading": "1. Title", "body": "..." }]`}
                </p>
                <textarea
                  id="cms-blocks"
                  className="gov-cms-json"
                  rows={16}
                  value={blocksJson}
                  onChange={(e) => setBlocksJson(e.target.value)}
                />
              </>
            )}

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
