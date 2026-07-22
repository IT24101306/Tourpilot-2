import { useEffect, useState } from "react";
import {
  DEFAULT_SUPPORT_CONTENT,
  type SupportContent,
} from "@tourpilot/shared";
import { DashboardModal } from "../DashboardModal";
import { api } from "../../api/client";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SupportAgentsModal({ open, onClose }: Props) {
  const [content, setContent] = useState<SupportContent>(DEFAULT_SUPPORT_CONTENT);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api<SupportContent>("/support")
      .then((data) => {
        if (!cancelled) setContent(data);
      })
      .catch(() => {
        if (!cancelled) setContent(DEFAULT_SUPPORT_CONTENT);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <DashboardModal
      open={open}
      title={content.title}
      subtitle={content.subtitle}
      onClose={onClose}
      dialogClassName="support-agents-dialog"
    >
      <ul className="support-agents-list">
        {content.agents.map((agent) => (
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
      <p className="support-agents-foot muted">{content.footer}</p>
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
