import { FormEvent, useEffect, useState } from "react";
import { formatCredits } from "../../lib/walletLedger";
import { PayHereAutoSubmit } from "../billing/PayHereAutoSubmit";

export type WalletTopupResult =
  | { mode: "payhere"; checkoutUrl: string; fields: Record<string, string> }
  | { mode: "credited"; balance: number };

type Props = {
  balance: number;
  onTopup: (amount: number) => Promise<WalletTopupResult | number>;
  feeHint?: number;
  className?: string;
  /** Stronger top-up prompt for profile / account surfaces. */
  emphasize?: boolean;
};

export function WalletTopupPanel({
  balance,
  onTopup,
  feeHint,
  className = "",
  emphasize = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [displayBalance, setDisplayBalance] = useState(balance);

  const [payHere, setPayHere] = useState<{ checkoutUrl: string; fields: Record<string, string> } | null>(
    null
  );

  useEffect(() => {
    setDisplayBalance(balance);
  }, [balance]);

  const rootClass = [
    "login-wallet-panel",
    emphasize && "login-wallet-panel--emphasize",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const lowBalance = feeHint != null && feeHint > 0 && displayBalance < feeHint;

  async function submitTopup(value: number) {
    setLoading(true);
    setStatus("");
    try {
      const result = await onTopup(value);
      if (typeof result === "number") {
        setDisplayBalance(result);
        setStatus(`Topup successful. ${formatCredits(value)} added.`);
        setAmount("");
        window.setTimeout(() => {
          setOpen(false);
          setStatus("");
        }, 900);
        return;
      }
      if (result.mode === "credited" && typeof result.balance === "number") {
        setDisplayBalance(result.balance);
        setStatus(`Topup successful. ${formatCredits(value)} added.`);
        return;
      }
      if (result.mode === "payhere") {
        setPayHere({ checkoutUrl: result.checkoutUrl, fields: result.fields });
        setStatus("Redirecting to PayHere…");
        return;
      }
      setStatus("Could not start PayHere checkout.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Topup failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setStatus("Enter a valid amount.");
      return;
    }
    void submitTopup(value);
  }

  return (
    <>
      <div className={rootClass}>
        <div className="login-wallet-panel__copy">
          <span className="login-wallet-panel__label">Wallet balance</span>
          <strong className="login-wallet-panel__value">{formatCredits(displayBalance)}</strong>
          {feeHint != null && feeHint > 0 ? (
            <span className="login-wallet-panel__fee">
              {lowBalance
                ? `Balance is below the ${formatCredits(feeHint)} login fee — top up to keep access smooth.`
                : `Login fee: ${formatCredits(feeHint)}`}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className={`btn ${emphasize ? "btn-primary" : "btn-teal"} login-wallet-panel__btn`}
          onClick={() => {
            setPayHere(null);
            setOpen(true);
          }}
        >
          Top up
        </button>
      </div>

      {open && (
        <div className="entity-modal open" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="entity-dialog topup-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="loginTopupTitle"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-head">
              <h3 id="loginTopupTitle">Wallet topup</h3>
              <button type="button" className="close-btn" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <p className="dialog-sub muted">
              Current balance: <strong>{formatCredits(displayBalance)}</strong>
              . Card payment is processed by PayHere — credits are added after confirmation.
            </p>
            {payHere ? (
              <PayHereAutoSubmit checkoutUrl={payHere.checkoutUrl} fields={payHere.fields} />
            ) : (
            <form className="topup-form" onSubmit={handleSubmit}>
              <div className="topup-quick-row">
                {[100, 500, 1000].map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    className="topup-quick-btn"
                    disabled={loading}
                    onClick={() => {
                      setAmount(String(quick));
                      setStatus("");
                    }}
                  >
                    {quick}
                  </button>
                ))}
              </div>
              <label htmlFor="loginTopupAmount">Custom amount (Credits)</label>
              <input
                id="loginTopupAmount"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
              />
              <div className="dialog-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading || !amount.trim()}>
                  {loading ? "Processing…" : "Top up"}
                </button>
              </div>
              {status && <p className="entity-status">{status}</p>}
            </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
