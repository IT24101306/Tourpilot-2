import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type DisplayCurrency,
  type FxRatesPayload,
  type LkrRateTable,
  formatDisplayMoney,
  formatFromLkr,
  isDisplayCurrency,
  resolveLkrRates,
} from "@tourpilot/shared";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

const STORAGE_KEY = "tourpilot_display_currency";
const DEFAULT_CURRENCY: DisplayCurrency = "USD";

type CurrencyContextValue = {
  currency: DisplayCurrency;
  setCurrency: (next: DisplayCurrency) => void;
  format: (amountLkr: number) => string;
  formatFrom: (amountLkr: number) => string;
  rates: LkrRateTable;
  fx: FxRatesPayload | null;
  ratesLoading: boolean;
  refreshRates: () => Promise<void>;
  canChange: boolean;
  saving: boolean;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function readStoredCurrency(): DisplayCurrency {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isDisplayCurrency(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_CURRENCY;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user, token, refreshUser } = useAuth();
  const [currency, setCurrencyState] = useState<DisplayCurrency>(readStoredCurrency);
  const [saving, setSaving] = useState(false);
  const [fx, setFx] = useState<FxRatesPayload | null>(null);
  const [ratesLoading, setRatesLoading] = useState(true);

  const isTourist = user?.role === "TOURIST";

  const refreshRates = useCallback(async () => {
    setRatesLoading(true);
    try {
      const payload = await api<FxRatesPayload>("/fx/rates");
      setFx(payload);
    } catch (err) {
      console.error(err);
      // Keep previous / fall back via resolveLkrRates(null)
    } finally {
      setRatesLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshRates();
    const id = window.setInterval(() => void refreshRates(), 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [refreshRates]);

  const setCurrency = useCallback(
    async (next: DisplayCurrency) => {
      setCurrencyState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }

      if (!isTourist || !token) return;

      setSaving(true);
      try {
        await api("/tourist/me/display-currency", {
          method: "PATCH",
          token,
          body: JSON.stringify({ displayCurrency: next }),
        });
        // Keep preference even if /auth/me is briefly stale.
        await refreshUser().catch(() => {});
      } catch (err) {
        console.error(err);
      } finally {
        setSaving(false);
      }
    },
    [isTourist, token, refreshUser]
  );

  // Profile is source of truth when present, but never clobber a fresher local choice
  // with a missing/default value during the save round-trip.
  useEffect(() => {
    if (!isTourist) return;
    const preferred = user?.touristProfile?.displayCurrency;
    if (!preferred || !isDisplayCurrency(preferred)) return;
    setCurrencyState((current) => {
      if (current === preferred) return current;
      const stored = readStoredCurrency();
      // If localStorage already matches what the user just picked, keep it until profile catches up.
      if (stored === current && preferred === DEFAULT_CURRENCY && current !== DEFAULT_CURRENCY) {
        return current;
      }
      try {
        localStorage.setItem(STORAGE_KEY, preferred);
      } catch {
        /* ignore */
      }
      return preferred;
    });
  }, [isTourist, user?.touristProfile?.displayCurrency]);

  const rates = useMemo(() => resolveLkrRates(fx?.rates), [fx]);

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      setCurrency,
      format: (amountLkr: number) => formatDisplayMoney(amountLkr, currency, rates),
      formatFrom: (amountLkr: number) => formatFromLkr(amountLkr, currency, rates),
      rates,
      fx,
      ratesLoading,
      refreshRates,
      canChange: true,
      saving,
    }),
    [currency, setCurrency, rates, fx, ratesLoading, refreshRates, saving]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return ctx;
}

export function useFormatMoney() {
  const { format, formatFrom, currency, rates } = useCurrency();
  return { format, formatFrom, currency, rates };
}
