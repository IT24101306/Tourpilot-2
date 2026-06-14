import { FormEvent, useEffect, useState } from "react";

type Props = {
  balance: number;
  onTopup: (amount: number) => Promise<number>;
  feeHint?: number;
  className?: string;
};

export function WalletTopupPanel({ balance, onTopup, feeHint, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [displayBalance, setDisplayBalance] = useState(balance);

  useEffect(() => {
    setDisplayBalance(balance);
  }, [balance]);

  const rootClass = ["login-wallet-panel", className].filter(Boolean).join(" ");

  async function submitTopup(value: number) {
    setLoading(true);
    setStatus("");
    try {
      const nextBalance = await onTopup(value);
      setDisplayBalance(nextBalance);
      setStatus(`Topup successful. LKR ${value.toLocaleString()} added.`);
      setAmount("");
      window.setTimeout(() => {
        setOpen(false);
        setStatus("");
      }, 900);
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
          <strong className="login-wallet-panel__value">LKR {displayBalance.toLocaleString()}</strong>
          {feeHint != null && feeHint > 0 ? (
            <span className="login-wallet-panel__fee">Login fee: LKR {feeHint.toLocaleString()}</span>
          ) : null}
        </div>
        <button type="button" className="btn btn-teal login-wallet-panel__btn" onClick={() => setOpen(true)}>
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
              Current balance: <strong>LKR {displayBalance.toLocaleString()}</strong>
            </p>
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
              <label htmlFor="loginTopupAmount">Custom amount (LKR)</label>
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
          </div>
        </div>
      )}
    </>
  );
}
