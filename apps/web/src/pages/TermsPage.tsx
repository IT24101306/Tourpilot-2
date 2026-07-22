import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client";

type TermsSection = {
  type?: string;
  heading?: string;
  body?: string;
};

type CmsPage = {
  title: string;
  blocks: TermsSection[] | unknown;
  updatedAt?: string;
};

const FALLBACK: TermsSection[] = [
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

function asSections(raw: unknown): TermsSection[] {
  if (!Array.isArray(raw)) return [];
  return (raw as TermsSection[]).filter((b) => b.heading || b.body);
}

export function TermsPage() {
  const [title, setTitle] = useState("Terms & Conditions");
  const [sections, setSections] = useState<TermsSection[]>(FALLBACK);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    api<CmsPage>("/cms/terms")
      .then((page) => {
        const next = asSections(page.blocks);
        if (next.length > 0) {
          setTitle(page.title || "Terms & Conditions");
          setSections(next);
          setUpdatedAt(page.updatedAt ?? null);
        }
      })
      .catch(() => {
        /* keep fallback */
      });
  }, []);

  return (
    <section className="section legal-page">
      <div className="legal-page__inner">
        <p className="legal-page__back">
          <Link to="/register">← Back to sign up</Link>
        </p>
        <h1>{title}</h1>
        <p className="muted legal-page__updated">
          {updatedAt
            ? `Last updated: ${new Date(updatedAt).toLocaleDateString()}`
            : "Last updated: June 2026"}
        </p>

        <div className="legal-page__body">
          {sections.map((section, i) => (
            <div key={`${section.heading}-${i}`}>
              {section.heading ? <h2>{section.heading}</h2> : null}
              {section.body ? <p>{section.body}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
