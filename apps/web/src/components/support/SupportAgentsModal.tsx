import { useState } from "react";
import { DashboardModal } from "../DashboardModal";
import { SUPPORT_AGENTS } from "../../lib/supportAgents";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SupportAgentsModal({ open, onClose }: Props) {
  return (
    <DashboardModal
      open={open}
      title="TourPilot support"
      subtitle="Choose an agent for simple help, hourly consulting, or full dashboard training. Prices in USD."
      onClose={onClose}
      dialogClassName="support-agents-dialog"
    >
      <ul className="support-agents-list">
        {SUPPORT_AGENTS.map((agent) => (
          <li key={agent.id} className="support-agent-card">
            <div className="support-agent-card__head">
              <div>
                <strong className="support-agent-card__name">{agent.name}</strong>
                <span className="support-agent-card__role muted">{agent.role}</span>
              </div>
              <span className="support-agent-card__price">{agent.priceLabel}</span>
            </div>
            <p className="support-agent-card__service">{agent.service}</p>
            <p className="support-agent-card__desc muted">{agent.description}</p>
            <a href={`tel:${agent.phone}`} className="support-agent-card__phone">
              Call {agent.phoneDisplay}
            </a>
          </li>
        ))}
      </ul>
      <p className="support-agents-foot muted">
        Available weekdays 9:00–18:00 (SLST). Mention your agency or partner account when you call.
      </p>
    </DashboardModal>
  );
}

export function DashboardSupportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="dashboard-support-btn" onClick={() => setOpen(true)}>
        Support
      </button>
      <SupportAgentsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
