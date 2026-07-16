import type { NextFunction, Request, Response } from "express";
import { getAgencyForUser } from "../middleware/auth.js";

export type AgencyFeatureKey =
  | "driversAndPartners"
  | "support"
  | "walletTopup"
  | "offers"
  | "display"
  | "readyMadeTours"
  | "customInquiries"
  | "negotiationsBookings";

export type AgencyFeatures = Record<AgencyFeatureKey, boolean>;

type AgencyFeatureSource = {
  featureDriversAndPartners?: boolean;
  featureSupport?: boolean;
  featureWalletTopup?: boolean;
  featureOffers?: boolean;
  featureDisplay?: boolean;
  featureReadyMadeTours?: boolean;
  featureCustomInquiries?: boolean;
  featureNegotiationsBookings?: boolean;
};

export function serializeAgencyFeatures(agency: AgencyFeatureSource | null | undefined): AgencyFeatures {
  return {
    driversAndPartners: agency?.featureDriversAndPartners ?? true,
    support: agency?.featureSupport ?? true,
    walletTopup: agency?.featureWalletTopup ?? true,
    offers: agency?.featureOffers ?? true,
    display: agency?.featureDisplay ?? true,
    readyMadeTours: agency?.featureReadyMadeTours ?? true,
    customInquiries: agency?.featureCustomInquiries ?? true,
    negotiationsBookings: agency?.featureNegotiationsBookings ?? true,
  };
}

export function agencyFeatureDbFields(features: Partial<AgencyFeatures>) {
  const data: Partial<{
    featureDriversAndPartners: boolean;
    featureSupport: boolean;
    featureWalletTopup: boolean;
    featureOffers: boolean;
    featureDisplay: boolean;
    featureReadyMadeTours: boolean;
    featureCustomInquiries: boolean;
    featureNegotiationsBookings: boolean;
  }> = {};
  if (features.driversAndPartners !== undefined) {
    data.featureDriversAndPartners = features.driversAndPartners;
  }
  if (features.support !== undefined) data.featureSupport = features.support;
  if (features.walletTopup !== undefined) data.featureWalletTopup = features.walletTopup;
  if (features.offers !== undefined) data.featureOffers = features.offers;
  if (features.display !== undefined) data.featureDisplay = features.display;
  if (features.readyMadeTours !== undefined) {
    data.featureReadyMadeTours = features.readyMadeTours;
  }
  if (features.customInquiries !== undefined) {
    data.featureCustomInquiries = features.customInquiries;
  }
  if (features.negotiationsBookings !== undefined) {
    data.featureNegotiationsBookings = features.negotiationsBookings;
  }
  return data;
}

const FEATURE_LABELS: Record<AgencyFeatureKey, string> = {
  driversAndPartners: "Drivers and Partners",
  support: "Support",
  walletTopup: "Wallet topup",
  offers: "Offers",
  display: "Display",
  readyMadeTours: "Ready-made tours",
  customInquiries: "Custom tour inquiries",
  negotiationsBookings: "Negotiations and bookings",
};

/** Returns an Express-ready error payload when the agency feature is disabled. */
export async function assertAgencyFeature(
  userId: string,
  feature: AgencyFeatureKey
): Promise<{ status: number; error: string } | null> {
  const agency = await getAgencyForUser(userId);
  if (!agency) return { status: 404, error: "Agency not found" };
  const features = serializeAgencyFeatures(agency);
  if (!features[feature]) {
    return {
      status: 403,
      error: `${FEATURE_LABELS[feature]} is disabled for this agency. Contact TourPilot admin.`,
    };
  }
  return null;
}

export function requireAgencyFeature(feature: AgencyFeatureKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const denied = await assertAgencyFeature(req.user.id, feature);
      if (denied) return res.status(denied.status).json({ error: denied.error });
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** Check a feature on an agency row (e.g. public / tourist flows by agencyId). */
export function agencyHasFeature(
  agency: AgencyFeatureSource | null | undefined,
  feature: AgencyFeatureKey
): boolean {
  return serializeAgencyFeatures(agency)[feature];
}
