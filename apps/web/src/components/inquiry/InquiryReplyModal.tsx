import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../api/client";
import { DashboardModal, ModalActions, ModalField } from "../DashboardModal";
import { InquiryThread, type ThreadMessage } from "./InquiryThread";
import { TourFormModal } from "../tour/TourFormModal";
import {
  buildItineraryFromTourForm,
  defaultTourForm,
  type EntityOption,
  type GroupOption,
  type ItineraryPayload,
  type TourFormState,
} from "../tour/tourFormTypes";

type TourOption = {
  id: string;
  title: string;
  days: number;
  tourKind: string;
  isPublished: boolean;
  basePriceLkr?: number;
};

type ProposalItem = {
  id: string;
  kind: string;
  tour?: TourOption | null;
  itinerary?: {
    id: string;
    title: string | null;
    grandMax: number;
    shareToken: string | null;
    days?: Array<{
      dayNumber: number;
      title: string | null;
      lineItems: Array<{
        label: string;
        kind: string;
        priceLkr: number | null;
        entity?: { name: string } | null;
      }>;
    }>;
  } | null;
};

type InquiryDetail = {
  id: string;
  status: string;
  type: string;
  pax: number;
  message: string | null;
  budgetBand: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  proposalEditable?: boolean;
  tourist?: { name: string; phone: string };
  tour?: { title: string } | null;
  proposal?: {
    id: string;
    message: string;
    items: ProposalItem[];
  } | null;
  thread?: ThreadMessage[];
};

type DraftCustom = {
  key: string;
  title: string;
  itinerary: ItineraryPayload;
};

type Props = {
  open: boolean;
  token: string;
  inquiryId: string | null;
  entities: EntityOption[];
  groups: GroupOption[];
  onClose: () => void;
  onSent: () => void;
};

export function InquiryReplyModal({
  open,
  token,
  inquiryId,
  entities,
  groups,
  onClose,
  onSent,
}: Props) {
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [tours, setTours] = useState<TourOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [message, setMessage] = useState("");
  const [selectedTourIds, setSelectedTourIds] = useState<Set<string>>(new Set());
  const [customDrafts, setCustomDrafts] = useState<DraftCustom[]>([]);

  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customForm, setCustomForm] = useState<TourFormState>(defaultTourForm());
  const [customFormStatus, setCustomFormStatus] = useState("");
  const [editingCustomKey, setEditingCustomKey] = useState<string | null>(null);

  const readyMadeTours = useMemo(
    () => tours.filter((t) => t.tourKind === "READY_MADE" && t.isPublished),
    [tours]
  );

  const isEditing = Boolean(inquiry?.proposal);
  const canEdit = inquiry?.proposalEditable !== false;

  useEffect(() => {
    if (!open || !inquiryId || !token) return;
    setLoading(true);
    setError("");
    Promise.all([
      api<InquiryDetail>(`/inquiries/${inquiryId}`, { token }),
      api<TourOption[]>("/tours/agency/mine", { token }),
    ])
      .then(([inq, tourList]) => {
        setInquiry(inq);
        setTours(tourList);

        const proposal = inq.proposal;
        if (proposal) {
          setMessage(proposal.message);
          const tourIds = new Set(
            proposal.items.filter((i) => i.kind === "READY_MADE" && i.tour).map((i) => i.tour!.id)
          );
          setSelectedTourIds(tourIds);
          setCustomDrafts(
            proposal.items
              .filter((i) => i.kind === "CUSTOM" && i.itinerary)
              .map((i) => ({
                key: i.id,
                title: i.itinerary!.title || "Custom itinerary",
                itinerary: {
                  title: i.itinerary!.title || "Custom itinerary",
                  days: (i.itinerary!.days || []).map((d) => ({
                    dayNumber: d.dayNumber,
                    title: d.title || `Day ${d.dayNumber}`,
                    items: d.lineItems.map((li) => ({
                      label: li.label,
                      kind: (li.kind as "REQUIRED" | "OPTIONAL" | "UPGRADE") || "REQUIRED",
                      priceLkr: li.priceLkr,
                    })),
                  })),
                },
              }))
          );
        } else {
          setMessage("");
          setSelectedTourIds(new Set());
          setCustomDrafts([]);
        }
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load inquiry");
      })
      .finally(() => setLoading(false));
  }, [open, inquiryId, token]);

  function toggleTour(id: string) {
    setSelectedTourIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCustomModal(existing?: DraftCustom) {
    if (existing) {
      setEditingCustomKey(existing.key);
      setCustomForm({ ...defaultTourForm(), title: existing.title });
      setCustomFormStatus("Re-build this custom tour using the planner below, then save to replace it.");
    } else {
      setEditingCustomKey(null);
      setCustomForm(defaultTourForm());
      setCustomFormStatus("");
    }
    setCustomModalOpen(true);
  }

  function saveCustomToProposal(e: FormEvent) {
    e.preventDefault();
    const invalidDay = customForm.days.find(
      (d) => !d.entries.some((entry) => entry.time && entry.entityId)
    );
    if (invalidDay) {
      setCustomFormStatus(`Day ${invalidDay.dayNumber} needs at least one timed entity.`);
      return;
    }

    const itinerary = buildItineraryFromTourForm(customForm, entities);
    if (!itinerary.days.length) {
      setCustomFormStatus("Add at least one activity to the custom tour.");
      return;
    }

    const draft: DraftCustom = {
      key: editingCustomKey || crypto.randomUUID(),
      title: itinerary.title,
      itinerary,
    };

    if (editingCustomKey) {
      setCustomDrafts((prev) => prev.map((d) => (d.key === editingCustomKey ? draft : d)));
    } else {
      setCustomDrafts((prev) => [...prev, draft]);
    }

    setCustomModalOpen(false);
    setEditingCustomKey(null);
    setCustomForm(defaultTourForm());
    setCustomFormStatus("");
  }

  function removeCustom(key: string) {
    setCustomDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!inquiryId || !message.trim()) return;

    if (selectedTourIds.size === 0 && customDrafts.length === 0) {
      setError("Select at least one ready-made tour or add a custom itinerary.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await api(`/inquiries/${inquiryId}/proposal`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          message: message.trim(),
          readyMadeTourIds: Array.from(selectedTourIds),
          customItineraries: customDrafts.map((d) => d.itinerary),
        }),
      });

      onSent();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send proposal");
    } finally {
      setSaving(false);
    }
  }

  const totalSelections = selectedTourIds.size + customDrafts.length;

  return (
    <>
      <DashboardModal
        open={open && !customModalOpen}
        title={
          inquiry?.status === "REVISION_REQUESTED"
            ? "Update proposal after tourist feedback"
            : isEditing
              ? "Edit proposal to tourist"
              : "Reply to inquiry"
        }
        subtitle={
          inquiry
            ? `${inquiry.tourist?.name || "Guest"} · ${
                inquiry.status === "REVISION_REQUESTED"
                  ? "Tourist requested changes — review the thread, edit tours below, then resend"
                  : canEdit
                    ? "Tourist has not accepted yet — you can change tours anytime"
                    : "Locked after tourist response"
              }`
            : undefined
        }
        onClose={onClose}
        dialogClassName="inquiry-reply-dialog"
      >
        {loading && <p className="muted">Loading inquiry…</p>}
        {error && (
          <p className="driver-status" style={{ color: "#9b1c1c" }}>
            {error}
          </p>
        )}

        {inquiry && !loading && (
          <>
            <div className="inquiry-request-box">
              <p>
                <strong>Request</strong> · {inquiry.pax} travelers ·{" "}
                {inquiry.type.replace("_", " ")}
              </p>
              {inquiry.startDate && (
                <p className="muted">
                  Dates: {formatDate(inquiry.startDate)}
                  {inquiry.endDate ? ` – ${formatDate(inquiry.endDate)}` : ""}
                </p>
              )}
              {inquiry.budgetBand && <p className="muted">Budget: {inquiry.budgetBand}</p>}
              <p className="inquiry-request-message">{inquiry.message || "No message provided."}</p>
            </div>

            {inquiry.thread && inquiry.thread.length > 0 && (
              <InquiryThread messages={inquiry.thread} />
            )}

            {!canEdit ? (
              <p className="muted">This inquiry is closed and can no longer be edited.</p>
            ) : (
              <form onSubmit={submit}>
                <div className="entity-form-grid">
                  <ModalField label="Message to the tourist" full>
                    <textarea
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Thank you for your inquiry. Here are tour options we recommend…"
                      required
                    />
                  </ModalField>
                </div>

                <div className="inquiry-proposal-section">
                  <h4>Ready-made tours (select one or more)</h4>
                  {readyMadeTours.length === 0 ? (
                    <p className="muted">No published ready-made tours. Create them under Tours.</p>
                  ) : (
                    <ul className="inquiry-tour-pick-list">
                      {readyMadeTours.map((t) => (
                        <li key={t.id}>
                          <label className="inquiry-tour-pick">
                            <input
                              type="checkbox"
                              checked={selectedTourIds.has(t.id)}
                              onChange={() => toggleTour(t.id)}
                            />
                            <span>
                              <strong>{t.title}</strong>
                              <span className="muted">
                                {" "}
                                · {t.days} days
                                {t.basePriceLkr != null
                                  ? ` · from LKR ${t.basePriceLkr.toLocaleString()}`
                                  : ""}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="inquiry-proposal-section">
                  <div className="inquiry-proposal-section-head">
                    <h4>Custom tours</h4>
                    <button
                      type="button"
                      className="btn btn-lite"
                      onClick={() => openCustomModal()}
                    >
                      + Add custom tour
                    </button>
                  </div>
                  <p className="muted inquiry-proposal-hint">
                    Uses the same day-by-day planner as Create Custom Tour on your Tours tab.
                  </p>
                  {customDrafts.length === 0 ? (
                    <p className="muted">No custom itineraries added yet.</p>
                  ) : (
                    <ul className="inquiry-custom-draft-list">
                      {customDrafts.map((d) => (
                        <li key={d.key} className="inquiry-custom-draft">
                          <span>
                            <strong>{d.title}</strong>
                            <span className="muted">
                              {" "}
                              · {d.itinerary.days.length} day
                              {d.itinerary.days.length === 1 ? "" : "s"}
                            </span>
                          </span>
                          <span className="inquiry-custom-draft-actions">
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => openCustomModal(d)}
                            >
                              Replace
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => removeCustom(d.key)}
                            >
                              Remove
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <p className="muted" style={{ marginTop: 8 }}>
                  {totalSelections} tour option{totalSelections === 1 ? "" : "s"} selected
                </p>

                <ModalActions
                  onCancel={onClose}
                  submitLabel={
                    inquiry.status === "REVISION_REQUESTED"
                      ? "Update proposal & resend"
                      : isEditing
                        ? "Update & resend to tourist"
                        : "Send to tourist"
                  }
                  saving={saving}
                />
              </form>
            )}
          </>
        )}
      </DashboardModal>

      <TourFormModal
        open={customModalOpen}
        mode="create"
        tourKind="CUSTOM"
        form={customForm}
        entities={entities}
        groups={groups}
        status={customFormStatus}
        saving={false}
        onClose={() => {
          setCustomModalOpen(false);
          setEditingCustomKey(null);
          setCustomForm(defaultTourForm());
        }}
        onChange={setCustomForm}
        onSubmit={saveCustomToProposal}
      />
    </>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
