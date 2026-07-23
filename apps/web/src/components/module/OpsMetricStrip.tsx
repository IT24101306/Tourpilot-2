import { Link } from "react-router-dom";

type Metric = {
  id: string;
  label: string;
  value: number | string;
  hint: string;
  active?: boolean;
  onClick?: () => void;
  /** When set, card navigates like a link (takes precedence over onClick). */
  href?: string;
};

type Props = {
  metrics: Metric[];
};

export function OpsMetricStrip({ metrics }: Props) {
  return (
    <div className="ops-metric-strip" role="list">
      {metrics.map((m) => {
        const className = `ops-metric-card${m.active ? " active" : ""}${
          m.href || m.onClick ? " ops-metric-card--interactive" : ""
        }`;
        const body = (
          <>
            <span className="ops-metric-value">{m.value}</span>
            <span className="ops-metric-label">{m.label}</span>
            <span className="ops-metric-hint">{m.hint}</span>
          </>
        );

        if (m.href) {
          return (
            <Link key={m.id} to={m.href} role="listitem" className={className}>
              {body}
            </Link>
          );
        }

        if (m.onClick) {
          return (
            <button
              key={m.id}
              type="button"
              role="listitem"
              className={className}
              onClick={m.onClick}
            >
              {body}
            </button>
          );
        }

        return (
          <div key={m.id} role="listitem" className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
