import { TransportVehicleIcon } from "../icons/LineIcons";
import { AGENCY_TRANSPORT_OPTIONS, type TransportOption } from "./transportOptions";

type Props = {
  agencyName?: string;
  options?: TransportOption[];
};

export function AgencyTransportSection({ agencyName, options = AGENCY_TRANSPORT_OPTIONS }: Props) {
  return (
    <section className="agency-section agency-transport-section" id="transport">
      <div className="agency-transport-head">
        <div className="agency-display-section-head agency-transport-section-head">
          <h2>Transport</h2>
          <p>
            {agencyName
              ? `Vehicle options with ${agencyName}.`
              : "Vehicle options for every group size."}
          </p>
        </div>
      </div>

      <div className="agency-transport-grid">
        {options.map((option, index) => (
          <article key={`${option.id}-${index}`} className="agency-transport-card">
            <div className="agency-transport-card__icon-wrap" aria-hidden="true">
              <TransportVehicleIcon vehicleId={option.id} size={40} />
            </div>

            <div className="agency-transport-card__body">
              <div className="agency-transport-card__title-row">
                <h3 className="agency-transport-card__title">{option.name}</h3>
                {option.variant ? (
                  <span className="agency-transport-card__variant">{option.variant}</span>
                ) : null}
              </div>
              <p className="agency-transport-card__desc">{option.description}</p>
              <p className="agency-transport-card__meta">
                Seats: {option.seating}
                <span aria-hidden="true"> · </span>
                Luggage: {option.luggage}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
