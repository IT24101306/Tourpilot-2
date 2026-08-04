import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { MarketingTopNav } from "../components/MarketingTopNav";

type TermsSection = {
  type?: string;
  heading?: string;
  body?: string;
  items?: Array<{ slug: string; title: string; summary?: string }>;
};

type CmsPage = {
  slug?: string;
  title: string;
  blocks: TermsSection[] | unknown;
  updatedAt?: string;
};

const LEGAL_SLUGS = [
  "privacy-policy",
  "business-terms",
  "tour-agent-agreement",
  "third-party-provider",
  "cancellation-refund",
] as const;

const FALLBACK_HUB: TermsSection[] = [
  {
    type: "section",
    heading: "Legal center",
    body: "These documents govern use of Sri Lanka Tour Pilot (TourPilot). Admins can update them from CMS.",
  },
  {
    type: "toc",
    heading: "Documents",
    items: [
      {
        slug: "privacy-policy",
        title: "Privacy Policy",
        summary: "How we collect, use, store, and protect personal information.",
      },
      {
        slug: "business-terms",
        title: "Business Terms & Conditions",
        summary: "Terms for registered business partners on the platform.",
      },
      {
        slug: "tour-agent-agreement",
        title: "Tour Agent Agreement",
        summary: "Agreement between Sri Lanka Tour Pilot and registered tour agents.",
      },
      {
        slug: "third-party-provider",
        title: "Third-Party Travel Service Provider Agreement",
        summary: "Terms for hotels, transport, activities, and other suppliers.",
      },
      {
        slug: "cancellation-refund",
        title: "Cancellation & Refund Policy",
        summary: "Standard cancellation, refund, no-show, and modification rules.",
      },
    ],
  },
];

function asSections(raw: unknown): TermsSection[] {
  if (!Array.isArray(raw)) return [];
  return (raw as TermsSection[]).filter(
    (b) => b.heading || b.body || (b.type === "toc" && Array.isArray(b.items))
  );
}

function tocFromBlocks(blocks: TermsSection[]) {
  const toc = blocks.find((b) => b.type === "toc" && Array.isArray(b.items));
  return toc?.items ?? [];
}

export function TermsPage() {
  const { docSlug } = useParams<{ docSlug?: string }>();
  const activeSlug = docSlug?.trim() || "terms";

  const [title, setTitle] = useState("Terms & Conditions");
  const [sections, setSections] = useState<TermsSection[]>(FALLBACK_HUB);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [navItems, setNavItems] = useState(FALLBACK_HUB.find((b) => b.type === "toc")?.items ?? []);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    api<CmsPage>(`/cms/${activeSlug}`)
      .then((page) => {
        if (cancelled) return;
        const next = asSections(page.blocks);
        if (next.length > 0) {
          setTitle(page.title || "Terms & Conditions");
          setSections(next);
          setUpdatedAt(page.updatedAt ?? null);
          if (activeSlug === "terms") {
            const items = tocFromBlocks(next);
            if (items.length) setNavItems(items);
          }
        } else if (activeSlug !== "terms") {
          setError("This document is not published yet.");
          setSections([]);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (activeSlug === "terms") {
          setTitle("Terms & Conditions");
          setSections(FALLBACK_HUB);
          setUpdatedAt(null);
        } else {
          setError("This document is not published yet.");
          setSections([]);
          setTitle("Legal document");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeSlug]);

  // Prefetch hub TOC when viewing a child doc so the sidebar stays populated
  useEffect(() => {
    if (activeSlug === "terms") return;
    api<CmsPage>("/cms/terms")
      .then((page) => {
        const items = tocFromBlocks(asSections(page.blocks));
        if (items.length) setNavItems(items);
      })
      .catch(() => undefined);
  }, [activeSlug]);

  const isHub = activeSlug === "terms";
  const sidebar = useMemo(() => {
    if (navItems.length) return navItems;
    return LEGAL_SLUGS.map((slug) => ({
      slug,
      title: slug.replace(/-/g, " "),
    }));
  }, [navItems]);

  return (
    <div className="legal-page">
      <MarketingTopNav />
      <header className="legal-page__hero">
        <div className="legal-page__hero-inner">
          <p className="legal-page__eyebrow">TourPilot</p>
          <h1 className="legal-page__title">{title}</h1>
          <p className="legal-page__updated">
            {updatedAt
              ? `Last updated: ${new Date(updatedAt).toLocaleDateString()}`
              : "Legal documents"}
          </p>
        </div>
      </header>

      <main className="legal-page__main">
        <div className="legal-page__inner legal-page__inner--split">
          <p className="legal-page__back">
            {!isHub ? (
              <>
                <Link to="/terms">← All legal documents</Link>
                {" · "}
              </>
            ) : null}
            <Link to="/register">Sign up</Link>
            {" · "}
            <Link to="/">Home</Link>
          </p>

          <div className="legal-page__layout">
            <aside className="legal-page__nav" aria-label="Legal documents">
              <p className="legal-page__nav-title">Documents</p>
              <ul>
                <li>
                  <Link to="/terms" className={isHub ? "is-active" : undefined}>
                    Overview
                  </Link>
                </li>
                {sidebar.map((item) => (
                  <li key={item.slug}>
                    <Link
                      to={`/terms/${item.slug}`}
                      className={activeSlug === item.slug ? "is-active" : undefined}
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>

            <div className="legal-page__body">
              {error ? <p className="form-error">{error}</p> : null}

              {sections.map((section, i) => {
                if (section.type === "toc" && section.items?.length) {
                  return (
                    <article key={`toc-${i}`} className="legal-page__section legal-page__toc">
                      {section.heading ? <h2>{section.heading}</h2> : null}
                      <ul className="legal-page__toc-list">
                        {section.items.map((item) => (
                          <li key={item.slug}>
                            <Link to={`/terms/${item.slug}`}>
                              <strong>{item.title}</strong>
                              {item.summary ? <span>{item.summary}</span> : null}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </article>
                  );
                }

                return (
                  <article key={`${section.heading}-${i}`} className="legal-page__section">
                    {section.heading ? <h2>{section.heading}</h2> : null}
                    {section.body ? (
                      <div className="legal-page__prose">{section.body}</div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
