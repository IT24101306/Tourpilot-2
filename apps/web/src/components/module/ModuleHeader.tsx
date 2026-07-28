import type { ReactNode } from "react";

type ModuleId =
  | "operations"
  | "negotiation"
  | "itinerary"
  | "tasks"
  | "guided"
  | "discovery"
  | "governance"
  | "catalog"
  | "partner"
  | "companion";

type Props = {
  /** @deprecated Kept for call-site compatibility; badge is no longer shown. */
  module?: ModuleId;
  title: string;
  /** @deprecated Kept for call-site compatibility; not rendered. */
  subtitle?: string;
  children?: ReactNode;
};

export function ModuleHeader({ title, children }: Props) {
  return (
    <header className="module-header">
      <div className="module-header-text">
        <h2 className="module-title">{title}</h2>
      </div>
      {children ? <div className="module-header-actions">{children}</div> : null}
    </header>
  );
}
