import { useEffect, type ReactNode } from "react";
import { FormFieldError } from "./FormFieldError";
import { createPortal } from "react-dom";
import { lockBodyScroll, unlockBodyScroll } from "../lib/scrollLock";

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  dialogClassName?: string;
};

export function DashboardModal({
  open,
  title,
  subtitle,
  onClose,
  children,
  dialogClassName,
}: Props) {
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="entity-modal open" role="presentation" onClick={onClose}>
      <div
        className={["entity-dialog", dialogClassName].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-head">
          <h3 id="dashboard-modal-title">{title}</h3>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {subtitle ? <p className="dialog-sub muted">{subtitle}</p> : null}
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ModalField({
  label,
  full,
  error,
  children,
}: {
  label: string;
  full?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={`field ${full ? "full" : ""}${error ? " field--invalid" : ""}`}>
      <label>{label}</label>
      {children}
      <FormFieldError message={error} />
    </div>
  );
}

export function ModalActions({
  onCancel,
  submitLabel,
  saving,
}: {
  onCancel: () => void;
  submitLabel: string;
  saving?: boolean;
}) {
  return (
    <div className="dialog-actions">
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}
