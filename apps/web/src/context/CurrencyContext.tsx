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
  formatDisplayMoney,
  formatFromLkr,
  isDisplayCurrency,
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

  const isTourist = user?.role === "TOURIST";

  useEffect(() => {
    if (!isTourist) return;
    const preferred = user?.touristProfile?.displayCurrency;
    if (preferred && isDisplayCurrency(preferred)) {
      setCurrencyState(preferred);
      localStorage.setItem(STORAGE_KEY, preferred);
    }
  }, [isTourist, user?.touristProfile?.displayCurrency]);

  const setCurrency = useCallback(
    async (next: DisplayCurrency) => {
      setCurrencyState(next);
      localStorage.setItem(STORAGE_KEY, next);

      if (!isTourist || !token) return;

      setSaving(true);
      try {
        await api("/tourist/me/display-currency", {
          method: "PATCH",
          token,
          body: JSON.stringify({ displayCurrency: next }),
        });
        await refreshUser().catch(() => {});
      } catch (err) {
        console.error(err);
      } finally {
        setSaving(false);
      }
    },
    [isTourist, token, refreshUser]
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      setCurrency,
      format: (amountLkr: number) => formatDisplayMoney(amountLkr, currency),
      formatFrom: (amountLkr: number) => formatFromLkr(amountLkr, currency),
      canChange: isTourist,
      saving,
    }),
    [currency, setCurrency, isTourist, saving]
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
  const { format, formatFrom, currency } = useCurrency();
  return { format, formatFrom, currency };
}
