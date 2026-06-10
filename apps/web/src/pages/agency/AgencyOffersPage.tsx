import { OffersDashboard } from "../../components/offers/OffersDashboard";

export function AgencyOffersPage() {
  return (
    <OffersDashboard
      module="catalog"
      shellClassName="module-shell module-catalog"
      title="Loyalty offers"
      subtitle="Create and edit every part of your special offers — month, image, pricing, registration cap, and reward milestones. Active offers appear on your public display page."
      descriptionPlaceholder="Short details shown on your agency display page and the site Offers page"
      listPath="/agencies/mine/offers"
      toursPath="/tours/agency/mine"
      registrationsPath={(id) => `/agencies/mine/offers/${id}/registrations`}
      updatePath={(id) => `/agencies/mine/offers/${id}`}
      deletePath={(id) => `/agencies/mine/offers/${id}`}
      tourOptionLabel={(t) => `${t.title}${t.isPublished ? "" : " (unpublished)"}`}
      backLink={{ to: "/dashboard/agency", label: "Overview" }}
    />
  );
}
