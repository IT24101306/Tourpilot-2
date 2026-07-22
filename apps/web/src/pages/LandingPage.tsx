import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  DEFAULT_PRICING_PAGE,
  formatPricingLkr,
  parsePricingPageContent,
  type PricingPageContent,
} from "@tourpilot/shared";
import { api } from "../api/client";
import "../styles/pricing-page.css";

type CmsPage = {
  slug: string;
  title: string;
  blocks: unknown;
};

function categoryMatch(filter: string, categories: string[]): boolean {
  if (filter === "All") return true;
  if (filter === "Website") return categories.includes("website");
  if (filter === "Website + Full System") return categories.includes("system");
  return true;
}

export function LandingPage() {
  const [content, setContent] = useState<PricingPageContent>(DEFAULT_PRICING_PAGE);
  const [filter, setFilter] = useState("All");
  const [selectOpen, setSelectOpen] = useState(false);
  const [featuresModalPkg, setFeaturesModalPkg] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<CmsPage>("/cms/pricing")
      .then((page) => setContent(parsePricingPageContent(page.blocks)))
      .catch(() => setContent(DEFAULT_PRICING_PAGE));
  }, []);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const f of content.buildYourselfFeatures) {
      next[f.id] = Boolean(f.defaultChecked);
    }
    setSelected(next);
  }, [content.buildYourselfFeatures]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!selectRef.current?.contains(e.target as Node)) setSelectOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setFeaturesModalPkg(null);
        setMoreOpen(false);
        setSelectOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = featuresModalPkg || moreOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [featuresModalPkg, moreOpen]);

  const monthlyTotal = useMemo(() => {
    return content.buildYourselfFeatures.reduce((sum, f) => {
      return selected[f.id] ? sum + (Number(f.priceLkr) || 0) : sum;
    }, 0);
  }, [content.buildYourselfFeatures, selected]);

  const monthlyLabel = formatPricingLkr(monthlyTotal);
  const primaryFeatures = content.buildYourselfFeatures.filter((f) => f.primary);
  const filterLabel =
    content.filterOptions.find((o) => o.value === filter)?.label ?? filter;

  function toggleFeature(id: string, checked: boolean) {
    setSelected((prev) => ({ ...prev, [id]: checked }));
  }

  function Cta({ href, label }: { href: string; label: string }) {
    if (href.startsWith("http")) {
      return (
        <a className="cta" href={href} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      );
    }
    return (
      <Link className="cta" to={href || "/register-pro"}>
        {label}
      </Link>
    );
  }

  return (
    <div className="pricing-page">
      <div className="page">
        <div className="page-header">
          <h1>{content.headline}</h1>
        </div>

        <div className="package-type">
          <label className="package-type-label" htmlFor="packageType">
            {content.packageTypeLabel} <span>{content.packageTypeAccent}</span>
          </label>
          <div
            className={`select-wrap${selectOpen ? " open" : ""}`}
            id="packageSelect"
            ref={selectRef}
          >
            <button
              type="button"
              id="packageType"
              className="custom-select"
              aria-haspopup="listbox"
              aria-expanded={selectOpen}
              onClick={() => setSelectOpen((o) => !o)}
            >
              <span className="custom-select-value">{filterLabel}</span>
              <svg
                className="select-chevron"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <ul className="custom-options" role="listbox">
              {content.filterOptions.map((opt) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={filter === opt.value}
                  className={filter === opt.value ? "selected" : undefined}
                  data-value={opt.value}
                  onClick={() => {
                    setFilter(opt.value);
                    setSelectOpen(false);
                  }}
                >
                  {opt.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="cards">
          {content.packages.map((pkg) => {
            if (!categoryMatch(filter, pkg.categories)) return null;
            return (
              <div
                key={pkg.id}
                className={`card${pkg.featured ? " featured" : ""}`}
                data-category={pkg.categories.join(",")}
              >
                <h2 className="card-name">{pkg.name}</h2>
                <p className="card-tagline">{pkg.tagline}</p>

                <div className="price-block">
                  <div className="price">{pkg.price}</div>
                  <div className="price-sub">{pkg.priceSub}</div>
                </div>

                <Cta href={pkg.ctaHref} label={pkg.ctaLabel} />

                <ul className="features">
                  {pkg.features.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>

                {pkg.buildYourself ? (
                  <>
                    <ul className="feature-picker" id="buildYourselfFeatures">
                      {primaryFeatures.map((f) => (
                        <li key={f.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={Boolean(selected[f.id])}
                              onChange={(e) => toggleFeature(f.id, e.target.checked)}
                            />
                            <span className="feat-name">{f.name}</span>
                            <span className="feat-price">{formatPricingLkr(f.priceLkr)}</span>
                          </label>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      className="toggle-btn"
                      onClick={() => setMoreOpen(true)}
                    >
                      <span className="label">View more features</span>
                    </button>

                    <div className="monthly-total">
                      <span className="monthly-total-label">{content.monthlyTotalLabel}</span>
                      <span className="monthly-total-value">{monthlyLabel}</span>
                    </div>
                  </>
                ) : null}

                {pkg.showIncludedFeatures ? (
                  <button
                    type="button"
                    className="toggle-btn"
                    onClick={() => setFeaturesModalPkg(pkg.name)}
                  >
                    <span className="label">
                      {pkg.includedFeaturesLabel || "View included features"}
                    </span>
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="terms">
          <div className="terms-title">{content.termsTitle}</div>
          <p>{content.termsBody}</p>
        </div>
      </div>

      <div
        className={`modal-overlay${featuresModalPkg ? " open" : ""}`}
        id="featuresModal"
        onClick={(e) => {
          if (e.target === e.currentTarget) setFeaturesModalPkg(null);
        }}
      >
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="featuresModalTitle">
          <div className="modal-header">
            <div>
              <h3 className="modal-title" id="featuresModalTitle">
                {content.includedFeaturesTitle}
              </h3>
              <div className="modal-subtitle">{featuresModalPkg}</div>
            </div>
            <button
              type="button"
              className="modal-close"
              aria-label="Close"
              onClick={() => setFeaturesModalPkg(null)}
            >
              ×
            </button>
          </div>
          <div className="modal-body">
            <div className="feature-pricing">
              {content.includedFeaturesSections.map((section) => (
                <details key={section.title} className="feature-row">
                  <summary>
                    <span>{section.title}</span>
                    <span>✓</span>
                  </summary>
                  <ul className="detail-list">
                    {section.details.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className={`modal-overlay${moreOpen ? " open" : ""}`}
        id="moreFeaturesModal"
        onClick={(e) => {
          if (e.target === e.currentTarget) setMoreOpen(false);
        }}
      >
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="moreFeaturesTitle">
          <div className="modal-header">
            <div>
              <h3 className="modal-title" id="moreFeaturesTitle">
                {content.moreFeaturesTitle}
              </h3>
              <div className="modal-subtitle">{content.moreFeaturesSubtitle}</div>
            </div>
            <button
              type="button"
              className="modal-close"
              aria-label="Close"
              onClick={() => setMoreOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="modal-body">
            <ul className="feature-picker" id="buildYourselfMoreFeatures">
              {content.buildYourselfFeatures.map((f) => (
                <li key={f.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(selected[f.id])}
                      onChange={(e) => toggleFeature(f.id, e.target.checked)}
                    />
                    <span className="feat-name">{f.name}</span>
                    <span className="feat-price">{formatPricingLkr(f.priceLkr)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div className="modal-footer">
            <div className="monthly-total">
              <span className="monthly-total-label">{content.monthlyTotalLabel}</span>
              <span className="monthly-total-value">{monthlyLabel}</span>
            </div>
            <button type="button" className="modal-ok" onClick={() => setMoreOpen(false)}>
              Select
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
