import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { UserRole } from "@tourpilot/shared";
import type {
  AccountAction,
  AccountField,
  AccountHighlight,
  AccountStat,
} from "./accountProfileUtils";
import { formatPhone, initials, roleLabel } from "./accountProfileUtils";
import { formatCredits } from "../../lib/walletLedger";

export type AccountContextPartner = {
  name: string;
  slug?: string | null;
  logoUrl?: string | null;
  href?: string;
};

type Props = {
  name: string;
  phone: string;
  role: UserRole;
  email?: string | null;
  walletBalance: number;
  stats?: AccountStat[];
  fields?: AccountField[];
  actions?: AccountAction[];
  highlights?: AccountHighlight[];
  tagline?: string | null;
  /** Clear label for whose workspace this is (e.g. agency name). */
  contextLabel?: string | null;
  /** Agencies / partners linked to this account for orientation. */
  contextPartners?: AccountContextPartner[];
  /** High-priority content shown directly under the hero (e.g. wallet). */
  leading?: ReactNode;
  variant?: "page" | "embedded";
  children?: ReactNode;
};

export function AccountProfileShell({
  name,
  phone,
  role,
  email,
  walletBalance,
  stats = [],
  fields = [],
  actions = [],
  highlights = [],
  tagline,
  contextLabel,
  contextPartners = [],
  leading,
  variant = "page",
  children,
}: Props) {
  const infoFields: AccountField[] = email
    ? [...fields, { label: "Email", value: email }]
    : fields;

  const featured = highlights[0] ?? null;
  const walletDisplay = formatCredits(walletBalance);
  const hasShortcuts = actions.length > 0;
  const hasStats = stats.length > 0;
  const hasDetails = infoFields.length > 0;
  const eyebrow =
    contextLabel?.trim() ||
    (role === "AGENCY" ? "Agency account" : role === "TOURIST" ? "Traveler account" : "My account");

  const body = (
    <>
      <header className="account-profile-hero">
        <div className="account-profile-hero-inner">
          <div className="account-profile-hero-row">
            <div className="account-profile-identity">
              <div className="account-profile-avatar" aria-hidden="true">
                {initials(name)}
              </div>
              <div className="account-profile-intro">
                <p className="account-profile-eyebrow">{eyebrow}</p>
                <h1 className="account-profile-name">{name}</h1>
                <div className="account-profile-meta">
                  <span className={`account-role-pill account-role-pill--${role.toLowerCase()}`}>
                    {roleLabel(role)}
                  </span>
                  <span className="account-profile-phone">{formatPhone(phone)}</span>
                </div>
                {tagline ? <p className="account-profile-tagline">{tagline}</p> : null}

                {contextPartners.length > 0 ? (
                  <div className="account-profile-partners" aria-label="Linked travel partners">
                    <span className="account-profile-partners__label">
                      {role === "TOURIST" ? "Planning with" : "Workspace"}
                    </span>
                    <ul className="account-profile-partners__list">
                      {contextPartners.map((p) => {
                        const content = (
                          <>
                            {p.logoUrl ? (
                              <img src={p.logoUrl} alt="" className="account-profile-partners__logo" />
                            ) : (
                              <span className="account-profile-partners__mark" aria-hidden="true">
                                {p.name.trim().charAt(0).toUpperCase()}
                              </span>
                            )}
                            <span className="account-profile-partners__name">{p.name}</span>
                          </>
                        );
                        const key = `${p.slug ?? p.name}`;
                        const to = p.href || (p.slug ? `/agencies/${p.slug}` : undefined);
                        return (
                          <li key={key}>
                            {to ? (
                              <Link to={to} className="account-profile-partners__chip">
                                {content}
                              </Link>
                            ) : (
                              <span className="account-profile-partners__chip">{content}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>

            <aside className="account-profile-wallet" aria-label="Wallet balance">
              <span className="account-profile-wallet__label">Wallet</span>
              <strong className="account-profile-wallet__value">{walletDisplay}</strong>
              <a href="#account-wallet" className="account-profile-wallet__cta">
                Top up
              </a>
            </aside>
          </div>
        </div>
      </header>

      <div className="account-profile-body">
        {hasShortcuts ? (
          <section className="account-profile-band account-profile-band--surface">
            <div className="account-profile-inner">
              <div className="account-profile-block">
                <header className="account-block-head">
                  <h2>Shortcuts</h2>
                  <p>Jump to your most-used tools.</p>
                </header>
                <nav className="account-shortcuts" aria-label="Account shortcuts">
                  {actions.map((a) => (
                    <Link
                      key={a.to}
                      to={a.to}
                      className={`account-shortcut account-shortcut--${a.variant ?? "ghost"}`}
                    >
                      <span className="account-shortcut-label">{a.label}</span>
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          </section>
        ) : null}

        {leading ? (
          <section className="account-profile-band account-profile-band--wallet">
            <div className="account-profile-inner">{leading}</div>
          </section>
        ) : null}

        {(featured || hasStats || hasDetails) && (
          <section className="account-profile-band account-profile-band--surface">
            <div className="account-profile-inner">
              {featured && (
                <div className="account-profile-block">
                  <header className="account-block-head">
                    <h2>Featured</h2>
                  </header>
                  <Link to={featured.to} className="account-featured-card">
                    <div className="account-featured-card-body">
                      <span className="account-featured-kicker">{featured.label}</span>
                      <strong className="account-featured-value">{featured.value}</strong>
                      {featured.description ? (
                        <p className="account-featured-desc">{featured.description}</p>
                      ) : null}
                    </div>
                    <span className="account-featured-cta">Open</span>
                  </Link>
                </div>
              )}

              {hasStats && (
                <div className="account-profile-block">
                  <header className="account-block-head">
                    <h2>At a glance</h2>
                  </header>
                  <dl className="account-stat-row">
                    {stats.map((s) => (
                      <div
                        key={s.label}
                        className={`account-stat-item account-stat-item--${s.tone ?? "default"}`}
                      >
                        <dt>{s.label}</dt>
                        <dd>{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {hasDetails && (
                <div className="account-profile-block account-profile-block--meta">
                  <p className="account-meta-note">
                    <span className="account-meta-note__label">Account details</span>
                    {infoFields.map((f, i) => (
                      <span key={f.label} className="account-meta-note__item">
                        {i > 0 ? <span className="account-meta-note__sep" aria-hidden="true">·</span> : null}
                        <span className="account-meta-note__key">{f.label}</span> {f.value}
                      </span>
                    ))}
                    <span className="account-meta-note__hint">Read-only</span>
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {children ? (
          <section className="account-profile-band account-profile-band--white">
            <div className="account-profile-inner account-profile-inner--panels">{children}</div>
          </section>
        ) : null}
      </div>
    </>
  );

  if (variant === "embedded") {
    return <div className="account-profile account-profile--modern account-profile--embedded">{body}</div>;
  }

  return <div className="account-profile account-profile--modern">{body}</div>;
}
