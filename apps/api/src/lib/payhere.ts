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

export function payHereNotConfiguredError() {
  const err = new Error(
    "PayHere is not configured. Set PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET on the API."
  ) as Error & { status: number; code: string };
  err.status = 503;
  err.code = "PAYHERE_NOT_CONFIGURED";
  return err;
}

export function payHereCheckoutUrl(): string {
  return config.payhere.sandbox
    ? "https://sandbox.payhere.lk/pay/checkout"
    : "https://www.payhere.lk/pay/checkout";
}

function secretMd5Upper(): string {
  return createHash("md5").update(config.payhere.merchantSecret).digest("hex").toUpperCase();
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

export function payHereCustomerFromUser(user: {
  name: string;
  email?: string | null;
  phone?: string | null;
}) {
  const parts = (user.name || "Customer").trim().split(/\s+/);
  return {
    firstName: parts[0] || "Customer",
    lastName: parts.slice(1).join(" ") || "Account",
    email: user.email || "",
    phone: user.phone || "",
  };
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

export function requirePayHereCheckoutFields(
  input: Parameters<typeof buildPayHereCheckoutFields>[0]
): PayHereCheckoutFields {
  const fields = buildPayHereCheckoutFields(input);
  if (!fields) throw payHereNotConfiguredError();
  return fields;
}

/**
 * PayHere notify md5sig:
 * MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + MD5(merchant_secret)).
 */
export function verifyPayHereNotify(body: Record<string, unknown>): {
  ok: boolean;
  orderId: string;
  statusCode: string;
  providerPaymentId: string;
} {
  const orderId = String(body.order_id ?? body.orderId ?? "");
  const statusCode = String(body.status_code ?? "");
  const providerPaymentId = String(body.payment_id ?? "");
  const merchantId = String(body.merchant_id ?? "");
  const amount = String(body.payhere_amount ?? "");
  const currency = String(body.payhere_currency ?? "LKR");
  const md5sig = String(body.md5sig ?? "").toUpperCase();

  if (!orderId || !payHereConfigured()) {
    return { ok: false, orderId, statusCode, providerPaymentId };
  }
  if (merchantId && merchantId !== config.payhere.merchantId) {
    return { ok: false, orderId, statusCode, providerPaymentId };
  }
  if (!md5sig) {
    return { ok: false, orderId, statusCode, providerPaymentId };
  }

  const local = createHash("md5")
    .update(merchantId + orderId + amount + currency + statusCode + secretMd5Upper())
    .digest("hex")
    .toUpperCase();

  return { ok: local === md5sig, orderId, statusCode, providerPaymentId };
}
