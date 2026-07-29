import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type Props = {
  title: string;
  description: string;
  /** Optional primary action */
  action?: { label: string; to: string };
  secondaryAction?: { label: string; to: string };
  children?: ReactNode;
  className?: string;
  tone?: "default" | "blocked";
};

/** Consistent empty / unavailable panel for lists and feature gates. */
export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  children,
  className,
  tone = "default",
}: Props) {
  return (
    <div
      className={`tp-empty-state tp-empty-state--${tone}${className ? ` ${className}` : ""}`}
      role="status"
    >
      <h3 className="tp-empty-state__title">{title}</h3>
      <p className="tp-empty-state__desc">{description}</p>
      {children}
      {(action || secondaryAction) && (
        <div className="tp-empty-state__actions">
          {action && (
            <Link to={action.to} className="btn btn-primary">
              {action.label}
            </Link>
          )}
          {secondaryAction && (
            <Link to={secondaryAction.to} className="btn btn-ghost">
              {secondaryAction.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
