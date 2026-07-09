export type SocialLinkLike = {
  platform: string;
  url: string;
  label?: string;
};

const TAG_PLATFORMS = ["instagram", "tiktok", "x", "facebook"] as const;

export function normalizeSocialTagHandle(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  const handle = trimmed.startsWith("@") ? trimmed : `@${trimmed.replace(/^@+/, "")}`;
  return handle.length > 1 ? handle : null;
}

function extractHandleFromUrl(url: string, platform: string): string | null {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, "");
    const parts = pathname.split("/").filter(Boolean);
    if (!parts.length) return null;

    if (platform === "instagram" || platform === "tiktok" || platform === "x") {
      const handle = parts[0];
      if (!handle || ["p", "reel", "stories", "watch"].includes(handle.toLowerCase())) return null;
      return normalizeSocialTagHandle(handle);
    }

    if (platform === "facebook") {
      return normalizeSocialTagHandle(parts[0]);
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveSocialTagHandle(
  explicit: string | null | undefined,
  links: SocialLinkLike[] | null | undefined
): string | null {
  const fromExplicit = normalizeSocialTagHandle(explicit);
  if (fromExplicit) return fromExplicit;
  if (!links?.length) return null;

  for (const platform of TAG_PLATFORMS) {
    const link = links.find((row) => row.platform?.toLowerCase() === platform);
    if (!link) continue;
    if (link.label?.trim()) {
      const fromLabel = normalizeSocialTagHandle(link.label.trim());
      if (fromLabel) return fromLabel;
    }
    const fromUrl = extractHandleFromUrl(link.url, platform);
    if (fromUrl) return fromUrl;
  }

  return null;
}
