import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";

type StorefrontKind = "agency" | "influencer";

type StorefrontDomainValue = {
  /** True while we resolve whether this host is a custom domain. */
  loading: boolean;
  isCustomDomain: boolean;
  kind: StorefrontKind | null;
  agencySlug: string | null;
  influencerSlug: string | null;
  name: string | null;
};

const StorefrontDomainContext = createContext<StorefrontDomainValue>({
  loading: false,
  isCustomDomain: false,
  kind: null,
  agencySlug: null,
  influencerSlug: null,
  name: null,
});

function platformHosts(): string[] {
  const env = (import.meta.env.VITE_PLATFORM_HOSTS as string | undefined) || "";
  const list = env
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return list.length
    ? list
    : [
        "srilankatourpilot.com",
        "dev.srilankatourpilot.com",
        "localhost",
        "127.0.0.1",
      ];
}

function isPlatformHost(host: string): boolean {
  const bare = host.toLowerCase().replace(/^www\./, "");
  const hosts = platformHosts().map((p) => p.replace(/^www\./, ""));
  if (hosts.includes(bare)) return true;
  // Staging subdomain of any listed apex (dev.example.com).
  return hosts.some((apex) => apex && !apex.startsWith("dev.") && bare === `dev.${apex}`);
}

export function StorefrontDomainProvider({ children }: { children: ReactNode }) {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const platform = !host || isPlatformHost(host);
  const [state, setState] = useState<StorefrontDomainValue>({
    loading: !platform,
    isCustomDomain: false,
    kind: null,
    agencySlug: null,
    influencerSlug: null,
    name: null,
  });

  useEffect(() => {
    if (platform) return;
    let cancelled = false;
    api<{ type?: StorefrontKind; slug: string; name: string }>(
      `/public-site?host=${encodeURIComponent(host)}`
    )
      .then((r) => {
        if (cancelled) return;
        const kind: StorefrontKind = r.type === "influencer" ? "influencer" : "agency";
        setState({
          loading: false,
          isCustomDomain: true,
          kind,
          agencySlug: kind === "agency" ? r.slug : null,
          influencerSlug: kind === "influencer" ? r.slug : null,
          name: r.name,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          loading: false,
          isCustomDomain: false,
          kind: null,
          agencySlug: null,
          influencerSlug: null,
          name: null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [host, platform]);

  return (
    <StorefrontDomainContext.Provider value={state}>
      {children}
    </StorefrontDomainContext.Provider>
  );
}

export function useStorefrontDomain() {
  return useContext(StorefrontDomainContext);
}
