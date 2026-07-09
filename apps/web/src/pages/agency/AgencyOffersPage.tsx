import { OffersDashboard } from "../../components/offers/OffersDashboard";

export function AgencyOffersPage() {
  return (
    <OffersDashboard
      module="catalog"
      shellClassName="module-shell module-catalog"
      title="Loyalty offers"
      subtitle="Create and edit every part of your special offers — month, image, pricing, registration cap, and reward milestones. Travelers choose a readymade tour when they register."
      descriptionPlaceholder="Short details shown on your agency display page and the site Offers page"
      listPath="/agencies/mine/offers"
      registrationsPath={(id) => `/agencies/mine/offers/${id}/registrations`}
      updatePath={(id) => `/agencies/mine/offers/${id}`}
      deletePath={(id) => `/agencies/mine/offers/${id}`}
      backLink={{ to: "/dashboard/agency", label: "Overview" }}
    />
  );
}
