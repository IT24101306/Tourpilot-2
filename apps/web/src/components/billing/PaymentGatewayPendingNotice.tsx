import "../../styles/account-billing.css";

/** Shown in place of PayHere until online payments are live. */
export const BILLING_ADMIN_CONTACT = {
  company: "IYYO Solutions",
  email: "info@iyyosolutions.com",
  phone: "+94719990173",
  phoneDisplay: "+94 71 999 0173",
  whatsapp: "94720140224",
  whatsappDisplay: "+94 72 014 0224",
  website: "https://iyyosolutions.com",
} as const;

type Props = {
  packageName?: string | null;
  amountLabel?: string | null;
};

export function PaymentGatewayPendingNotice({ packageName, amountLabel }: Props) {
  const c = BILLING_ADMIN_CONTACT;

  return (
    <div className="account-billing-gateway-pending">
      <p className="account-billing-gateway-pending__eyebrow">Payment gateway</p>
      <h2 className="account-billing-gateway-pending__title">
        Contact the system administrator
      </h2>
      <p className="account-billing-gateway-pending__lead">
        Online payments are not available yet. To activate or renew your package, please contact
        the TourPilot system administrator at {c.company}.
      </p>

      {(packageName || amountLabel) && (
        <dl className="account-billing-gateway-pending__plan">
          {packageName ? (
            <div>
              <dt>Package</dt>
              <dd>{packageName}</dd>
            </div>
          ) : null}
          {amountLabel ? (
            <div>
              <dt>Amount</dt>
              <dd>{amountLabel}</dd>
            </div>
          ) : null}
        </dl>
      )}

      <ul className="account-billing-gateway-pending__contacts">
        <li>
          <span>Email</span>
          <a href={`mailto:${c.email}`}>{c.email}</a>
        </li>
        <li>
          <span>Phone</span>
          <a href={`tel:${c.phone}`}>{c.phoneDisplay}</a>
        </li>
        <li>
          <span>WhatsApp</span>
          <a
            href={`https://wa.me/${c.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {c.whatsappDisplay}
          </a>
        </li>
        <li>
          <span>Website</span>
          <a href={c.website} target="_blank" rel="noopener noreferrer">
            iyyosolutions.com
          </a>
        </li>
      </ul>
    </div>
  );
}
