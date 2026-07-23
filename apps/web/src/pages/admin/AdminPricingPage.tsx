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
    requestConfirm({
      title: "Publish pricing page?",
      description: "Changes go live on the public home page immediately.",
      confirmLabel: "Save pricing",
      summary: [
        { label: "Packages", value: String(content.packages.length) },
        { label: "Add-ons", value: String(content.buildYourselfFeatures.length) },
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
              blocks: [content],
              isPublished: true,
            }),
          });
          setMsg("Pricing saved. The home page Pricing section is updated.");
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
        subtitle="Edit packages and add-ons shown in the home page Pricing section."
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
          <h3 className="gov-panel-title">Packages</h3>
          {content.packages.map((pkg, i) => (
            <div
              key={pkg.id}
              className="gov-panel"
              style={{ marginBottom: 12, border: "1px solid var(--border, #e5e7eb)", padding: 16 }}
            >
              <strong>{pkg.name || `Package ${i + 1}`}</strong>
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
                  />
                </div>
              </div>
              <label>Feature lines (one per line)</label>
              <textarea
                rows={Math.max(4, pkg.features.length + 1)}
                value={pkg.features.join("\n")}
                onChange={(e) =>
                  updatePackage(i, {
                    features: e.target.value.split("\n").map((l) => l.trimEnd()),
                  })
                }
              />
              {pkg.showIncludedFeatures ? (
                <>
                  <label>Included-features button label</label>
                  <input
                    value={pkg.includedFeaturesLabel || ""}
                    onChange={(e) => updatePackage(i, { includedFeaturesLabel: e.target.value })}
                  />
                </>
              ) : null}
            </div>
          ))}
        </section>

        <section>
          <h3 className="gov-panel-title">Build Yourself add-ons</h3>
          <p className="muted">Each row is a selectable feature with its monthly LKR price.</p>
          {content.buildYourselfFeatures.map((f, i) => (
            <div
              key={f.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 120px 90px 90px",
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
                onChange={(e) => setContent({ ...content, moreFeaturesSubtitle: e.target.value })}
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
          <h3 className="gov-panel-title">Included features modal</h3>
          <label>Modal title</label>
          <input
            value={content.includedFeaturesTitle}
            onChange={(e) => setContent({ ...content, includedFeaturesTitle: e.target.value })}
          />
          {content.includedFeaturesSections.map((section, i) => (
            <div key={section.title + i} style={{ marginTop: 12 }}>
              <label>Section title</label>
              <input
                value={section.title}
                onChange={(e) => updateSection(i, { title: e.target.value })}
              />
              <label>Detail lines (one per line)</label>
              <textarea
                rows={Math.max(3, section.details.length + 1)}
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
            {saving ? "Saving…" : "Save pricing page"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setContent(cloneDefault())}
          >
            Reset to original HTML copy
          </button>
        </div>
      </form>
    </div>
  );
}
