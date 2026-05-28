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

const MODULE_LABELS: Record<ModuleId, string> = {
  operations: "Mission control",
  negotiation: "Collaborative planning",
  itinerary: "Dream itinerary",
  tasks: "Organized execution",
  guided: "Guided experience",
  discovery: "Inspired exploration",
  governance: "Platform oversight",
  catalog: "Build your catalog",
  partner: "Partner growth",
  companion: "Travel companion",
};

type Props = {
  module: ModuleId;
  title: string;
  subtitle: string;
  children?: ReactNode;
};

export function ModuleHeader({ module, title, subtitle, children }: Props) {
  return (
    <header className="module-header">
      <div className="module-header-text">
        <span className={`module-badge module-badge--${module}`}>{MODULE_LABELS[module]}</span>
        <h2 className="module-title">{title}</h2>
        <p className="module-subtitle">{subtitle}</p>
      </div>
      {children ? <div className="module-header-actions">{children}</div> : null}
    </header>
  );
}
