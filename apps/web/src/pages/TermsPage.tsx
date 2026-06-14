import { Link } from "react-router-dom";

export function TermsPage() {
  return (
    <section className="section legal-page">
      <div className="legal-page__inner">
        <p className="legal-page__back">
          <Link to="/register">← Back to sign up</Link>
        </p>
        <h1>Terms &amp; Conditions</h1>
        <p className="muted legal-page__updated">Last updated: June 2026</p>

        <div className="legal-page__body">
          <h2>1. Using TourPilot</h2>
          <p>
            TourPilot connects travelers with licensed tour operators, influencers, and service
            providers in Sri Lanka. By creating an account you agree to use the platform lawfully and
            provide accurate information.
          </p>

          <h2>2. Accounts &amp; verification</h2>
          <p>
            You are responsible for activity on your account. Phone verification via OTP is required.
            Professional accounts may be subject to additional review before going live.
          </p>

          <h2>3. Bookings &amp; payments</h2>
          <p>
            Prices, itineraries, and offers are provided by agencies. TourPilot facilitates discovery
            and communication; payment terms between you and the agency apply unless stated otherwise
            on a specific offer or booking.
          </p>

          <h2>4. Wallet &amp; fees</h2>
          <p>
            Some account types may incur platform login or service fees debited from your in-app
            wallet. Top-ups and ledger entries are recorded in your profile.
          </p>

          <h2>5. Content &amp; conduct</h2>
          <p>
            Do not post misleading, offensive, or infringing content. Agencies warrant they have
            rights to photos and descriptions they upload.
          </p>

          <h2>6. Limitation of liability</h2>
          <p>
            TourPilot is not liable for travel disruptions, third-party conduct, or force majeure.
            To the extent permitted by law, our liability is limited to fees paid to TourPilot in the
            prior twelve months.
          </p>

          <h2>7. Changes</h2>
          <p>
            We may update these terms. Continued use after changes constitutes acceptance. Material
            updates will be highlighted in the app where practical.
          </p>

          <h2>8. Contact</h2>
          <p>
            Questions: support@tourpilot.app
          </p>
        </div>
      </div>
    </section>
  );
}
