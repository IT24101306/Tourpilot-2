import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useConfirmAction } from "../confirm/ConfirmActionContext";
import { DashboardModal, ModalActions, ModalField } from "../DashboardModal";
import type { AssignableInquiry, AssignableTour } from "../../pages/agency/driverTypes";
import { toDatetimeLocalValue } from "../../pages/agency/driverTypes";

type Props = {
  open: boolean;
  token: string;
  driverId: string;
  driverName: string;
  inquiries: AssignableInquiry[];
  tours: AssignableTour[];
  onClose: () => void;
  onAssigned: () => void;
};

export function DriverAssignModal({
  open,
  token,
  driverId,
  driverName,
  inquiries,
  tours,
  onClose,
  onAssigned,
}: Props) {
  const { requestConfirm } = useConfirmAction();
  const [linkType, setLinkType] = useState<"inquiry" | "tour" | "custom">("inquiry");
  const [inquiryId, setInquiryId] = useState("");
  const [tourId, setTourId] = useState("");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!open) return;
    setLinkType("inquiry");
    setInquiryId("");
    setTourId("");
    setTitle("");
    setStartDate("");
    setEndDate("");
    setNotes("");
    setStatus("");
  }, [open]);

  useEffect(() => {
    if (!inquiryId) return;
    const inq = inquiries.find((i) => i.id === inquiryId);
    if (!inq) return;
    if (inq.startDate) setStartDate(toDatetimeLocalValue(inq.startDate));
    if (inq.endDate) setEndDate(toDatetimeLocalValue(inq.endDate));
    if (inq.tour?.title) setTitle(inq.tour.title);
    else setTitle(`Custom trip — ${inq.tourist?.name ?? "Guest"}`);
  }, [inquiryId, inquiries]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!startDate) {
      setStatus("Start date is required.");
      return;
    }

    const inquiry = inquiries.find((i) => i.id === inquiryId);
    const tour = tours.find((t) => t.id === tourId);
    const linkLabel =
      linkType === "inquiry"
        ? inquiry?.tour?.title ?? `Booking — ${inquiry?.tourist?.name ?? "Guest"}`
        : linkType === "tour"
          ? tour?.title ?? "Tour"
          : title || "Custom trip";

    requestConfirm({
      title: "Assign driver?",
      description: "The assignment appears on the driver calendar.",
      confirmLabel: "Assign driver",
      summary: [
        { label: "Driver", value: driverName },
        { label: "Assignment", value: linkLabel },
        {
          label: "Dates",
          value: `${new Date(startDate).toLocaleString()}${
            endDate ? ` – ${new Date(endDate).toLocaleString()}` : ""
          }`,
        },
        { label: "Notes", value: notes.trim() || "—" },
      ],
      onConfirm: async () => {
        setSaving(true);
        setStatus("");
        try {
          await api(`/drivers/${driverId}/assignments`, {
            method: "POST",
            token,
            body: JSON.stringify({
              title: linkType === "custom" ? title : undefined,
              inquiryId: linkType === "inquiry" ? inquiryId || undefined : undefined,
              tourId: linkType === "tour" ? tourId || undefined : undefined,
              startDate: new Date(startDate).toISOString(),
              endDate: endDate ? new Date(endDate).toISOString() : undefined,
              notes: notes.trim() || undefined,
            }),
          });
          onAssigned();
          onClose();
        } catch (err) {
          setStatus(err instanceof ApiError ? err.message : "Failed to assign driver");
        } finally {
          setSaving(false);
        }
      },
    });
  }

  return (
    <DashboardModal
      open={open}
      title={`Assign ${driverName}`}
      subtitle="Link a booking or tour. The driver calendar will show assigned dates."
      onClose={onClose}
      dialogClassName="driver-assign-dialog"
    >
      <form onSubmit={submit}>
        <ModalField label="Assignment type" full>
          <select value={linkType} onChange={(e) => setLinkType(e.target.value as typeof linkType)}>
            <option value="inquiry">Booking / inquiry</option>
            <option value="tour">Tour package</option>
            <option value="custom">Custom trip title</option>
          </select>
        </ModalField>

        {linkType === "inquiry" && (
          <ModalField label="Inquiry" full>
            <select value={inquiryId} onChange={(e) => setInquiryId(e.target.value)} required>
              <option value="">Select inquiry…</option>
              {inquiries.map((inq) => (
                <option key={inq.id} value={inq.id}>
                  {inq.tour?.title ?? "Custom"} — {inq.tourist?.name ?? "Guest"} ({inq.pax} pax)
                </option>
              ))}
            </select>
          </ModalField>
        )}

        {linkType === "tour" && (
          <ModalField label="Tour" full>
            <select value={tourId} onChange={(e) => setTourId(e.target.value)} required>
              <option value="">Select tour…</option>
              {tours.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.days} days){t.isPublished ? "" : " — draft"}
                </option>
              ))}
            </select>
          </ModalField>
        )}

        {linkType === "custom" && (
          <ModalField label="Trip title" full>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Colombo to Ella transfer"
              required
            />
          </ModalField>
        )}

        <div className="entity-form-grid">
          <ModalField label="Start">
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </ModalField>
          <ModalField label="End">
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </ModalField>
        </div>

        <ModalField label="Notes" full>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Pickup point, vehicle notes…"
          />
        </ModalField>

        <ModalActions onCancel={onClose} submitLabel="Assign driver" saving={saving} />
        {status && <p className="driver-status">{status}</p>}
      </form>
    </DashboardModal>
  );
}
