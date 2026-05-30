import { z } from "zod";
import {
  AGENCY_BUSINESS_TYPES,
  AGENCY_ID_TYPES,
  SRI_LANKA_DISTRICTS,
  type AgencyKycInput,
  type AgencyKycRecord,
} from "@tourpilot/shared";

const districtSchema = z.enum(SRI_LANKA_DISTRICTS as unknown as [string, ...string[]]);

export const agencyKycBodySchema = z.object({
  legalBusinessName: z.string().trim().min(2).max(120),
  businessType: z.enum(AGENCY_BUSINESS_TYPES),
  registrationNumber: z.string().trim().max(60).optional().or(z.literal("")),
  registeredAddress: z.string().trim().min(10).max(500),
  district: districtSchema,
  businessEmail: z.string().trim().email().max(120),
  tourismLicenseNo: z.string().trim().max(60).optional().or(z.literal("")),
  ownerIdType: z.enum(AGENCY_ID_TYPES),
  ownerIdNumber: z.string().trim().min(5).max(24),
  bankAccountName: z.string().trim().min(2).max(120),
  bankName: z.string().trim().min(2).max(80),
  bankAccountNumber: z
    .string()
    .trim()
    .min(8)
    .max(30)
    .regex(/^[0-9]+$/, "Bank account number must contain digits only"),
  declarationsAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must confirm the declarations" }),
  }),
});

export function parseAgencyKyc(data: unknown): AgencyKycInput {
  const parsed = agencyKycBodySchema.parse(data);
  return {
    legalBusinessName: parsed.legalBusinessName,
    businessType: parsed.businessType,
    registrationNumber: parsed.registrationNumber || undefined,
    registeredAddress: parsed.registeredAddress,
    district: parsed.district,
    businessEmail: parsed.businessEmail,
    tourismLicenseNo: parsed.tourismLicenseNo || undefined,
    ownerIdType: parsed.ownerIdType,
    ownerIdNumber: parsed.ownerIdNumber,
    bankAccountName: parsed.bankAccountName,
    bankName: parsed.bankName,
    bankAccountNumber: parsed.bankAccountNumber,
    declarationsAccepted: true,
  };
}

export function buildAgencyKycRecord(input: AgencyKycInput): AgencyKycRecord {
  return {
    ...input,
    submittedAt: new Date().toISOString(),
  };
}
