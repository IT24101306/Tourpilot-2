import { Link } from "react-router-dom";
import type { AdminStats } from "../../pages/admin/types";
import { AdminHubIcon } from "./AdminHubIcon";
import { HUB_SECTIONS } from "./adminHubConfig";

type Kpi = {
  id: string;
  label: string;
  value: number;
  hint: string;
  tone?: "default" | "accent" | "warn";
  to?: string;
};

type Props = {
  stats: AdminStats;
  userTotal: number;
};

export function AdminCommandHub({ stats, userTotal }: Props) {
  const openInquiries =
    (stats.inquiries.NEW ?? 0) +
    (stats.inquiries.AGENCY_REVIEWING ?? 0) +
    (stats.inquiries.ITINERARY_DRAFT ?? 0);
  const pendingCommissions = stats.commissions.PENDING ?? 0;

  const kpis: Kpi[] = [
    {
      id: "users",
      label: "Total users",
      value: userTotal,
      hint: "All roles on platform",
      to: "/dashboard/admin/users",
    },
    {
      id: "pending",
      label: "Pending agencies",
      value: stats.pendingAgencies,
      hint: "Awaiting your review",
      tone: stats.pendingAgencies > 0 ? "warn" : "default",
      to: "/dashboard/admin/agencies",
    },
    {
      id: "inquiries",
      label: "Open inquiries",
      value: openInquiries,
      hint: "Pre-confirmation pipeline",
      tone: openInquiries > 0 ? "accent" : "default",
      to: "/dashboard/admin/inquiries",
    },
    {
      id: "comm",
      label: "Pending commissions",
      value: pendingCommissions,
      hint: "Partner payouts",
      tone: pendingCommissions > 0 ? "warn" : "default",
      to: "/dashboard/admin/commissions",
    },
    {
      id: "policy",
      label: "Policy flags",
      value: stats.openPolicyViolations ?? 0,
      hint: "Trip chats paused for review",
      tone: (stats.openPolicyViolations ?? 0) > 0 ? "warn" : "default",
      to: "/dashboard/admin/policy-flags",
    },
  ];

  return (
    <div className="gov-command">
      <div className="gov-kpi-row" role="list">
        {kpis.map((k) => {
          const className = `gov-kpi-card gov-kpi-card--${k.tone ?? "default"}`;
          const body = (
            <>
              <span className="gov-kpi-value">{k.value.toLocaleString()}</span>
              <span className="gov-kpi-label">{k.label}</span>
              <span className="gov-kpi-hint">{k.hint}</span>
            </>
          );
          return k.to ? (
            <Link key={k.id} to={k.to} role="listitem" className={`${className} gov-kpi-card--link`}>
              {body}
            </Link>
          ) : (
            <div key={k.id} role="listitem" className={className}>
              {body}
            </div>
          );
        })}
      </div>

      <div className="gov-hubs">
        {HUB_SECTIONS.map((section) => (
          <section
            key={section.id}
            className={`gov-hub-section gov-hub-section--${section.id}`}
            aria-labelledby={`hub-${section.id}`}
          >
            <header className="gov-hub-section__head">
              <div>
                <h3 id={`hub-${section.id}`} className="gov-hub-section-title">
                  {section.title}
                </h3>
                <p className="gov-hub-section-blurb">{section.blurb}</p>
              </div>
            </header>
            <div
              className="gov-hub-module-grid"
              style={{ ["--hub-cols" as string]: String(Math.min(4, section.modules.length)) }}
            >
              {section.modules.map((mod) => {
                const statVal = mod.stat?.(stats);
                const showBadge = statVal !== undefined && Number(statVal) > 0;
                const isPendingAgency =
                  (mod.id === "agencies" && stats.pendingAgencies > 0) ||
                  (mod.id === "policy-flags" && (stats.openPolicyViolations ?? 0) > 0);

                return (
                  <Link
                    key={mod.id}
                    to={mod.to}
                    className={`gov-module-card${isPendingAgency ? " gov-module-card--attention" : ""}`}
                  >
                    <div className="gov-module-card-top">
                      <AdminHubIcon icon={mod.icon} />
                      {showBadge && (
                        <span className="gov-module-badge">{String(statVal)}</span>
                      )}
                    </div>
                    <div className="gov-module-card-body">
                      <strong className="gov-module-title">{mod.title}</strong>
                      <p className="gov-module-desc">{mod.description}</p>
                    </div>
                    <span className="gov-module-arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
