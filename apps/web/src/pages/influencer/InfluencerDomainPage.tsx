import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";

type DnsRecord = { type: string; host: string; value: string };

type DomainInfo = {
  domain: string | null;
  status: "NONE" | "PENDING" | "ACTIVE" | "ERROR";
  verifiedAt: string | null;
  instructions: {
    aRecord: DnsRecord | null;
    cname: DnsRecord | null;
  };
};

const STATUS_LABEL: Record<DomainInfo["status"], string> = {
  NONE: "Not connected",
  PENDING: "Awaiting DNS",
  ACTIVE: "Live",
  ERROR: "Not pointing here yet",
};

const STATUS_CLASS: Record<DomainInfo["status"], string> = {
  NONE: "muted",
  PENDING: "warn",
  ACTIVE: "ok",
  ERROR: "late",
};

export function InfluencerDomainPage() {
  const { token } = useAuth();
  const [info, setInfo] = useState<DomainInfo | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState("");

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api<DomainInfo>("/influencer/mine/domain", { token });
      setInfo(data);
      setDomainInput(data.domain ?? "");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Could not load domain settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function saveDomain(e: FormEvent) {
    e.preventDefault();
    if (!token || !domainInput.trim()) return;
    setSaving(true);
    setMsg("");
    try {
      const data = await api<DomainInfo>("/influencer/mine/domain", {
        method: "POST",
        token,
        body: JSON.stringify({ domain: domainInput.trim() }),
      });
      setInfo(data);
      setMsg("Domain saved. Point your DNS as shown below, then verify.");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Could not save domain.");
    } finally {
      setSaving(false);
    }
  }

  async function verify() {
    if (!token) return;
    setVerifying(true);
    setMsg("");
    try {
      const data = await api<DomainInfo>("/influencer/mine/domain/verify", {
        method: "POST",
        token,
      });
      setInfo(data);
      setMsg(
        data.status === "ACTIVE"
          ? "Verified. Your page is now live on your domain (HTTPS is issued automatically on the first visit)."
          : "Not verified yet."
      );
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  async function remove() {
    if (!token) return;
    setSaving(true);
    setMsg("");
    try {
      const data = await api<DomainInfo>("/influencer/mine/domain", {
        method: "DELETE",
        token,
      });
      setInfo(data);
      setDomainInput("");
      setMsg("Domain removed.");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Could not remove domain.");
    } finally {
      setSaving(false);
    }
  }

  function copy(value: string) {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(value);
        setTimeout(() => setCopied(""), 1500);
      },
      () => {}
    );
  }

  const records = info
    ? [info.instructions.aRecord, info.instructions.cname].filter(
        (r): r is DnsRecord => r !== null
      )
    : [];

  return (
    <div className="module-shell module-operations">
      <ModuleHeader
        module="operations"
        title="Custom domain"
        subtitle="Serve your partner page on your own domain, like mybrand.com. HTTPS is set up automatically."
      />

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="domain-panel">
          <div className="domain-status-row">
            <span className="domain-status-label">Status</span>
            <span className={`domain-status-pill ${STATUS_CLASS[info?.status ?? "NONE"]}`}>
              {STATUS_LABEL[info?.status ?? "NONE"]}
            </span>
            {info?.domain && <code className="domain-current">{info.domain}</code>}
          </div>

          <div className="domain-dns-guide">
            <h3>DNS setup instructions</h3>
            <p className="muted">
              Log in to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.) and add the
              following DNS record. This tells browsers where to find your page.
            </p>
            <table className="domain-dns-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name / Host</th>
                  <th>Value / Points to</th>
                  <th>TTL</th>
                  <th aria-label="Copy" />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>A</td>
                  <td><code>@</code></td>
                  <td><code>200.97.168.95</code></td>
                  <td>3600</td>
                  <td>
                    <button type="button" className="mini-btn" onClick={() => copy("200.97.168.95")}>
                      {copied === "200.97.168.95" ? "Copied" : "Copy"}
                    </button>
                  </td>
                </tr>
                <tr>
                  <td>A</td>
                  <td><code>www</code></td>
                  <td><code>200.97.168.95</code></td>
                  <td>3600</td>
                  <td>
                    <button type="button" className="mini-btn" onClick={() => copy("200.97.168.95")}>
                      {copied === "200.97.168.95" ? "Copied" : "Copy"}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="muted" style={{ marginTop: 8, fontSize: "0.85rem" }}>
              If you are using a subdomain like <code>travel.yourdomain.com</code>, set the Name/Host
              to <code>travel</code> instead of <code>@</code>. DNS changes can take a few minutes to
              a few hours to propagate.
            </p>
          </div>

          <form className="domain-form" onSubmit={saveDomain}>
            <label htmlFor="influencer-domain-input">Your domain</label>
            <div className="domain-form-row">
              <input
                id="influencer-domain-input"
                type="text"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="mybrand.com"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : info?.domain ? "Update" : "Connect"}
              </button>
            </div>
            <p className="muted domain-hint">
              Enter the domain (or subdomain) you own. Buy it from any registrar first.
            </p>
          </form>

          {info?.domain && (
            <>
              <div className="domain-dns">
                <h3>Point your DNS</h3>
                <p className="muted">
                  In your domain registrar&apos;s DNS settings, add the following record(s). Then click
                  Verify. DNS changes can take from a few minutes up to a few hours to propagate.
                </p>
                {records.length === 0 ? (
                  <p className="muted">
                    DNS target is not configured on the platform yet. Contact TourPilot support.
                  </p>
                ) : (
                  <table className="domain-dns-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Name / Host</th>
                        <th>Value / Points to</th>
                        <th aria-label="Copy" />
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr key={`${r.type}-${r.host}`}>
                          <td>{r.type}</td>
                          <td>
                            <code>{r.host}</code>
                          </td>
                          <td>
                            <code>{r.value}</code>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="mini-btn"
                              onClick={() => copy(r.value)}
                            >
                              {copied === r.value ? "Copied" : "Copy"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="domain-actions">
                <button
                  type="button"
                  className="btn btn-teal"
                  onClick={verify}
                  disabled={verifying}
                >
                  {verifying ? "Verifying…" : "Verify DNS"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={remove}
                  disabled={saving}
                >
                  Remove domain
                </button>
              </div>
            </>
          )}

          {msg && <p className="domain-msg">{msg}</p>}
        </div>
      )}
    </div>
  );
}
