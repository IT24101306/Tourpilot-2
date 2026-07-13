import { useEffect, useState } from "react";
import { ApiError, api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ImageUrlField } from "../ImageUrlField";

/** Lets agencies upload their logo for the top bar / storefront. */
export function AgencyLogoPanel() {
  const { user, token, refreshUser } = useAuth();
  const [logoUrl, setLogoUrl] = useState(user?.agency?.logoUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setLogoUrl(user?.agency?.logoUrl ?? "");
  }, [user?.agency?.logoUrl]);

  if (!user?.agency || !token) return null;

  async function saveLogo() {
    setSaving(true);
    setStatus("");
    try {
      await api("/agencies/mine", {
        method: "PATCH",
        token,
        body: JSON.stringify({ logoUrl: logoUrl.trim() }),
      });
      await refreshUser();
      setStatus("Logo saved. It will appear in your dashboard and storefront header.");
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Could not save logo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="account-profile-block">
      <header className="account-block-head">
        <h2>Agency logo</h2>
        <p>Shown in your dashboard top bar and public storefront header.</p>
      </header>
      <ImageUrlField
        label="Logo image"
        value={logoUrl}
        onChange={(url) => {
          setLogoUrl(url);
          setStatus("");
        }}
        token={token}
        hint="Square or wide logos work best. Upload a PNG or JPG, or paste an image URL."
      />
      <div className="account-profile-edit-toolbar">
        <button type="button" className="btn btn-primary" disabled={saving} onClick={saveLogo}>
          {saving ? "Saving…" : "Save logo"}
        </button>
        {logoUrl.trim() ? (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={saving}
            onClick={() => setLogoUrl("")}
          >
            Clear
          </button>
        ) : null}
      </div>
      {status ? <p className="account-profile-status-msg">{status}</p> : null}
    </div>
  );
}
