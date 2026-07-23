export type WalletLedgerType =
  | "LOGIN_FEE"
  | "TOPUP"
  | "COMMISSION"
  | "REFUND"
  | "ADJUSTMENT";

export type WalletLedgerEntry = {
  id: string;
  userId: string;
  type: WalletLedgerType;
  amountLkr: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
};

export function walletTxnLabel(type: WalletLedgerType): string {
  switch (type) {
    case "LOGIN_FEE":
      return "Login fee";
    case "TOPUP":
      return "Top up";
    case "COMMISSION":
      return "Commission";
    case "REFUND":
      return "Refund";
    case "ADJUSTMENT":
      return "Adjustment";
    default:
      return type;
  }
}

/** Wallet units shown to users — never a currency code. */
export function formatCredits(amount: number): string {
  return `${Math.round(amount).toLocaleString()} Credits`;
}

export function formatWalletAmount(amount: number): string {
  const prefix = amount >= 0 ? "+" : "−";
  return `${prefix}${Math.abs(amount).toLocaleString()} Credits`;
}
