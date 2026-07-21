import { newSiteGuide, type SiteGuideForm } from "./entityTypes";

type Props = {
  guides: SiteGuideForm[];
  onChange: (next: SiteGuideForm[]) => void;
};

export function SiteGuidesField({ guides, onChange }: Props) {
  function update(id: string, patch: Partial<SiteGuideForm>) {
    onChange(guides.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function add() {
    onChange([...guides, newSiteGuide()]);
  }

  function remove(id: string) {
    onChange(guides.filter((g) => g.id !== id));
  }

  return (
    <div className="field full site-guides">
      <div className="site-guides-head">
        <span className="field-label">Site guides</span>
        <span className="muted site-guides-hint">
          Optional. Add one or more; the first available guide is auto-selected for a tour.
        </span>
      </div>

      {guides.length > 0 && (
        <ul className="site-guides-list">
          {guides.map((guide, index) => (
            <li key={guide.id} className="site-guide-row">
              <div className="site-guide-fields">
                <div className="site-guide-field">
                  <label htmlFor={`guide-name-${guide.id}`}>Name</label>
                  <input
                    id={`guide-name-${guide.id}`}
                    type="text"
                    value={guide.name}
                    onChange={(e) => update(guide.id, { name: e.target.value })}
                    placeholder="Guide name"
                  />
                </div>
                <div className="site-guide-field">
                  <label htmlFor={`guide-contact-${guide.id}`}>Contact number</label>
                  <input
                    id={`guide-contact-${guide.id}`}
                    type="tel"
                    value={guide.contact}
                    onChange={(e) => update(guide.id, { contact: e.target.value })}
                    placeholder="0771234567"
                  />
                </div>
                <div className="site-guide-field site-guide-field--cost">
                  <label htmlFor={`guide-cost-${guide.id}`}>Cost (LKR)</label>
                  <input
                    id={`guide-cost-${guide.id}`}
                    type="number"
                    min={0}
                    step="any"
                    value={guide.cost}
                    onChange={(e) => update(guide.id, { cost: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="site-guide-controls">
                <label className="site-guide-available">
                  <input
                    type="checkbox"
                    checked={guide.available}
                    onChange={(e) => update(guide.id, { available: e.target.checked })}
                  />
                  <span>Available</span>
                </label>
                <button
                  type="button"
                  className="mini-btn mini-btn--danger"
                  onClick={() => remove(guide.id)}
                  aria-label={`Remove guide ${index + 1}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="btn btn-ghost site-guides-add" onClick={add}>
        + Add site guide
      </button>
    </div>
  );
}
