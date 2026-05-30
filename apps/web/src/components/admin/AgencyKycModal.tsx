import type { AgencyKycRecord } from "@tourpilot/shared";
import { agencyBusinessTypeLabel } from "@tourpilot/shared";

type Props = {
  agencyName: string;
  kyc: AgencyKycRecord | null;
  open: boolean;
  onClose: () => void;
};

function Row({ label, value }: { label: string; value: string | undefined | null }) {
  if (!value) return null;
  return (
    <div className="agency-kyc-modal-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function AgencyKycModal({ agencyName, kyc, open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="gov-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="gov-modal agency-kyc-modal"
        role="dialog"
        aria-labelledby="agency-kyc-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="agency-kyc-modal-head">
          <h2 id="agency-kyc-title">KYC — {agencyName}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </header>

        {!kyc ? (
          <p className="muted">No KYC data on file.</p>
        ) : (
          <dl className="agency-kyc-modal-grid">
            <Row label="Legal name" value={kyc.legalBusinessName} />
            <Row label="Business type" value={agencyBusinessTypeLabel(kyc.businessType)} />
            <Row label="Registration no." value={kyc.registrationNumber} />
            <Row label="Tourism license" value={kyc.tourismLicenseNo} />
            <Row label="Address" value={kyc.registeredAddress} />
            <Row label="District" value={kyc.district} />
            <Row label="Business email" value={kyc.businessEmail} />
            <Row label="ID type" value={kyc.ownerIdType} />
            <Row label="ID number" value={kyc.ownerIdNumber} />
            <Row label="Bank" value={kyc.bankName} />
            <Row label="Account name" value={kyc.bankAccountName} />
            <Row label="Account number" value={kyc.bankAccountNumber} />
            <Row
              label="Submitted"
              value={kyc.submittedAt ? new Date(kyc.submittedAt).toLocaleString() : undefined}
            />
          </dl>
        )}
      </div>
    </div>
  );
}
