import { createHash } from "node:crypto";
import { config } from "../lib/config.js";

export type PayHereCheckoutFields = {
  merchant_id: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  order_id: string;
  items: string;
  currency: string;
  amount: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  hash: string;
};

export function payHereConfigured(): boolean {
  return Boolean(config.payhere.merchantId && config.payhere.merchantSecret);
}

export function payHereCheckoutUrl(): string {
  return config.payhere.sandbox
    ? "https://sandbox.payhere.lk/pay/checkout"
    : "https://www.payhere.lk/pay/checkout";
}

/** PayHere checkout hash: MD5(merchant_id + order_id + amount + currency + MD5(merchant_secret)). */
export function buildPayHereHash(input: {
  merchantId: string;
  orderId: string;
  amount: string;
  currency: string;
  merchantSecret: string;
}): string {
  const secretHash = createHash("md5").update(input.merchantSecret).digest("hex").toUpperCase();
  return createHash("md5")
    .update(input.merchantId + input.orderId + input.amount + input.currency + secretHash)
    .digest("hex")
    .toUpperCase();
}

export function buildPayHereCheckoutFields(input: {
  orderId: string;
  amountLkr: number;
  itemTitle: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}): PayHereCheckoutFields | null {
  if (!payHereConfigured()) return null;
  const amount = Number(input.amountLkr).toFixed(2);
  const currency = "LKR";
  const merchantId = config.payhere.merchantId;
  const hash = buildPayHereHash({
    merchantId,
    orderId: input.orderId,
    amount,
    currency,
    merchantSecret: config.payhere.merchantSecret,
  });

  return {
    merchant_id: merchantId,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
    order_id: input.orderId,
    items: input.itemTitle.slice(0, 255),
    currency,
    amount,
    first_name: input.customer.firstName || "Guest",
    last_name: input.customer.lastName || "Traveler",
    email: input.customer.email || "guest@example.com",
    phone: input.customer.phone || "+94000000000",
    address: "N/A",
    city: "Colombo",
    country: "Sri Lanka",
    hash,
  };
}
