import type { ReactNode } from "react";

type IconId =
  | "agency"
  | "users"
  | "inquiry"
  | "tour"
  | "commission"
  | "ledger"
  | "offer"
  | "review"
  | "driver"
  | "cms"
  | "settings";

export function AdminHubIcon({ icon }: { icon: IconId }) {
  const paths: Record<IconId, ReactNode> = {
    agency: (
      <path
        d="M4 20V10l8-6 8 6v10M9 20v-6h6v6"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    users: (
      <>
        <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.75" fill="none" />
        <path
          d="M3 19c0-3 2.7-5 6-5s6 2 6 5M16 11v6M19 14h-6"
          stroke="currentColor"
          strokeWidth="1.75"
          fill="none"
          strokeLinecap="round"
        />
      </>
    ),
    inquiry: (
      <path
        d="M5 8h14M5 12h10M5 16h6M6 4h12v16H6"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="none"
        strokeLinecap="round"
      />
    ),
    tour: (
      <path
        d="M4 7h16M4 12h16M4 17h10M7 4v16"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="none"
        strokeLinecap="round"
      />
    ),
    commission: (
      <path
        d="M6 16l4-8 4 8M8 13h4"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    ledger: (
      <path
        d="M6 6h12v12H6zM9 10h6M9 14h4"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="none"
        strokeLinecap="round"
      />
    ),
    offer: (
      <path
        d="M5 9l7-4 7 4-7 4-7-4zm2 9h10"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    review: (
      <path
        d="M12 4l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7L12 4z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
    ),
    driver: (
      <path
        d="M5 16l2-8h10l2 8M7 16h10M8 12h8"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    cms: (
      <path
        d="M6 5h12v14H6zM9 9h6M9 13h4"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="none"
        strokeLinecap="round"
      />
    ),
    settings: (
      <path
        d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM4.5 12h2M17.5 12h2M12 4.5v2M12 17.5v2M6.6 6.6l1.4 1.4M16 16l1.4 1.4M6.6 17.4L8 16M16 8l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="none"
        strokeLinecap="round"
      />
    ),
  };

  return (
    <span className="gov-hub-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22">
        {paths[icon]}
      </svg>
    </span>
  );
}
