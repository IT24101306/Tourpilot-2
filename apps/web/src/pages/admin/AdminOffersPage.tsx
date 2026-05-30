import { OffersDashboard } from "../../components/offers/OffersDashboard";

export function AdminOffersPage() {
  return (
    <OffersDashboard
      module="governance"
      shellClassName="module-shell module-governance"
      title="Loyalty offers"
      subtitle="Configure caps, pricing, tour eligibility, and monitor registrations."
      descriptionPlaceholder="Short details shown on Offers page"
      listPath="/offers"
      toursPath="/tours/admin/all"
      registrationsPath={(id) => `/admin/offers/${id}/registrations`}
      updatePath={(id) => `/offers/${id}`}
      deletePath={(id) => `/offers/${id}`}
      tourOptionLabel={(t) =>
        `${t.title} — ${t.agency?.name ?? "Agency"}${t.isPublished ? "" : " (unpublished)"}`
      }
      backLink={{ to: "/dashboard/admin", label: "Overview" }}
    />
  );
}
