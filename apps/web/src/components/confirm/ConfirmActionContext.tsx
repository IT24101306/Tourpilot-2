import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll, unlockBodyScroll } from "../../lib/scrollLock";

export type ConfirmSummaryItem = {
  label: string;
  value: string;
  tone?: "default" | "warning" | "danger";
};

export type ConfirmActionRequest = {
  title: string;
  description?: string;
  summary: ConfirmSummaryItem[];
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void | Promise<void>;
};

type ConfirmActionContextValue = {
  requestConfirm: (request: ConfirmActionRequest) => void;
};

const ConfirmActionContext = createContext<ConfirmActionContextValue | null>(null);

const passthroughConfirm: ConfirmActionContextValue = {
  requestConfirm: (request) => {
    void Promise.resolve(request.onConfirm());
  },
};

export function useConfirmAction() {
  return useContext(ConfirmActionContext) ?? passthroughConfirm;
}

type ActiveRequest = ConfirmActionRequest & { open: boolean };

function ConfirmActionDialog({
  request,
  loading,
  error,
  onCancel,
  onConfirm,
}: {
  request: ActiveRequest | null;
  loading: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!request?.open) return;
    lockBodyScroll();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) onCancel();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [request?.open, loading, onCancel]);

  if (!request?.open) return null;

  const confirmClass =
    request.variant === "danger" ? "btn btn-primary gov-btn-danger" : "btn btn-primary";

  return createPortal(
    <div className="entity-modal open confirm-action-backdrop" role="presentation" onClick={loading ? undefined : onCancel}>
      <div
        className="entity-dialog confirm-action-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
        aria-describedby="confirm-action-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-head">
          <h3 id="confirm-action-title">{request.title}</h3>
          <button
            type="button"
            className="close-btn"
            onClick={onCancel}
            disabled={loading}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {request.description ? (
          <p id="confirm-action-desc" className="dialog-sub muted">
            {request.description}
          </p>
        ) : (
          <p id="confirm-action-desc" className="dialog-sub muted">
            Review the summary below before continuing.
          </p>
        )}

        {request.summary.length > 0 && (
          <dl className="confirm-summary">
            {request.summary.map((row, index) => (
              <div
                key={`${row.label}-${index}`}
                className={`confirm-summary-row${
                  row.tone && row.tone !== "default" ? ` confirm-summary-row--${row.tone}` : ""
                }`}
              >
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {error ? (
          <p className="form-error" role="alert" style={{ marginTop: 0 }}>
            {error}
          </p>
        ) : null}

        <div className="gov-form-actions confirm-action-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={loading}>
            {request.cancelLabel ?? "Cancel"}
          </button>
          <button type="button" className={confirmClass} onClick={onConfirm} disabled={loading}>
            {loading ? "Working…" : request.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ConfirmActionProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ActiveRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onConfirmRef = useRef<(() => void | Promise<void>) | null>(null);

  const close = useCallback(() => {
    if (loading) return;
    setRequest(null);
    setError(null);
    onConfirmRef.current = null;
  }, [loading]);

  const requestConfirm = useCallback((next: ConfirmActionRequest) => {
    onConfirmRef.current = next.onConfirm;
    setRequest({ ...next, open: true });
    setLoading(false);
    setError(null);
  }, []);

  const runConfirm = useCallback(async () => {
    const action = onConfirmRef.current;
    if (!action || loading) return;
    setLoading(true);
    setError(null);
    try {
      await action();
      setRequest(null);
      onConfirmRef.current = null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return (
    <ConfirmActionContext.Provider value={{ requestConfirm }}>
      {children}
      <ConfirmActionDialog
        request={request}
        loading={loading}
        error={error}
        onCancel={close}
        onConfirm={runConfirm}
      />
    </ConfirmActionContext.Provider>
  );
}
