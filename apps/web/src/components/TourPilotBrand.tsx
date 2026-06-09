import { Link } from "react-router-dom";

type Props = {
  className?: string;
  onDark?: boolean;
  onImage?: boolean;
};

export function TourPilotBrand({ className = "", onDark = false, onImage = false }: Props) {
  const classes = [
    "brand",
    "brand--with-logo",
    onDark && "brand--on-dark",
    onImage && "brand--on-image",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link to="/" className={classes}>
      <img
        src="/images/tourpilot-logo.png"
        alt=""
        className="brand__logo"
        width={52}
        height={52}
        decoding="async"
      />
      <span className="brand__text">
        Tour<span>Pilot</span>
      </span>
    </Link>
  );
}
