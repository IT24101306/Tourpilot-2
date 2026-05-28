import { Link } from "react-router-dom";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { GrowthJourney } from "../../components/influencer/GrowthJourney";

export function InfluencerGuidePage() {
  return (
    <div className="module-shell module-partner">
      <ModuleHeader
        module="partner"
        title="Partner playbook"
        subtitle="Everything you need to promote Sri Lanka tours and get paid fairly."
      >
        <Link to="/dashboard/influencer/tours" className="btn btn-primary">
          Start promoting
        </Link>
      </ModuleHeader>

      <GrowthJourney />

      <section className="partner-faq">
        <h3 className="partner-faq-title">Quick answers</h3>
        <dl className="partner-faq-list">
          <div>
            <dt>When do I earn?</dt>
            <dd>
              After a tourist inquires using your link and the agency sends them a custom itinerary
              — commission is created at your agreed percentage.
            </dd>
          </div>
          <div>
            <dt>How are clicks tracked?</dt>
            <dd>
              Opening your referral URL records a click. The tourist should complete their inquiry
              in the same browser session when possible.
            </dd>
          </div>
          <div>
            <dt>One code per tour?</dt>
            <dd>
              Each ready-made tour can have one active referral code. Create a new code if you need
              a different commission rate or branding.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
