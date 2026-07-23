import { FormEvent, useEffect, useState } from "react";
import {
  DEFAULT_PRICING_PAGE,
  parsePricingPageContent,
  type PricingAddonFeature,
  type PricingIncludedSection,
  type PricingPackage,
  type PricingPageContent,
} from "@tourpilot/shared";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import type { AdminCmsPage } from "./types";

function cloneDefault(): PricingPageContent {
  return structuredClone(DEFAULT_PRICING_PAGE);
}

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function blankPackage(): PricingPackage {
  return {
    id: newId("pkg"),
    name: "New package",
    tagline: "",
    price: "LKR 0",
    priceSub: "",
    ctaLabel: "Get Started",
    ctaHref: "#contact",
    features: ["Feature one"],
    categories: ["system"],
  };
}

function blankAddon(): PricingAddonFeature {
  return {
    id: newId("addon"),
    name: "New feature",
    priceLkr: 0,
    primary: false,
    defaultChecked: false,
  };
}

function blankSection(): PricingIncludedSection {
  return {
    title: "New section",
    details: ["Detail line"],
  };
}

export function AdminPricingPage() {
  const { token } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [content, setContent] = useState<PricingPageContent>(cloneDefault());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    api<AdminCmsPage[]>("/admin/cms", { token })
      .then((list) => {
        const page = list.find((p) => p.slug === "pricing");
        if (page) setContent(parsePricingPageContent(page.blocks));
        else setContent(cloneDefault());
      })
      .catch(() => setContent(cloneDefault()))
      .finally(() => setLoading(false));
  }, [token]);

  function updatePackage(index: number, patch: Partial<PricingPackage>) {
    setContent((prev) => {
      const packages = prev.packages.map((p, i) => (i === index ? { ...p, ...patch } : p));
      return { ...prev, packages };
    });
  }

  function updateAddon(index: number, patch: Partial<PricingAddonFeature>) {
    setContent((prev) => {
      const buildYourselfFeatures = prev.buildYourselfFeatures.map((f, i) =>
        i === index ? { ...f, ...patch } : f
      );
      return { ...prev, buildYourselfFeatures };
    });
  }

  function updateSection(index: number, patch: Partial<PricingIncludedSection>) {
    setContent((prev) => {
      const includedFeaturesSections = prev.includedFeaturesSections.map((s, i) =>
        i === index ? { ...s, ...patch } : s
      );
      return { ...prev, includedFeaturesSections };
    });
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    const cleaned: PricingPageContent = {
      ...content,
      packages: content.packages.map((p) => ({
        ...p,
        features: p.features.map((l) => l.trim()).filter(Boolean),
      })),
      buildYourselfFeatures: content.buildYourselfFeatures.map((f) => ({
        ...f,
        name: f.name.trim(),
      })),
      includedFeaturesSections: content.includedFeaturesSections.map((s) => ({
        ...s,
        title: s.title.trim(),
        details: s.details.map((l) => l.trim()).filter(Boolean),
      })),
    };

    requestConfirm({
      title: "Publish pricing?",
      description: "Changes go live on the home page Pricing section immediately.",
      confirmLabel: "Save pricing",
      summary: [
        { label: "Packages", value: String(cleaned.packages.length) },
        { label: "Add-ons", value: String(cleaned.buildYourselfFeatures.length) },
        { label: "Included sections", value: String(cleaned.includedFeaturesSections.length) },
      ],
      onConfirm: async () => {
        setSaving(true);
        setMsg("");
        try {
          await api<AdminCmsPage>("/admin/cms/pricing", {
            method: "PUT",
            token,
            body: JSON.stringify({
              title: "Pricing",
              blocks: [cleaned],
              isPublished: true,
            }),
          });
          setContent(cleaned);
          setMsg("Pricing saved. Refresh the home page to see updates.");
        } catch {
          setMsg("Save failed.");
        } finally {
          setSaving(false);
        }
      },
    });
  }

  if (loading) {
    return (
      <div className="module-shell module-governance">
        <ModuleHeader
          module="governance"
          title="Pricing"
          subtitle="Edit packages and add-ons shown in the home page Pricing section."
        />
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="module-shell module-governance">
      <ModuleHeader
        module="governance"
        title="Pricing"
        subtitle="Edit packages, prices, and feature lists on the home page. Add or remove plans and features here."
      />

      <form className="gov-panel" onSubmit={handleSave} style={{ display: "grid", gap: 20 }}>
        <section>
          <h3 className="gov-panel-title">Page copy</h3>
          <label htmlFor="pricing-headline">Headline</label>
          <input
            id="pricing-headline"
            value={content.headline}
            onChange={(e) => setContent({ ...content, headline: e.target.value })}
            required
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label htmlFor="pricing-pt-label">Package type label</label>
              <input
                id="pricing-pt-label"
                value={content.packageTypeLabel}
                onChange={(e) => setContent({ ...content, packageTypeLabel: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="pricing-pt-accent">Accent word</label>
              <input
                id="pricing-pt-accent"
                value={content.packageTypeAccent}
                onChange={(e) => setContent({ ...content, packageTypeAccent: e.target.value })}
              />
            </div>
          </div>
          <label htmlFor="pricing-terms-title">Terms title</label>
          <input
            id="pricing-terms-title"
            value={content.termsTitle}
            onChange={(e) => setContent({ ...content, termsTitle: e.target.value })}
          />
          <label htmlFor="pricing-terms-body">Terms body</label>
          <textarea
            id="pricing-terms-body"
            rows={3}
            value={content.termsBody}
            onChange={(e) => setContent({ ...content, termsBody: e.target.value })}
          />
        </section>

        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <h3 className="gov-panel-title" style={{ margin: 0 }}>
              Packages
            </h3>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                setContent((prev) => ({
                  ...prev,
                  packages: [...prev.packages, blankPackage()],
                }))
              }
            >
              + Add package
            </button>
          </div>
          <p className="muted">
            Feature lines = one bullet per line. Add a new line to add a feature to that plan.
          </p>
          {content.packages.map((pkg, i) => (
            <div
              key={pkg.id}
              className="gov-panel"
              style={{ marginBottom: 12, border: "1px solid var(--border, #e5e7eb)", padding: 16 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <strong>{pkg.name || `Package ${i + 1}`}</strong>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    setContent((prev) => ({
                      ...prev,
                      packages: prev.packages.filter((_, idx) => idx !== i),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
              <label>Name</label>
              <input
                value={pkg.name}
                onChange={(e) => updatePackage(i, { name: e.target.value })}
              />
              <label>Tagline</label>
              <textarea
                rows={2}
                value={pkg.tagline}
                onChange={(e) => updatePackage(i, { tagline: e.target.value })}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label>Price</label>
                  <input
                    value={pkg.price}
                    onChange={(e) => updatePackage(i, { price: e.target.value })}
                    placeholder="LKR 5,000"
                  />
                </div>
                <div>
                  <label>Price subtitle</label>
                  <input
                    value={pkg.priceSub}
                    onChange={(e) => updatePackage(i, { priceSub: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label>CTA label</label>
                  <input
                    value={pkg.ctaLabel}
                    onChange={(e) => updatePackage(i, { ctaLabel: e.target.value })}
                  />
                </div>
                <div>
                  <label>CTA link</label>
                  <input
                    value={pkg.ctaHref}
                    onChange={(e) => updatePackage(i, { ctaHref: e.target.value })}
                    placeholder="#contact"
                  />
                </div>
              </div>
              <label>Feature lines (one per line — add lines to add features)</label>
              <textarea
                rows={Math.max(5, pkg.features.length + 2)}
                value={pkg.features.join("\n")}
                onChange={(e) =>
                  updatePackage(i, {
                    features: e.target.value.split("\n").map((l) => l.trimEnd()),
                  })
                }
              />
              <label className="gov-check-row" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={Boolean(pkg.showIncludedFeatures)}
                  onChange={(e) =>
                    updatePackage(i, { showIncludedFeatures: e.target.checked })
                  }
                />
                Show “included features” button
              </label>
              {pkg.showIncludedFeatures ? (
                <>
                  <label>Included-features button label</label>
                  <input
                    value={pkg.includedFeaturesLabel || ""}
                    onChange={(e) =>
                      updatePackage(i, { includedFeaturesLabel: e.target.value })
                    }
                  />
                </>
              ) : null}
              <label className="gov-check-row" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={Boolean(pkg.buildYourself)}
                  onChange={(e) => updatePackage(i, { buildYourself: e.target.checked })}
                />
                Build Yourself picker (uses add-ons below)
              </label>
              <label className="gov-check-row">
                <input
                  type="checkbox"
                  checked={Boolean(pkg.featured)}
                  onChange={(e) => updatePackage(i, { featured: e.target.checked })}
                />
                Featured highlight
              </label>
            </div>
          ))}
        </section>

        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <h3 className="gov-panel-title" style={{ margin: 0 }}>
              Build Yourself add-ons
            </h3>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                setContent((prev) => ({
                  ...prev,
                  buildYourselfFeatures: [...prev.buildYourselfFeatures, blankAddon()],
                }))
              }
            >
              + Add feature
            </button>
          </div>
          <p className="muted">
            Selectable extras with monthly LKR price. “On card” shows on the package card; others
            appear in “more features”.
          </p>
          {content.buildYourselfFeatures.map((f, i) => (
            <div
              key={f.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 120px 90px 90px auto",
                gap: 8,
                alignItems: "end",
                marginBottom: 8,
              }}
            >
              <div>
                <label>Name</label>
                <input
                  value={f.name}
                  onChange={(e) => updateAddon(i, { name: e.target.value })}
                />
              </div>
              <div>
                <label>Price (LKR)</label>
                <input
                  type="number"
                  min={0}
                  value={f.priceLkr}
                  onChange={(e) => updateAddon(i, { priceLkr: Number(e.target.value) || 0 })}
                />
              </div>
              <label className="gov-check-row">
                <input
                  type="checkbox"
                  checked={Boolean(f.primary)}
                  onChange={(e) => updateAddon(i, { primary: e.target.checked })}
                />
                On card
              </label>
              <label className="gov-check-row">
                <input
                  type="checkbox"
                  checked={Boolean(f.defaultChecked)}
                  onChange={(e) => updateAddon(i, { defaultChecked: e.target.checked })}
                />
                Default on
              </label>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  setContent((prev) => ({
                    ...prev,
                    buildYourselfFeatures: prev.buildYourselfFeatures.filter(
                      (_, idx) => idx !== i
                    ),
                  }))
                }
              >
                Remove
              </button>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <div>
              <label>More-features modal title</label>
              <input
                value={content.moreFeaturesTitle}
                onChange={(e) => setContent({ ...content, moreFeaturesTitle: e.target.value })}
              />
            </div>
            <div>
              <label>More-features subtitle</label>
              <input
                value={content.moreFeaturesSubtitle}
                onChange={(e) =>
                  setContent({ ...content, moreFeaturesSubtitle: e.target.value })
                }
              />
            </div>
          </div>
          <label>Monthly total label</label>
          <input
            value={content.monthlyTotalLabel}
            onChange={(e) => setContent({ ...content, monthlyTotalLabel: e.target.value })}
          />
        </section>

        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <h3 className="gov-panel-title" style={{ margin: 0 }}>
              Included features modal
            </h3>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                setContent((prev) => ({
                  ...prev,
                  includedFeaturesSections: [
                    ...prev.includedFeaturesSections,
                    blankSection(),
                  ],
                }))
              }
            >
              + Add section
            </button>
          </div>
          <label>Modal title</label>
          <input
            value={content.includedFeaturesTitle}
            onChange={(e) => setContent({ ...content, includedFeaturesTitle: e.target.value })}
          />
          {content.includedFeaturesSections.map((section, i) => (
            <div
              key={section.title + i}
              style={{
                marginTop: 12,
                border: "1px solid var(--border, #e5e7eb)",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <label style={{ margin: 0 }}>Section title</label>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    setContent((prev) => ({
                      ...prev,
                      includedFeaturesSections: prev.includedFeaturesSections.filter(
                        (_, idx) => idx !== i
                      ),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
              <input
                value={section.title}
                onChange={(e) => updateSection(i, { title: e.target.value })}
              />
              <label>Detail lines (one per line)</label>
              <textarea
                rows={Math.max(3, section.details.length + 2)}
                value={section.details.join("\n")}
                onChange={(e) =>
                  updateSection(i, {
                    details: e.target.value.split("\n").map((l) => l.trimEnd()),
                  })
                }
              />
            </div>
          ))}
        </section>

        {msg && <p className="gov-status-msg">{msg}</p>}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save pricing"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setContent(cloneDefault())}
          >
            Reset to defaults
          </button>
        </div>
      </form>
    </div>
  );
}
