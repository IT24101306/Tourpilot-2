import { useRef, useState, type ChangeEvent } from "react";
import { uploadImage } from "../api/upload";
import { CoverImage } from "./CoverImage";

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  token: string | null | undefined;
  hint?: string;
  placeholder?: string;
  className?: string;
};

export function ImageUrlField({
  label,
  value,
  onChange,
  token,
  hint,
  placeholder = "https://… or upload from your device",
  className,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!token) {
      setError("Sign in to upload images.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const url = await uploadImage(file, token);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const fieldClass = ["image-url-field", className].filter(Boolean).join(" ");

  return (
    <label className={fieldClass}>
      {label ? <span>{label}</span> : null}
      <div className="image-url-field-row">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={uploading}
        />
        <button
          type="button"
          className="btn btn-ghost image-url-upload-btn"
          disabled={!token || uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Upload photo"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={onPickFile}
        />
      </div>
      {value.trim() ? (
        <div className="image-url-preview-wrap">
          <CoverImage src={value} className="image-url-preview" alt="" />
        </div>
      ) : null}
      {hint ? (
        <span className="muted image-url-hint">{hint}</span>
      ) : null}
      {error ? <span className="form-error image-url-error">{error}</span> : null}
    </label>
  );
}
