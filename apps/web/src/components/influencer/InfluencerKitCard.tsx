import { useMemo, useState } from "react";

type CodeLite = {
  code: string;
  shareUrl?: string;
  sharePath?: string;
  isActive?: boolean;
  tour?: { title?: string | null; agency?: { name?: string | null } | null } | null;
};

type Props = {
  displayName: string;
  codes: CodeLite[];
  onCopy: (text: string) => void;
};

function absoluteShare(code: CodeLite) {
  if (code.shareUrl) return code.shareUrl;
  if (code.sharePath) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}${code.sharePath}`;
  }
  return "";
}

/** Influencer growth kit — link + ready caption in one place. */
export function InfluencerKitCard({ displayName, codes, onCopy }: Props) {
  const active = useMemo(() => codes.filter((c) => c.isActive !== false), [codes]);
  const primary = active[0] ?? codes[0];
  const [idx, setIdx] = useState(0);
  const current = active[idx] ?? primary;
  const url = current ? absoluteShare(current) : "";

  const caption = useMemo(() => {
    if (!current) return "";
    const tour = current.tour?.title || "this trip";
    const agency = current.tour?.agency?.name;
    return `Planning Sri Lanka? I loved building ${tour}${agency ? ` with ${agency}` : ""} on TourPilot. Use my link for tailored options: ${url}`;
  }, [current, url]);

  if (!current || !url) {
    return (
      <section className="influencer-kit">
        <h3>Influencer kit</h3>
        <p className="muted">Create a referral code to unlock shareable captions and links.</p>
      </section>
    );
  }

  return (
    <section className="influencer-kit" aria-label="Influencer kit">
      <header>
        <p className="influencer-kit__eyebrow">Influencer kit</p>
        <h3>Share like a pro, {displayName.split(" ")[0]}</h3>
        <p className="muted">Pick a code, copy the caption, post — consistency beats one viral hit.</p>
      </header>

      {active.length > 1 ? (
        <label className="influencer-kit__pick">
          <span className="muted">Code</span>
          <select value={String(idx)} onChange={(e) => setIdx(Number(e.target.value))}>
            {active.map((c, i) => (
              <option key={c.code} value={i}>
                {c.code} {c.tour?.title ? `· ${c.tour.title}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="influencer-kit__block">
        <p className="muted">Link</p>
        <code>{url}</code>
        <button type="button" className="btn btn-ghost" onClick={() => onCopy(url)}>
          Copy link
        </button>
      </div>

      <div className="influencer-kit__block">
        <p className="muted">Ready caption</p>
        <textarea readOnly rows={4} value={caption} />
        <button type="button" className="btn btn-primary" onClick={() => onCopy(caption)}>
          Copy caption
        </button>
      </div>
    </section>
  );
}
