import { sanitizeRichHtml, isRichTextEmpty, stripRichHtml } from "@tourpilot/shared";

type Props = {
  html: string | null | undefined;
  className?: string;
  as?: "div" | "p" | "span";
  /** When true, render plain text only (for compact cards). */
  plain?: boolean;
};

/**
 * Safely render stored rich-text HTML (or plain legacy text).
 */
export function RichTextHtml({ html, className, as = "div", plain = false }: Props) {
  if (isRichTextEmpty(html)) return null;

  const Tag = as;

  if (plain || !html || !/[<>]/.test(html)) {
    const text = stripRichHtml(html);
    if (!text) return null;
    return <Tag className={className}>{text}</Tag>;
  }

  const safe = sanitizeRichHtml(html);
  if (isRichTextEmpty(safe)) return null;

  return (
    <Tag
      className={className ? `${className} rich-text-html` : "rich-text-html"}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
