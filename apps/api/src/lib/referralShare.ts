import type { Request } from "express";
import { config } from "./config.js";

export function buildReferralSharePath(tour: {
  slug: string;
  agency: { slug: string };
} | null | undefined) {
  if (tour?.agency?.slug && tour.slug) {
    return `/tours/${tour.agency.slug}/${tour.slug}`;
  }
  return "/agencies";
}

function isLocalDevHost(value: string) {
  return /localhost|127\.0\.0\.1/i.test(value);
}

/** Public site origin for shareable referral links (never silent localhost on a deployed host). */
export function publicWebOrigin(req?: Request): string {
  const configured = config.webAppUrl.replace(/\/$/, "");
  if (configured && !isLocalDevHost(configured)) return configured;

  const headerOrigin = typeof req?.headers.origin === "string" ? req.headers.origin.trim() : "";
  if (headerOrigin && !isLocalDevHost(headerOrigin)) return headerOrigin.replace(/\/$/, "");

  const referer = typeof req?.headers.referer === "string" ? req.headers.referer : "";
  if (referer) {
    try {
      const origin = new URL(referer).origin;
      if (!isLocalDevHost(origin)) return origin;
    } catch {
      /* ignore malformed referer */
    }
  }

  const xfHost = req?.headers["x-forwarded-host"];
  const hostHeader = (Array.isArray(xfHost) ? xfHost[0] : xfHost) || req?.headers.host || "";
  const host = String(hostHeader).split(",")[0].trim();
  if (host && !isLocalDevHost(host)) {
    const xfProto = req?.headers["x-forwarded-proto"];
    const proto = String(Array.isArray(xfProto) ? xfProto[0] : xfProto || "https")
      .split(",")[0]
      .trim();
    return `${proto}://${host}`;
  }

  return configured || "http://localhost:5173";
}

export function buildReferralShareUrl(
  origin: string,
  tour: { slug: string; agency: { slug: string } } | null | undefined,
  code: string
) {
  const path = buildReferralSharePath(tour);
  return `${origin.replace(/\/$/, "")}${path}?ref=${encodeURIComponent(code)}`;
}
