/** Allowed tags for traveler-facing rich-text descriptions. */
const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "div",
  "span",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  // Produced by document.execCommand fontName / fontSize / foreColor
  "font",
]);

const VOID_TAGS = new Set(["br"]);

const ALLOWED_STYLE_PROPS = new Set([
  "color",
  "font-size",
  "font-family",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-align",
  "background-color",
]);

const BLOCKED_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "svg",
  "math",
]);

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeStyle(style: string): string {
  const parts: string[] = [];
  for (const decl of style.split(";")) {
    const idx = decl.indexOf(":");
    if (idx <= 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (!prop || !value || !ALLOWED_STYLE_PROPS.has(prop)) continue;
    if (/expression|url\s*\(|javascript|import/i.test(value)) continue;
    parts.push(`${prop}: ${value}`);
  }
  return parts.join("; ");
}

function sanitizeHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return null;
  }
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("/") ||
    lower.startsWith("#")
  ) {
    return trimmed;
  }
  return null;
}

type AttrMap = Record<string, string>;

function parseAttrs(raw: string): AttrMap {
  const attrs: AttrMap = {};
  const re = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const name = m[1].toLowerCase();
    if (name.startsWith("on")) continue;
    attrs[name] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return attrs;
}

function serializeAttrs(tag: string, attrs: AttrMap): string {
  const out: string[] = [];
  if (tag === "a") {
    const href = attrs.href ? sanitizeHref(attrs.href) : null;
    if (href) {
      out.push(`href="${escapeHtml(href)}"`);
      out.push(`target="_blank"`);
      out.push(`rel="noopener noreferrer"`);
    }
  }
  if (tag === "font") {
    if (attrs.face) out.push(`face="${escapeHtml(attrs.face.slice(0, 120))}"`);
    if (attrs.size && /^[1-7]$/.test(attrs.size.trim())) {
      out.push(`size="${attrs.size.trim()}"`);
    }
    if (attrs.color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(attrs.color.trim())) {
      out.push(`color="${attrs.color.trim()}"`);
    }
  }
  if (attrs.style) {
    const style = sanitizeStyle(attrs.style);
    if (style) out.push(`style="${escapeHtml(style)}"`);
  }
  return out.length ? ` ${out.join(" ")}` : "";
}

/**
 * Sanitize HTML for rich-text description fields.
 * Works in browser and Node (no DOM dependency).
 */
export function sanitizeRichHtml(input: string | null | undefined): string {
  if (!input) return "";
  let html = String(input)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  let result = "";
  const openStack: string[] = [];
  const tokenRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(html))) {
    if (match[3] != null) {
      result += escapeHtml(decodeEntities(match[3]));
      continue;
    }

    const tag = match[1].toLowerCase();
    const rawAttrs = match[2] || "";
    const isClose = match[0].startsWith("</");
    const selfClosing = /\/\s*>$/.test(match[0]) || VOID_TAGS.has(tag);

    if (BLOCKED_TAGS.has(tag)) {
      if (!isClose && !selfClosing) {
        // Skip until matching close tag
        const closeRe = new RegExp(`</${tag}\\b[^>]*>`, "i");
        const rest = html.slice(tokenRe.lastIndex);
        const closeMatch = closeRe.exec(rest);
        if (closeMatch) tokenRe.lastIndex += closeMatch.index + closeMatch[0].length;
      }
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) continue;

    if (isClose) {
      const idx = openStack.lastIndexOf(tag);
      if (idx >= 0) {
        while (openStack.length > idx) {
          const t = openStack.pop()!;
          result += `</${t}>`;
        }
      }
      continue;
    }

    const attrs = parseAttrs(rawAttrs);
    result += `<${tag}${serializeAttrs(tag, attrs)}${selfClosing && tag === "br" ? " /" : ""}>`;
    if (!selfClosing) openStack.push(tag);
  }

  while (openStack.length) {
    result += `</${openStack.pop()}>`;
  }

  return result.trim();
}

/** Plain text from rich HTML (for cards, share text, length checks). */
export function stripRichHtml(html: string | null | undefined): string {
  if (!html) return "";
  return decodeEntities(
    String(html)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-4])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** True when the value has no visible text. */
export function isRichTextEmpty(html: string | null | undefined): boolean {
  return stripRichHtml(html).length === 0;
}

/**
 * Normalize for storage: sanitize, or empty string / undefined when blank.
 */
export function normalizeRichHtml(
  html: string | null | undefined,
  emptyAs: "" | null | undefined = ""
): string | null | undefined {
  const cleaned = sanitizeRichHtml(html);
  if (isRichTextEmpty(cleaned)) return emptyAs;
  return cleaned;
}
