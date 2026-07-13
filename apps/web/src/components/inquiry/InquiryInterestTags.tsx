import { KeyboardEvent, useState } from "react";

const SUGGESTED_INTERESTS = [
  "Wildlife",
  "Beaches",
  "Tea country",
  "Culture",
  "Adventure",
  "Food",
  "Wellness",
  "Hiking",
  "Photography",
  "Family",
] as const;

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  id?: string;
};

function normalizeInterest(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function InquiryInterestTags({ value, onChange, disabled, id = "inquiry-interests" }: Props) {
  const [draft, setDraft] = useState("");

  function addInterest(raw: string) {
    const label = normalizeInterest(raw);
    if (!label) return;
    const exists = value.some((v) => v.toLowerCase() === label.toLowerCase());
    if (exists) {
      setDraft("");
      return;
    }
    onChange([...value, label]);
    setDraft("");
  }

  function removeInterest(label: string) {
    onChange(value.filter((v) => v !== label));
  }

  function toggleSuggested(label: string) {
    if (value.some((v) => v.toLowerCase() === label.toLowerCase())) {
      removeInterest(value.find((v) => v.toLowerCase() === label.toLowerCase())!);
    } else {
      onChange([...value, label]);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addInterest(draft.replace(/,/g, ""));
      return;
    }
    if (e.key === "Backspace" && !draft && value.length > 0) {
      removeInterest(value[value.length - 1]!);
    }
  }

  return (
    <div className="inquiry-interests">
      <div className="inquiry-interest-suggestions" role="group" aria-label="Suggested interests">
        {SUGGESTED_INTERESTS.map((label) => {
          const active = value.some((v) => v.toLowerCase() === label.toLowerCase());
          return (
            <button
              key={label}
              type="button"
              className={`inquiry-interest-suggest${active ? " is-active" : ""}`}
              aria-pressed={active}
              disabled={disabled}
              onClick={() => toggleSuggested(label)}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className={`inquiry-interest-box${disabled ? " is-disabled" : ""}`}>
        {value.map((label) => (
          <span key={label} className="inquiry-interest-tag">
            {label}
            <button
              type="button"
              className="inquiry-interest-tag__remove"
              aria-label={`Remove ${label}`}
              disabled={disabled}
              onClick={() => removeInterest(label)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          className="inquiry-interest-input"
          value={draft}
          disabled={disabled}
          placeholder={value.length ? "Add another…" : "Type an interest and press Enter"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => addInterest(draft)}
          autoComplete="off"
        />
      </div>
      <span className="inquiry-hint">Tap a suggestion or type your own — press Enter to add.</span>
    </div>
  );
}
