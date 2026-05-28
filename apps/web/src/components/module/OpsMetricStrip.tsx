type Metric = {
  id: string;
  label: string;
  value: number;
  hint: string;
  active?: boolean;
  onClick?: () => void;
};

type Props = {
  metrics: Metric[];
};

export function OpsMetricStrip({ metrics }: Props) {
  return (
    <div className="ops-metric-strip" role="list">
      {metrics.map((m) => {
        const Tag = m.onClick ? "button" : "div";
        return (
          <Tag
            key={m.id}
            type={m.onClick ? "button" : undefined}
            role="listitem"
            className={`ops-metric-card${m.active ? " active" : ""}`}
            onClick={m.onClick}
          >
            <span className="ops-metric-value">{m.value}</span>
            <span className="ops-metric-label">{m.label}</span>
            <span className="ops-metric-hint">{m.hint}</span>
          </Tag>
        );
      })}
    </div>
  );
}
