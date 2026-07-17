import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

type CmsBlock = Record<string, unknown> & { type?: string };

type CmsPage = {
  slug: string;
  title: string;
  blocks: CmsBlock[];
  updatedAt: string;
};

const FALLBACK_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "1. Using TourPilot",
    body: "TourPilot connects travelers with licensed tour operators, influencers, and service providers in Sri Lanka. By creating an account you agree to use the platform lawfully and provide accurate information.",
  },
  {
    heading: "2. Accounts & verification",
    body: "You are responsible for activity on your account. Phone verification via OTP is required. Professional accounts may be subject to additional review before going live.",
  },
  {
    heading: "3. Bookings & payments",
    body: "Prices, itineraries, and offers are provided by agencies. TourPilot facilitates discovery and communication; payment terms between you and the agency apply unless stated otherwise on a specific offer or booking.",
  },
  {
    heading: "4. Wallet & fees",
    body: "Some account types may incur platform login or service fees debited from your in-app wallet. Top-ups and ledger entries are recorded in your profile.",
  },
  {
    heading: "5. Content & conduct",
    body: "Do not post misleading, offensive, or infringing content. Agencies warrant they have rights to photos and descriptions they upload.",
  },
  {
    heading: "6. Limitation of liability",
    body: "TourPilot is not liable for travel disruptions, third-party conduct, or force majeure. To the extent permitted by law, our liability is limited to fees paid to TourPilot in the prior twelve months.",
  },
  {
    heading: "7. Changes",
    body: "We may update these terms. Continued use after changes constitutes acceptance. Material updates will be highlighted in the app where practical.",
  },
  {
    heading: "8. Contact",
    body: "Questions: support@srilankatourpilot.com",
  },
];

function blocksToSections(blocks: CmsBlock[]): { heading: string; body: string }[] {
  const sections: { heading: string; body: string }[] = [];
  for (const block of blocks) {
    if (block.type === "section") {
      const heading = typeof block.heading === "string" ? block.heading : "";
      const body = typeof block.body === "string" ? block.body : "";
      if (heading || body) sections.push({ heading: heading || "Section", body });
    } else if (block.type === "text") {
      const body = typeof block.body === "string" ? block.body : "";
      if (body) sections.push({ heading: "", body });
    }
  }
  return sections;
}

export function TermsPage() {
  const [cms, setCms] = useState<CmsPage | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api<CmsPage>("/cms/terms")
      .then(setCms)
      .catch(() => setCms(null))
      .finally(() => setLoaded(true));
  }, []);

  const title = cms?.title?.trim() || "Terms & Conditions";
  const sections = useMemo(() => {
    if (!cms?.blocks?.length) return FALLBACK_SECTIONS;
    const fromCms = blocksToSections(cms.blocks);
    return fromCms.length > 0 ? fromCms : FALLBACK_SECTIONS;
  }, [cms]);

  const updatedLabel = cms?.updatedAt
    ? `Last updated: ${new Date(cms.updatedAt).toLocaleDateString()}`
    : "Last updated: June 2026";

  return (
    <section className="section legal-page">
      <div className="legal-page__inner">
        <p className="legal-page__back">
          <Link to="/register">← Back to sign up</Link>
        </p>
        <h1>{title}</h1>
        <p className="muted legal-page__updated">{loaded ? updatedLabel : "Loading…"}</p>

        <div className="legal-page__body">
          {sections.map((section, i) => (
            <div key={`${section.heading}-${i}`}>
              {section.heading ? <h2>{section.heading}</h2> : null}
              <p>{section.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
