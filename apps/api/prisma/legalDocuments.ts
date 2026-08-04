import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type LegalSectionBlock = {
  type: "section";
  heading: string;
  body: string;
};

export type LegalDocDefinition = {
  /** CMS slug */
  slug: string;
  /** Fallback title if not detected in file */
  title: string;
  /** Filename under repo `terms/` */
  fileName: string;
  /** Short blurb for the legal hub TOC */
  summary: string;
};

/** Canonical legal documents from the project-root `terms/` folder. */
export const LEGAL_DOCUMENTS: LegalDocDefinition[] = [
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    fileName: "Privacy Policy.txt",
    summary: "How we collect, use, store, and protect personal information.",
  },
  {
    slug: "business-terms",
    title: "Business Terms & Conditions",
    fileName: "Sri Lanka Tour Pilot Business Terms.txt",
    summary: "Terms for registered business partners on the platform.",
  },
  {
    slug: "tour-agent-agreement",
    title: "Tour Agent Agreement",
    fileName: "Tour Agent Agreement.txt",
    summary: "Agreement between Sri Lanka Tour Pilot and registered tour agents.",
  },
  {
    slug: "third-party-provider",
    title: "Third-Party Travel Service Provider Agreement",
    fileName: "Third-Party Travel Service Provider.txt",
    summary: "Terms for hotels, transport, activities, and other suppliers.",
  },
  {
    slug: "cancellation-refund",
    title: "Cancellation & Refund Policy",
    fileName: "Sri Lanka Tour Pilot Cancellation &.txt",
    summary: "Standard cancellation, refund, no-show, and modification rules.",
  },
];

const HEADING_RE = /^(\d+(?:\.\d+)*\.?\s+\S.*)$/;

function repoTermsDir(): string {
  // apps/api/prisma → ../../../terms
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../terms");
}

/** Split plain-text legal docs into CMS section blocks for admin editing. */
export function parseLegalPlainText(raw: string, fallbackTitle: string): {
  title: string;
  sections: LegalSectionBlock[];
} {
  const text = raw.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trim();
  const lines = text.split("\n");

  let title = fallbackTitle;
  let i = 0;

  // Optional title line(s) before the first numbered heading
  const preamble: string[] = [];
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      if (preamble.length) break;
      i += 1;
      continue;
    }
    if (HEADING_RE.test(line)) break;
    preamble.push(line);
    i += 1;
    // First non-empty preamble line is often the document title
    if (preamble.length === 1 && line.length < 120 && !line.endsWith(".")) {
      title = line;
    }
  }

  const sections: LegalSectionBlock[] = [];

  if (preamble.length) {
    const introBody = preamble.slice(title === preamble[0] ? 1 : 0).join("\n\n").trim();
    if (introBody) {
      sections.push({
        type: "section",
        heading: "Introduction",
        body: introBody,
      });
    }
  }

  let currentHeading: string | null = null;
  let bodyLines: string[] = [];

  function flush() {
    if (!currentHeading) return;
    const body = bodyLines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    sections.push({
      type: "section",
      heading: currentHeading,
      body: body || "—",
    });
    currentHeading = null;
    bodyLines = [];
  }

  for (; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (HEADING_RE.test(trimmed)) {
      flush();
      currentHeading = trimmed;
      continue;
    }
    if (currentHeading == null) {
      // Stray content before first heading after preamble
      if (trimmed) {
        currentHeading = "General";
        bodyLines.push(rawLine);
      }
      continue;
    }
    bodyLines.push(rawLine);
  }
  flush();

  return { title, sections };
}

export function loadLegalDocumentFromDisk(def: LegalDocDefinition): {
  slug: string;
  title: string;
  blocks: LegalSectionBlock[];
  summary: string;
} {
  const filePath = path.join(repoTermsDir(), def.fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Legal terms file missing: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = parseLegalPlainText(raw, def.title);
  return {
    slug: def.slug,
    title: parsed.title || def.title,
    blocks: parsed.sections,
    summary: def.summary,
  };
}

export function loadAllLegalDocuments() {
  return LEGAL_DOCUMENTS.map(loadLegalDocumentFromDisk);
}

/** Hub page blocks for `/terms`. */
export function buildLegalHubBlocks(
  docs: Array<{ slug: string; title: string; summary: string }>
) {
  return [
    {
      type: "section",
      heading: "Legal center",
      body: "These documents govern use of Sri Lanka Tour Pilot (TourPilot). Admins can update any document from CMS. Continued use of the platform means you accept the versions published here.",
    },
    {
      type: "toc",
      heading: "Documents",
      items: docs.map((d) => ({
        slug: d.slug,
        title: d.title,
        summary: d.summary,
      })),
    },
    {
      type: "section",
      heading: "Contact",
      body: "Questions about these terms: support@srilankatourpilot.com",
    },
  ];
}
