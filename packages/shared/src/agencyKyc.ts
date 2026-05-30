export const AGENCY_BUSINESS_TYPES = [
  "SOLE_PROPRIETOR",
  "PARTNERSHIP",
  "PRIVATE_LIMITED",
  "OTHER",
] as const;

export type AgencyBusinessType = (typeof AGENCY_BUSINESS_TYPES)[number];

export const AGENCY_ID_TYPES = ["NIC", "PASSPORT"] as const;
export type AgencyIdType = (typeof AGENCY_ID_TYPES)[number];

export const SRI_LANKA_DISTRICTS = [
  "Ampara",
  "Anuradhapura",
  "Badulla",
  "Batticaloa",
  "Colombo",
  "Galle",
  "Gampaha",
  "Hambantota",
  "Jaffna",
  "Kalutara",
  "Kandy",
  "Kegalle",
  "Kilinochchi",
  "Kurunegala",
  "Mannar",
  "Matale",
  "Matara",
  "Monaragala",
  "Mullaitivu",
  "Nuwara Eliya",
  "Polonnaruwa",
  "Puttalam",
  "Ratnapura",
  "Trincomalee",
  "Vavuniya",
] as const;

export type AgencyKycInput = {
  legalBusinessName: string;
  businessType: AgencyBusinessType;
  registrationNumber?: string;
  registeredAddress: string;
  district: string;
  businessEmail: string;
  tourismLicenseNo?: string;
  ownerIdType: AgencyIdType;
  ownerIdNumber: string;
  bankAccountName: string;
  bankName: string;
  bankAccountNumber: string;
  declarationsAccepted: boolean;
};

export type AgencyKycRecord = AgencyKycInput & {
  submittedAt: string;
};

export const AGENCY_BUSINESS_TYPE_LABELS: Record<AgencyBusinessType, string> = {
  SOLE_PROPRIETOR: "Sole proprietor",
  PARTNERSHIP: "Partnership",
  PRIVATE_LIMITED: "Private limited company",
  OTHER: "Other",
};

export function agencyBusinessTypeLabel(type: AgencyBusinessType): string {
  return AGENCY_BUSINESS_TYPE_LABELS[type] ?? type;
}

export function defaultAgencyKyc(partial?: {
  legalBusinessName?: string;
  businessEmail?: string;
}): AgencyKycInput {
  return {
    legalBusinessName: partial?.legalBusinessName ?? "",
    businessType: "SOLE_PROPRIETOR",
    registrationNumber: "",
    registeredAddress: "",
    district: "Colombo",
    businessEmail: partial?.businessEmail ?? "",
    tourismLicenseNo: "",
    ownerIdType: "NIC",
    ownerIdNumber: "",
    bankAccountName: "",
    bankName: "",
    bankAccountNumber: "",
    declarationsAccepted: false,
  };
}
