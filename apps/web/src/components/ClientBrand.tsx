import { Link } from "react-router-dom";

type Props = {
  name: string;
  logoUrl?: string | null;
  to?: string;
  onDark?: boolean;
  onImage?: boolean;
  className?: string;
  /** Optional subtitle under the name (e.g. "Agency dashboard"). */
  subtitle?: string;
};

/** Client / white-label mark for the top bar (agency or creator). */
export function ClientBrand({
  name,
  logoUrl,
  to,
  onDark = false,
  onImage = false,
  className = "",
  subtitle,
}: Props) {
  const resolvedLogo = logoUrl?.trim() || null;
  const classes = [
    "client-brand",
    resolvedLogo && "client-brand--with-logo",
    onDark && "client-brand--on-dark",
    onImage && "client-brand--on-image",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      {resolvedLogo ? (
        <img
          src={resolvedLogo}
          alt=""
          className="client-brand__logo"
          width={40}
          height={40}
          decoding="async"
        />
      ) : (
        <span className="client-brand__fallback" aria-hidden="true">
          {name.trim().charAt(0).toUpperCase() || "·"}
        </span>
      )}
      <span className="client-brand__text">
        <span className="client-brand__name">{name}</span>
        {subtitle ? <span className="client-brand__sub">{subtitle}</span> : null}
      </span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {inner}
      </Link>
    );
  }

  return <div className={classes}>{inner}</div>;
}
