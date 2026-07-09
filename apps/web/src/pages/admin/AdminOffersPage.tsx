import { OffersDashboard } from "../../components/offers/OffersDashboard";

export function AdminOffersPage() {
  return (
    <OffersDashboard
      module="governance"
      shellClassName="module-shell module-governance"
      title="Loyalty offers"
      subtitle="Configure caps, pricing, and monitor registrations. Travelers pick a readymade tour when they register."
      descriptionPlaceholder="Short details shown on Offers page"
      listPath="/offers"
      registrationsPath={(id) => `/admin/offers/${id}/registrations`}
      updatePath={(id) => `/offers/${id}`}
      deletePath={(id) => `/offers/${id}`}
      backLink={{ to: "/dashboard/admin", label: "Overview" }}
    />
  );
}
