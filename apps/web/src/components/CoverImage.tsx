import { useEffect, useState } from "react";
import { DEFAULT_TOUR_COVER_URL, resolveImageUrl } from "@tourpilot/shared";

type Props = {
  src: string | null | undefined;
  fallback?: string;
  className?: string;
  alt?: string;
};

/** Renders a cover image with automatic fallback when the URL 404s or fails to load. */
export function CoverImage({
  src,
  fallback = DEFAULT_TOUR_COVER_URL,
  className,
  alt = "",
}: Props) {
  const [url, setUrl] = useState(() => resolveImageUrl(src, fallback));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setUrl(resolveImageUrl(src, fallback));
  }, [src, fallback]);

  if (failed) {
    return null;
  }

  return (
    <img
      className={className}
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (url !== fallback) {
          setUrl(fallback);
          return;
        }
        setFailed(true);
      }}
    />
  );
}
