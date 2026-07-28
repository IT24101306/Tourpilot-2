import {
  AGENCY_BUSINESS_TYPE_LABELS,
  AGENCY_BUSINESS_TYPES,
  AGENCY_ID_TYPES,
  SRI_LANKA_DISTRICTS,
  type AgencyKycInput,
} from "@tourpilot/shared";

type Props = {
  value: AgencyKycInput;
  onChange: (next: AgencyKycInput) => void;
  disabled?: boolean;
};

export function AgencyKycForm({ value, onChange, disabled }: Props) {
  function set<K extends keyof AgencyKycInput>(key: K, val: AgencyKycInput[K]) {
    onChange({ ...value, [key]: val });
  }

  return (
    <div className="agency-kyc-form">
      <p className="agency-kyc-intro muted">
        A short verification form so we can review your agency before you go live on TourPilot.
      </p>

      <fieldset className="agency-kyc-section" disabled={disabled}>
        <legend>Business</legend>
        <div className="agency-kyc-fields">
          <div className="agency-kyc-field agency-kyc-field--full">
            <label htmlFor="kyc-legal-name">Legal business name</label>
            <input
              id="kyc-legal-name"
              value={value.legalBusinessName}
              onChange={(e) => set("legalBusinessName", e.target.value)}
              required
              maxLength={120}
            />
          </div>

          <div className="agency-kyc-field">
            <label htmlFor="kyc-business-type">Business type</label>
            <select
              id="kyc-business-type"
              value={value.businessType}
              onChange={(e) => set("businessType", e.target.value as AgencyKycInput["businessType"])}
              required
            >
              {AGENCY_BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {AGENCY_BUSINESS_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="agency-kyc-field">
            <label htmlFor="kyc-reg-no">Business registration no. (optional)</label>
            <input
              id="kyc-reg-no"
              value={value.registrationNumber ?? ""}
              onChange={(e) => set("registrationNumber", e.target.value)}
              maxLength={60}
              placeholder="PV 12345"
            />
          </div>

          <div className="agency-kyc-field agency-kyc-field--full">
            <label htmlFor="kyc-license">Tourism license no. (optional)</label>
            <input
              id="kyc-license"
              value={value.tourismLicenseNo ?? ""}
              onChange={(e) => set("tourismLicenseNo", e.target.value)}
              maxLength={60}
              placeholder="SLTDA registration if applicable"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="agency-kyc-section" disabled={disabled}>
        <legend>Location & contact</legend>
        <div className="agency-kyc-fields">
          <div className="agency-kyc-field agency-kyc-field--full">
            <label htmlFor="kyc-address">Registered address</label>
            <textarea
              id="kyc-address"
              value={value.registeredAddress}
              onChange={(e) => set("registeredAddress", e.target.value)}
              required
              rows={2}
              minLength={10}
              maxLength={500}
            />
          </div>

          <div className="agency-kyc-field">
            <label htmlFor="kyc-district">District</label>
            <select
              id="kyc-district"
              value={value.district}
              onChange={(e) => set("district", e.target.value)}
              required
            >
              {SRI_LANKA_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="agency-kyc-field">
            <label htmlFor="kyc-email">Business email</label>
            <input
              id="kyc-email"
              type="email"
              value={value.businessEmail}
              onChange={(e) => set("businessEmail", e.target.value)}
              required
              maxLength={120}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="agency-kyc-section" disabled={disabled}>
        <legend>Authorized signatory</legend>
        <div className="agency-kyc-fields">
          <div className="agency-kyc-field">
            <label htmlFor="kyc-id-type">ID type</label>
            <select
              id="kyc-id-type"
              value={value.ownerIdType}
              onChange={(e) => set("ownerIdType", e.target.value as AgencyKycInput["ownerIdType"])}
              required
            >
              {AGENCY_ID_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === "NIC" ? "National ID (NIC)" : "Passport"}
                </option>
              ))}
            </select>
          </div>

          <div className="agency-kyc-field">
            <label htmlFor="kyc-id-number">ID number</label>
            <input
              id="kyc-id-number"
              value={value.ownerIdNumber}
              onChange={(e) => set("ownerIdNumber", e.target.value)}
              required
              maxLength={24}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="agency-kyc-section" disabled={disabled}>
        <legend>Payout account</legend>
        <div className="agency-kyc-fields">
          <div className="agency-kyc-field">
            <label htmlFor="kyc-bank-name">Bank name</label>
            <input
              id="kyc-bank-name"
              value={value.bankName}
              onChange={(e) => set("bankName", e.target.value)}
              required
              maxLength={80}
            />
          </div>

          <div className="agency-kyc-field">
            <label htmlFor="kyc-account-name">Account holder name</label>
            <input
              id="kyc-account-name"
              value={value.bankAccountName}
              onChange={(e) => set("bankAccountName", e.target.value)}
              required
              maxLength={120}
            />
          </div>

          <div className="agency-kyc-field agency-kyc-field--full">
            <label htmlFor="kyc-account-no">Account number</label>
            <input
              id="kyc-account-no"
              value={value.bankAccountNumber}
              onChange={(e) => set("bankAccountNumber", e.target.value.replace(/\D/g, ""))}
              required
              inputMode="numeric"
              pattern="[0-9]{8,30}"
              maxLength={30}
            />
          </div>
        </div>
      </fieldset>

      <label className="agency-kyc-declaration">
        <input
          type="checkbox"
          checked={value.declarationsAccepted}
          onChange={(e) => set("declarationsAccepted", e.target.checked)}
          required
        />
        <span>
          I confirm the information is accurate, I am authorized to register this business, and I
          agree to TourPilot&apos;s partner terms.
        </span>
      </label>
    </div>
  );
}
