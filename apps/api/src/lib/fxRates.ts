import {
  DISPLAY_CURRENCIES,
  LKR_PER_DISPLAY_UNIT,
  type DisplayCurrency,
  type FxRatesPayload,
  type LkrRateTable,
  resolveLkrRates,
} from "@tourpilot/shared";

const CACHE_TTL_MS = Number(process.env.FX_CACHE_TTL_MS || 6 * 60 * 60 * 1000); // 6h
const FETCH_TIMEOUT_MS = 8_000;

type CacheEntry = {
  payload: FxRatesPayload;
  expiresAt: number;
};

let cache: CacheEntry | null = null;
let inflight: Promise<FxRatesPayload> | null = null;

function staticFallback(reason: string): FxRatesPayload {
  return {
    rates: { ...LKR_PER_DISPLAY_UNIT },
    asOf: new Date().toISOString(),
    live: false,
    source: `fallback:${reason}`,
  };
}

/**
 * Build LKR-per-unit table from a USD-base rate map
 * (1 USD = rates[CODE] units of CODE).
 */
function fromUsdBase(usdRates: Record<string, number>, source: string, asOf: string): FxRatesPayload | null {
  const usdLkr = Number(usdRates.LKR ?? usdRates.lkr);
  if (!Number.isFinite(usdLkr) || usdLkr <= 0) return null;

  const rates = { ...LKR_PER_DISPLAY_UNIT } as LkrRateTable;
  rates.USD = usdLkr;
  rates.LKR = 1;

  for (const code of DISPLAY_CURRENCIES) {
    if (code === "USD" || code === "LKR") continue;
    const perUsd = Number(usdRates[code] ?? usdRates[code.toLowerCase()]);
    if (!Number.isFinite(perUsd) || perUsd <= 0) continue;
    // 1 CODE = (1 / perUsd) USD = usdLkr / perUsd LKR
    rates[code] = usdLkr / perUsd;
  }

  return { rates: resolveLkrRates(rates), asOf, live: true, source };
}

/**
 * Build LKR-per-unit from an LKR-base map (1 LKR = rates[code] units of code).
 */
function fromLkrBase(lkrRates: Record<string, number>, source: string, asOf: string): FxRatesPayload | null {
  const rates = { ...LKR_PER_DISPLAY_UNIT } as LkrRateTable;
  rates.LKR = 1;

  for (const code of DISPLAY_CURRENCIES) {
    if (code === "LKR") continue;
    const perLkr = Number(lkrRates[code.toLowerCase()] ?? lkrRates[code]);
    if (!Number.isFinite(perLkr) || perLkr <= 0) continue;
    rates[code] = 1 / perLkr;
  }

  if (!Number.isFinite(rates.USD) || rates.USD <= 0) return null;
  return { rates: resolveLkrRates(rates), asOf, live: true, source };
}

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromCurrencyApi(): Promise<FxRatesPayload | null> {
  // Free CDN, no API key — daily updated open FX data.
  const urls = [
    "https://latest.currency-api.pages.dev/v1/currencies/lkr.json",
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/lkr.json",
  ];
  for (const url of urls) {
    try {
      const raw = (await fetchJson(url)) as {
        date?: string;
        lkr?: Record<string, number>;
      };
      if (!raw?.lkr || typeof raw.lkr !== "object") continue;
      const asOf = raw.date ? `${raw.date}T00:00:00.000Z` : new Date().toISOString();
      const built = fromLkrBase(raw.lkr, "currency-api", asOf);
      if (built) return built;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function fetchFromOpenErApi(): Promise<FxRatesPayload | null> {
  try {
    const raw = (await fetchJson("https://open.er-api.com/v6/latest/USD")) as {
      result?: string;
      time_last_update_utc?: string;
      rates?: Record<string, number>;
    };
    if (raw?.result !== "success" || !raw.rates) return null;
    const asOf = raw.time_last_update_utc
      ? new Date(raw.time_last_update_utc).toISOString()
      : new Date().toISOString();
    return fromUsdBase(raw.rates, "open.er-api.com", asOf);
  } catch {
    return null;
  }
}

async function fetchLiveRates(): Promise<FxRatesPayload> {
  const primary = await fetchFromCurrencyApi();
  if (primary) return primary;
  const secondary = await fetchFromOpenErApi();
  if (secondary) return secondary;
  return staticFallback("providers-unavailable");
}

export async function getFxRates(options?: { forceRefresh?: boolean }): Promise<FxRatesPayload> {
  const now = Date.now();
  if (!options?.forceRefresh && cache && cache.expiresAt > now) {
    return cache.payload;
  }

  if (!options?.forceRefresh && inflight) return inflight;

  inflight = (async () => {
    const payload = await fetchLiveRates();
    cache = {
      payload,
      expiresAt: Date.now() + (payload.live ? CACHE_TTL_MS : 15 * 60 * 1000),
    };
    return payload;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function lkrPerUnit(currency: DisplayCurrency, rates: LkrRateTable): number {
  return rates[currency] || rates.USD || LKR_PER_DISPLAY_UNIT.USD;
}
