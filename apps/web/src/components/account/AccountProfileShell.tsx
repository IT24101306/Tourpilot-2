import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { UserRole } from "@tourpilot/shared";
import type {
  AccountAction,
  AccountField,
  AccountHighlight,
  AccountStat,
} from "./accountProfileUtils";
import { useFormatMoney } from "../../context/CurrencyContext";
import { formatPhone, initials, roleLabel, lkr } from "./accountProfileUtils";

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
  variant = "page",
  children,
}: Props) {
  const { format: formatMoney } = useFormatMoney();

  const infoFields: AccountField[] = email
    ? [...fields, { label: "Email", value: email }]
    : fields;

  const hasOverview =
    highlights.length > 0 || stats.length > 0 || infoFields.length > 0 || actions.length > 0;

  const body = (
    <>
      <div className="account-profile-hero">
        <div className="account-profile-hero-inner">
          <div className="account-profile-identity">
            <div className="account-profile-avatar" aria-hidden="true">
              {initials(name)}
            </div>
            <div className="account-profile-intro">
              <p className="account-profile-eyebrow">My account</p>
              <h1 className="account-profile-name">{name}</h1>
              <div className="account-profile-meta">
                <span className={`account-role-pill account-role-pill--${role.toLowerCase()}`}>
                  {roleLabel(role)}
                </span>
                <span className="account-profile-phone">{formatPhone(phone)}</span>
              </div>
              {tagline ? <p className="account-profile-tagline">{tagline}</p> : null}
            </div>
          </div>
          <div className="account-profile-wallet">
            <span className="account-profile-wallet-label">Wallet balance</span>
            <strong className="account-profile-wallet-value">
              {role === "TOURIST" ? formatMoney(walletBalance) : lkr(walletBalance)}
            </strong>
          </div>
        </div>
      </div>

      <div className="account-profile-body">
        {hasOverview && (
          <div className="account-profile-band account-profile-band--surface">
            <div className="account-profile-inner">
              <header className="account-section-head">
                <h2>Overview</h2>
                <p>Your details, wallet, and shortcuts in one place.</p>
              </header>

              <div className="account-profile-bento" aria-label="Account overview">
                {highlights.map((h) => (
                  <Link
                    key={h.id}
                    to={h.to}
                    className={`account-bento-tile account-bento-tile--highlight account-bento-span-${h.span ?? 2}`}
                  >
                    <span className="account-bento-kicker">{h.label}</span>
                    <strong className="account-bento-value">{h.value}</strong>
                    {h.description ? <p className="account-bento-desc">{h.description}</p> : null}
                    <span className="account-bento-cta">Open →</span>
                  </Link>
                ))}

                {stats.map((s) => (
                  <div
                    key={s.label}
                    className={`account-bento-tile account-bento-tile--stat account-bento-span-1 account-bento-tile--${s.tone ?? "default"}`}
                  >
                    <span className="account-bento-kicker">{s.label}</span>
                    <strong className="account-bento-value">{s.value}</strong>
                  </div>
                ))}

                {infoFields.map((f) => (
                  <div
                    key={f.label}
                    className={`account-bento-tile account-bento-tile--info account-bento-span-${infoFields.length === 1 ? 2 : 1}`}
                  >
                    <span className="account-bento-kicker">{f.label}</span>
                    <p className="account-bento-desc account-bento-desc--strong">{f.value}</p>
                  </div>
                ))}

                {actions.map((a) => (
                  <Link
                    key={a.to}
                    to={a.to}
                    className={`account-bento-tile account-bento-tile--action account-bento-span-1 account-bento-tile--action-${a.variant ?? "ghost"}`}
                  >
                    <span className="account-bento-kicker">{a.label}</span>
                    <span className="account-bento-cta">Go →</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {children ? (
          <div className="account-profile-band account-profile-band--white">
            <div className="account-profile-inner account-profile-inner--panels">{children}</div>
          </div>
        ) : null}
      </div>
    </>
  );

  if (variant === "embedded") {
    return <div className="account-profile account-profile--modern account-profile--embedded">{body}</div>;
  }

  return <div className="account-profile account-profile--modern">{body}</div>;
}
