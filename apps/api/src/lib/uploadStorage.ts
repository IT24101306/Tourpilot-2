import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const UPLOAD_DIR = path.join(apiRoot, "uploads");

export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export const UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return "";
  }
}

export function newUploadFilename(mime: string) {
  const ext = extensionForMime(mime);
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
}
