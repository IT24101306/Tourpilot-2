type IconProps = {
  className?: string;
  size?: number;
  stroke?: string;
};

export function LineUserIcon({ className, size = 18, stroke = "currentColor" }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c0-4 3.5-6 7-6s7 2 7 6" />
    </svg>
  );
}

export function LineCheckIcon({ className, size = 18, stroke = "currentColor" }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function SocialLineIcon({
  platform,
  className,
  size = 18,
  stroke = "currentColor",
}: IconProps & { platform: string }) {
  const common = {
    className,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (platform) {
    case "instagram":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <path d="M17.5 6.5h.01" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <path d="M14 8h3V5h-3c-2.2 0-4 1.8-4 4v2H7v3h3v7h3v-7h3l1-3h-4V9c0-.6.4-1 1-1z" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="12" rx="3" />
          <path d="m10 9.5 6 3.5-6 3.5V9.5z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <path d="M14 4v9.5a3.5 3.5 0 1 1-3.5-3.5" />
          <path d="M14 7c1 1.2 2.2 2 4 2V9c-1.4 0-2.7-.5-4-1.3" />
        </svg>
      );
    case "tripadvisor":
      return (
        <svg {...common}>
          <circle cx="6.5" cy="13" r="2.5" />
          <circle cx="17.5" cy="13" r="2.5" />
          <path d="M9 13h6M12 6v2" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...common}>
          <path d="M12 3a8 8 0 0 0-6.9 12l-1.1 4 4.1-1.1A8 8 0 1 0 12 3z" />
          <path d="M9.5 10.5c.4.9 1.6 2.1 2.5 2.5l1-1.5c.1-.2.4-.2.6-.1.5.3 1.1.5 1.7.6.2 0 .4.2.3.4l-.6 1.8c0 .2-.2.3-.4.3-2.2-.2-4.9-2.4-5.8-4.6-.1-.2 0-.4.2-.5l1.5-.9z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M8 11v6M8 8v.01M12 17v-6M12 11c0-1.1.9-2 2-2s2 .9 2 2v6" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M4 4l16 16M20 4 4 20" />
        </svg>
      );
    case "website":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.8 4 6 4 9s-1.5 6.2-4 9M12 3c-2.5 2.8-4 6-4 9s1.5 6.2 4 9" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8" />
        </svg>
      );
  }
}

export function EntityTypeLineIcon({
  type,
  className,
  size = 18,
  stroke = "currentColor",
}: IconProps & { type: string }) {
  const common = {
    className,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (type) {
    case "HOTEL":
      return (
        <svg {...common}>
          <path d="M4 20V8l8-4 8 4v12" />
          <path d="M9 20v-6h6v6M9 12h6" />
        </svg>
      );
    case "VIEWPOINT":
      return (
        <svg {...common}>
          <path d="M4 16l8-12 8 12" />
          <path d="M8 16h8" />
        </svg>
      );
    case "ACTIVITY":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 4V2M12 22v-2M4 12H2M22 12h-2" />
        </svg>
      );
    case "RESTAURANT":
      return (
        <svg {...common}>
          <path d="M6 4v8c0 2 1 3 3 3s3-1 3-3V4M12 4v16M18 4v8c0 2-1 3-3 3" />
        </svg>
      );
    case "OTHER":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      );
    case "TRANSPORT":
      return (
        <svg {...common}>
          <path d="M4 16h16l-2-8H6L4 16z" />
          <circle cx="7.5" cy="17.5" r="1.5" />
          <circle cx="16.5" cy="17.5" r="1.5" />
        </svg>
      );
    case "FREE_TIME":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      );
    case "all":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" />
          <circle cx="12" cy="11" r="2" />
        </svg>
      );
  }
}

export function TransportVehicleIcon({
  vehicleId,
  className,
  size = 32,
  stroke = "currentColor",
}: IconProps & { vehicleId: string }) {
  const common = {
    className,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (vehicleId) {
    case "sedan":
      return (
        <svg {...common}>
          <path d="M4 16h16l-1.5-5.5a2 2 0 0 0-1.9-1.4H7.4a2 2 0 0 0-1.9 1.4L4 16z" />
          <path d="M6.5 9.5 7.8 6h8.4l1.3 3.5" />
          <circle cx="7.5" cy="16" r="1.25" />
          <circle cx="16.5" cy="16" r="1.25" />
        </svg>
      );
    case "suv":
      return (
        <svg {...common}>
          <path d="M3.5 16h17l-1.2-6a2 2 0 0 0-1.95-1.55H6.65A2 2 0 0 0 4.7 10L3.5 16z" />
          <path d="M6 10 7.5 6.5h9L18 10" />
          <path d="M8 6.5h8" />
          <circle cx="7.5" cy="16" r="1.35" />
          <circle cx="16.5" cy="16" r="1.35" />
        </svg>
      );
    case "mini-van-flat":
      return (
        <svg {...common}>
          <rect x="3" y="9" width="18" height="7" rx="1.5" />
          <path d="M5 9V7.5A1.5 1.5 0 0 1 6.5 6h11A1.5 1.5 0 0 1 19 7.5V9" />
          <circle cx="7.5" cy="16" r="1.25" />
          <circle cx="16.5" cy="16" r="1.25" />
          <path d="M9 12h6" />
        </svg>
      );
    case "van-high":
      return (
        <svg {...common}>
          <path d="M3 11h18v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" />
          <path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" />
          <path d="M5 8h14" />
          <circle cx="7.5" cy="17" r="1.25" />
          <circle cx="16.5" cy="17" r="1.25" />
          <path d="M10 13h4" />
        </svg>
      );
    case "mini-coach":
      return (
        <svg {...common}>
          <path d="M2.5 10h19v7a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17v-7z" />
          <path d="M4 10V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />
          <circle cx="6.5" cy="17.5" r="1.1" />
          <circle cx="12" cy="17.5" r="1.1" />
          <circle cx="17.5" cy="17.5" r="1.1" />
          <path d="M8 13h8" />
        </svg>
      );
    case "bus":
      return (
        <svg {...common}>
          <path d="M2 9.5h20v8a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 17.5v-8z" />
          <path d="M4 9.5V7.5A2 2 0 0 1 6 5.5h12a2 2 0 0 1 2 2v2" />
          <circle cx="6.5" cy="18" r="1.1" />
          <circle cx="12" cy="18" r="1.1" />
          <circle cx="17.5" cy="18" r="1.1" />
          <path d="M8 12.5h8M8 15h8" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="8" rx="2" />
          <circle cx="7.5" cy="16" r="1.25" />
          <circle cx="16.5" cy="16" r="1.25" />
        </svg>
      );
  }
}
