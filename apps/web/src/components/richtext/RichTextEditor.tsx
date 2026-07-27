import {
  useEffect,
  useId,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { isRichTextEmpty, sanitizeRichHtml } from "@tourpilot/shared";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  /** Approximate editor height in rows (like textarea rows). */
  rows?: number;
  /** Max plain-text characters (optional). */
  maxLength?: number;
  className?: string;
  "aria-label"?: string;
};

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
];

const FONT_SIZES = [
  { label: "Small", value: "3" },
  { label: "Normal", value: "4" },
  { label: "Large", value: "5" },
  { label: "XL", value: "6" },
];

const COLORS = [
  "#111827",
  "#374151",
  "#b91c1c",
  "#c2410c",
  "#a16207",
  "#15803d",
  "#0f766e",
  "#1d4ed8",
  "#6d28d9",
  "#be185d",
];

function exec(command: string, value?: string) {
  try {
    document.execCommand(command, false, value);
  } catch {
    /* ignore unsupported commands */
  }
}

function ToolbarButton({
  label,
  title,
  active,
  onClick,
  children,
}: {
  label: string;
  title: string;
  active?: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`rich-text-toolbar__btn${active ? " is-active" : ""}`}
      title={title}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      {children ?? label}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  id,
  disabled,
  rows = 4,
  maxLength,
  className,
  "aria-label": ariaLabel,
}: Props) {
  const autoId = useId();
  const editorId = id ?? autoId;
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);
  const minHeight = Math.max(72, rows * 24);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = value || "";
    if (next === lastEmitted.current) return;
    if (el.innerHTML === next) return;
    el.innerHTML = next;
    lastEmitted.current = next;
  }, [value]);

  function emitFromEditor() {
    const el = ref.current;
    if (!el) return;
    let html = sanitizeRichHtml(el.innerHTML);
    if (isRichTextEmpty(html)) html = "";

    if (maxLength != null) {
      const plain = el.innerText.replace(/\u00a0/g, " ").trim();
      if (plain.length > maxLength) {
        // Revert oversized paste/type by restoring previous sanitized value
        el.innerHTML = lastEmitted.current || "";
        return;
      }
    }

    if (html === lastEmitted.current) return;
    lastEmitted.current = html;
    onChange(html);
  }

  function run(command: string, commandValue?: string) {
    if (disabled) return;
    ref.current?.focus();
    exec("styleWithCSS", "true");
    exec(command, commandValue);
    emitFromEditor();
  }

  function onInput(_e: FormEvent<HTMLDivElement>) {
    emitFromEditor();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      run("bold");
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
      e.preventDefault();
      run("italic");
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "u") {
      e.preventDefault();
      run("underline");
    }
  }

  function insertLink() {
    const url = window.prompt("Link URL", "https://");
    if (!url) return;
    run("createLink", url.trim());
  }

  const empty = isRichTextEmpty(value);

  return (
    <div
      className={`rich-text-editor${disabled ? " is-disabled" : ""}${className ? ` ${className}` : ""}`}
    >
      <div className="rich-text-toolbar" role="toolbar" aria-label="Text formatting">
        <ToolbarButton label="Bold" title="Bold (Ctrl+B)" onClick={() => run("bold")}>
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton label="Italic" title="Italic (Ctrl+I)" onClick={() => run("italic")}>
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton label="Underline" title="Underline (Ctrl+U)" onClick={() => run("underline")}>
          <span className="rich-text-toolbar__u">U</span>
        </ToolbarButton>

        <span className="rich-text-toolbar__sep" aria-hidden="true" />

        <label className="rich-text-toolbar__select-wrap">
          <span className="sr-only">Font</span>
          <select
            className="rich-text-toolbar__select"
            disabled={disabled}
            defaultValue=""
            aria-label="Font family"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const v = e.target.value;
              if (v) run("fontName", v);
              e.target.selectedIndex = 0;
            }}
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="rich-text-toolbar__select-wrap">
          <span className="sr-only">Size</span>
          <select
            className="rich-text-toolbar__select"
            disabled={disabled}
            defaultValue=""
            aria-label="Font size"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const v = e.target.value;
              if (v) run("fontSize", v);
              e.target.selectedIndex = 0;
            }}
          >
            <option value="">Size</option>
            {FONT_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="rich-text-toolbar__color-wrap" title="Text color">
          <span className="sr-only">Text color</span>
          <input
            type="color"
            className="rich-text-toolbar__color"
            disabled={disabled}
            defaultValue="#111827"
            aria-label="Text color"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => run("foreColor", e.target.value)}
            list={`${editorId}-colors`}
          />
          <datalist id={`${editorId}-colors`}>
            {COLORS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <span className="rich-text-toolbar__sep" aria-hidden="true" />

        <ToolbarButton label="Bulleted list" title="Bulleted list" onClick={() => run("insertUnorderedList")}>
          •≡
        </ToolbarButton>
        <ToolbarButton label="Numbered list" title="Numbered list" onClick={() => run("insertOrderedList")}>
          1.
        </ToolbarButton>

        <ToolbarButton label="Align left" title="Align left" onClick={() => run("justifyLeft")}>
          L
        </ToolbarButton>
        <ToolbarButton label="Align center" title="Align center" onClick={() => run("justifyCenter")}>
          C
        </ToolbarButton>
        <ToolbarButton label="Align right" title="Align right" onClick={() => run("justifyRight")}>
          R
        </ToolbarButton>

        <span className="rich-text-toolbar__sep" aria-hidden="true" />

        <ToolbarButton label="Link" title="Insert link" onClick={insertLink}>
          Link
        </ToolbarButton>
        <ToolbarButton label="Clear formatting" title="Clear formatting" onClick={() => run("removeFormat")}>
          Tx
        </ToolbarButton>
        <ToolbarButton label="Undo" title="Undo" onClick={() => run("undo")}>
          ↶
        </ToolbarButton>
        <ToolbarButton label="Redo" title="Redo" onClick={() => run("redo")}>
          ↷
        </ToolbarButton>
      </div>

      <div className="rich-text-editor__surface-wrap">
        {empty && placeholder ? (
          <div className="rich-text-editor__placeholder" aria-hidden="true">
            {placeholder}
          </div>
        ) : null}
        <div
          id={editorId}
          ref={ref}
          className="rich-text-editor__surface"
          contentEditable={!disabled}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel || placeholder || "Rich text"}
          data-placeholder={placeholder}
          style={{ minHeight }}
          onInput={onInput}
          onBlur={emitFromEditor}
          onKeyDown={onKeyDown}
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
}
