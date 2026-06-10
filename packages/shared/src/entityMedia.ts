export type EntityMediaKind = "image" | "video" | "link";

export type EntityMediaItem = {
  kind: EntityMediaKind;
  url: string;
  label?: string;
  role?: "main";
};

export type EntityMediaBundle = {
  mainImageUrl: string | null;
  items: EntityMediaItem[];
};

function isMediaItem(row: unknown): row is EntityMediaItem {
  if (!row || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  const kind = r.kind;
  const url = r.url;
  return (
    (kind === "image" || kind === "video" || kind === "link") &&
    typeof url === "string" &&
    url.trim().length > 0
  );
}

function parseMediaItems(value: unknown): EntityMediaItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isMediaItem).map((item) => ({
    kind: item.kind,
    url: item.url.trim(),
    ...(item.label?.trim() ? { label: item.label.trim() } : {}),
    ...(item.role === "main" ? { role: "main" as const } : {}),
  }));
}

/** Normalize entity.media from DB (array legacy or { mainImageUrl, items } object). */
export function normalizeEntityMedia(media: unknown): EntityMediaBundle {
  if (!media) return { mainImageUrl: null, items: [] };

  if (Array.isArray(media)) {
    const items = parseMediaItems(media);
    const main =
      items.find((i) => i.kind === "image" && i.role === "main") ??
      items.find((i) => i.kind === "image");
    const gallery = main
      ? items.filter((i) => !(i.kind === "image" && i.url === main.url))
      : items.filter((i) => i.role !== "main");
    return {
      mainImageUrl: main?.url ?? null,
      items: gallery,
    };
  }

  if (typeof media === "object" && media !== null) {
    const m = media as Record<string, unknown>;
    const mainImageUrl =
      typeof m.mainImageUrl === "string" && m.mainImageUrl.trim() ? m.mainImageUrl.trim() : null;
    const items = parseMediaItems(m.items).filter((i) => i.role !== "main");
    return { mainImageUrl, items };
  }

  return { mainImageUrl: null, items: [] };
}

export function buildEntityMediaStore(
  mainImageUrl: string | null | undefined,
  items: EntityMediaItem[]
): { mainImageUrl: string | null; items: EntityMediaItem[] } | undefined {
  const main = mainImageUrl?.trim() || null;
  const gallery = items
    .map((i) => ({
      kind: i.kind,
      url: i.url.trim(),
      ...(i.label?.trim() ? { label: i.label.trim() } : {}),
    }))
    .filter((i) => i.url);

  if (!main && gallery.length === 0) return undefined;
  return { mainImageUrl: main, items: gallery };
}

export function entityMainImageUrl(media: unknown): string | null {
  return normalizeEntityMedia(media).mainImageUrl;
}
