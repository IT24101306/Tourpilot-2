import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";

type StorefrontDomainValue = {
  /** True while we resolve whether this host is an agency custom domain. */
  loading: boolean;
  isCustomDomain: boolean;
  agencySlug: string | null;
  agencyName: string | null;
};

const StorefrontDomainContext = createContext<StorefrontDomainValue>({
  loading: false,
  isCustomDomain: false,
  agencySlug: null,
  agencyName: null,
});

function platformHosts(): string[] {
  const env = (import.meta.env.VITE_PLATFORM_HOSTS as string | undefined) || "";
  const list = env
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return list.length
    ? list
    : ["srilankatourpilot.com", "localhost", "127.0.0.1"];
}

function isPlatformHost(host: string): boolean {
  const bare = host.toLowerCase().replace(/^www\./, "");
  return platformHosts().some((p) => p.replace(/^www\./, "") === bare);
}

export function StorefrontDomainProvider({ children }: { children: ReactNode }) {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const platform = !host || isPlatformHost(host);
  const [state, setState] = useState<StorefrontDomainValue>({
    loading: !platform,
    isCustomDomain: false,
    agencySlug: null,
    agencyName: null,
  });

  useEffect(() => {
    if (platform) return;
    let cancelled = false;
    api<{ slug: string; name: string }>(
      `/public-site?host=${encodeURIComponent(host)}`
    )
      .then((r) => {
        if (cancelled) return;
        setState({
          loading: false,
          isCustomDomain: true,
          agencySlug: r.slug,
          agencyName: r.name,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          loading: false,
          isCustomDomain: false,
          agencySlug: null,
          agencyName: null,
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
