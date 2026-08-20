import { useEffect, useState } from "react";
import { api } from "../api/client";

export type PublicSmartFeatures = {
  aiChatbotEnabled: boolean;
  aiTripPlannerEnabled: boolean;
  liveSupportEnabled: boolean;
  publicOffersEnabled: boolean;
};

export const DEFAULT_PUBLIC_SMART_FEATURES: PublicSmartFeatures = {
  aiChatbotEnabled: true,
  aiTripPlannerEnabled: true,
  liveSupportEnabled: true,
  publicOffersEnabled: true,
};

const SMART_FEATURES_EVENT = "tourpilot-smart-features";

function normalize(data: Partial<PublicSmartFeatures> | null | undefined): PublicSmartFeatures {
  return {
    aiChatbotEnabled: data?.aiChatbotEnabled !== false,
    aiTripPlannerEnabled: data?.aiTripPlannerEnabled !== false,
    liveSupportEnabled: data?.liveSupportEnabled !== false,
    publicOffersEnabled: data?.publicOffersEnabled !== false,
  };
}

let cached: PublicSmartFeatures | null = null;
let inflight: Promise<PublicSmartFeatures> | null = null;

function loadPublicSmartFeatures(): Promise<PublicSmartFeatures> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = api<Partial<PublicSmartFeatures>>("/smart/features")
      .then((data) => {
        cached = normalize(data);
        return cached;
      })
      .catch(() => {
        cached = DEFAULT_PUBLIC_SMART_FEATURES;
        return cached;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** After admin saves, so this tab hides widgets without a full reload. */
export function applyPublicSmartFeatures(next: Partial<PublicSmartFeatures>) {
  cached = normalize(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SMART_FEATURES_EVENT, { detail: cached }));
  }
}

/** Public Ask AI / live support / trip-planner / offers flags. Defaults on until the API says otherwise. */
export function usePublicSmartFeatures() {
  const [features, setFeatures] = useState<PublicSmartFeatures>(
    cached ?? DEFAULT_PUBLIC_SMART_FEATURES
  );
  const [loaded, setLoaded] = useState(cached != null);

  useEffect(() => {
    let cancelled = false;
    loadPublicSmartFeatures().then((next) => {
      if (cancelled) return;
      setFeatures(next);
      setLoaded(true);
    });

    function onChange(event: Event) {
      const detail = (event as CustomEvent<PublicSmartFeatures>).detail;
      if (!detail) return;
      setFeatures(normalize(detail));
      setLoaded(true);
    }
    window.addEventListener(SMART_FEATURES_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(SMART_FEATURES_EVENT, onChange);
    };
  }, []);

  return { ...features, loaded };
}
