import { TransportVehicleIcon } from "../icons/LineIcons";
import { AGENCY_TRANSPORT_OPTIONS } from "./transportOptions";

type Props = {
  agencyName?: string;
};

export function AgencyTransportSection({ agencyName }: Props) {
  return (
    <section className="agency-section agency-transport-section" id="transport">
      <div className="agency-transport-head">
        <div className="agency-display-section-head agency-transport-section-head">
          <h2>Transport</h2>
          <p>
            {agencyName
              ? `Choose how you travel with ${agencyName} — from couples to full coach groups.`
              : "Vehicle options for every group size across Sri Lanka."}
          </p>
        </div>
      </div>

      <div className="agency-transport-grid">
        {AGENCY_TRANSPORT_OPTIONS.map((option) => (
          <article key={option.id} className="agency-transport-card">
            <div className="agency-transport-card__icon-wrap" aria-hidden="true">
              <TransportVehicleIcon vehicleId={option.id} size={34} />
            </div>

            <div className="agency-transport-card__body">
              <div className="agency-transport-card__title-row">
                <h3 className="agency-transport-card__title">{option.name}</h3>
                {option.variant ? (
                  <span className="agency-transport-card__variant brand-pill brand-pill--teal">
                    {option.variant}
                  </span>
                ) : null}
              </div>
              <p className="agency-transport-card__desc">{option.description}</p>

              <div className="agency-transport-card__chips">
                <span className="agency-transport-chip">
                  <span className="agency-transport-chip__label">Seats</span>
                  <span className="agency-transport-chip__value">{option.seating}</span>
                </span>
                <span className="agency-transport-chip">
                  <span className="agency-transport-chip__label">Luggage</span>
                  <span className="agency-transport-chip__value">{option.luggage}</span>
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
