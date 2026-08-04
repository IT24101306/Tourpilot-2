import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CoverImage } from "../CoverImage";
import { FormatTourPrice } from "../currency/FormatLkr";
import { EmptyState } from "../feedback/EmptyState";
import { GuidedTripCard } from "../guided/GuidedTripCard";
import { ModuleHeader } from "../module/ModuleHeader";
import { SaveTourButton } from "./SaveTourButton";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import type { NegotiationListItem } from "../../types/negotiation";
import type { SavedTourItem } from "../../pages/TouristSavedPage";
import { DEFAULT_TOUR_COVER_URL, stripRichHtml } from "@tourpilot/shared";

type TravelTab = "inquiries" | "bookings" | "saved";

const BOOKING_STATUSES = new Set(["ACCEPTED", "IN_PROGRESS", "COMPLETED"]);

function tabFromParam(raw: string | null): TravelTab {
  if (raw === "bookings" || raw === "saved" || raw === "inquiries") return raw;
  return "inquiries";
}

export function TouristTravelHub() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tab = tabFromParam(searchParams.get("tab"));
  const roomId = searchParams.get("room");

  const [inquiries, setInquiries] = useState<NegotiationListItem[]>([]);
  const [savedItems, setSavedItems] = useState<SavedTourItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedLoading, setSavedLoading] = useState(false);
  const [error, setError] = useState("");

  const openRoom = useCallback(
    (inquiryId: string) => {
      navigate(`/trips/${inquiryId}`);
    },
    [navigate]
  );

  // Legacy ?room= deep links → full-page trip room (same layout as agency)
  useEffect(() => {
    if (!roomId) return;
    navigate(`/trips/${roomId}`, { replace: true });
  }, [roomId, navigate]);

  const loadInquiries = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const list = await api<NegotiationListItem[]>("/inquiries/mine", { token });
      setInquiries(list);
    } catch (err) {
      setInquiries([]);
      setError(err instanceof Error ? err.message : "Failed to load trips");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadSaved = useCallback(async () => {
    if (!token) return;
    setSavedLoading(true);
    try {
      const list = await api<SavedTourItem[]>("/saved-tours/mine", { token });
      setSavedItems(list);
    } catch {
      setSavedItems([]);
    } finally {
      setSavedLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadInquiries();
  }, [loadInquiries]);

  useEffect(() => {
    if (tab === "saved") void loadSaved();
  }, [tab, loadSaved]);

  const bookings = useMemo(
    () => inquiries.filter((i) => BOOKING_STATUSES.has(i.status)),
    [inquiries]
  );

  const needsAction = inquiries.filter(
    (i) => i.status === "SENT_TO_TOURIST" || i.status === "TOURIST_VIEWED"
  ).length;

  const header =
    tab === "bookings"
      ? {
          title: "Bookings",
          subtitle: "Confirmed trips you’ve accepted.",
        }
      : tab === "saved"
        ? {
            title: "Saved",
            subtitle: "Tours you’ve bookmarked to revisit later.",
          }
        : {
            title: "Inquiries",
            subtitle: "Track requests, chat, and review proposals.",
          };

  return (
    <section className="section module-shell module-guided tourist-travel-shell">
      <ModuleHeader module="guided" title={header.title} subtitle={header.subtitle} />

      <div className="tourist-travel-panel">
        {tab === "inquiries" && (
          <>
            {loading ? <p className="muted">Loading your inquiries…</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
            {!loading && !error && inquiries.length === 0 ? (
              <EmptyState
                title="No inquiries yet"
                description="Visit an agency or tour page and send an inquiry to track proposals here."
                action={{ label: "Browse offers", to: "/offers" }}
                secondaryAction={{ label: "Find agencies", to: "/" }}
              />
            ) : null}
            {!loading && inquiries.length > 0 ? (
              <>
                {needsAction > 0 && (
                  <p className="guided-list-summary">
                    {needsAction} trip{needsAction === 1 ? "" : "s"} waiting for your review
                  </p>
                )}
                <ul className="guided-trip-list">
                  {inquiries.map((inq) => (
                    <li key={inq.id}>
                      <GuidedTripCard inquiry={inq} onOpen={() => openRoom(inq.id)} />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}

        {tab === "bookings" && (
          <>
            {loading ? <p className="muted">Loading your bookings…</p> : null}
            {!loading && bookings.length === 0 ? (
              <EmptyState
                title="No confirmed bookings yet"
                description="When you accept a proposal, your trip appears here."
                action={{ label: "View inquiries", to: "/trips?tab=inquiries" }}
              />
            ) : null}
            {!loading && bookings.length > 0 ? (
              <>
                {bookings.filter((b) => b.status === "IN_PROGRESS").length > 0 && (
                  <>
                    <p className="guided-list-summary">
                      {bookings.filter((b) => b.status === "IN_PROGRESS").length} trip
                      {bookings.filter((b) => b.status === "IN_PROGRESS").length === 1 ? "" : "s"} in progress
                    </p>
                    <ul className="guided-trip-list">
                      {bookings.filter((b) => b.status === "IN_PROGRESS").map((inq) => (
                        <li key={inq.id}>
                          <GuidedTripCard inquiry={inq} onOpen={() => openRoom(inq.id)} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {bookings.filter((b) => b.status === "ACCEPTED").length > 0 && (
                  <>
                    <p className="guided-list-summary muted">
                      {bookings.filter((b) => b.status === "ACCEPTED").length} upcoming trip
                      {bookings.filter((b) => b.status === "ACCEPTED").length === 1 ? "" : "s"}
                    </p>
                    <ul className="guided-trip-list">
                      {bookings.filter((b) => b.status === "ACCEPTED").map((inq) => (
                        <li key={inq.id}>
                          <GuidedTripCard inquiry={inq} onOpen={() => openRoom(inq.id)} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {bookings.filter((b) => b.status === "COMPLETED").length > 0 && (
                  <>
                    <p className="guided-list-summary muted">
                      {bookings.filter((b) => b.status === "COMPLETED").length} completed trip
                      {bookings.filter((b) => b.status === "COMPLETED").length === 1 ? "" : "s"}
                    </p>
                    <ul className="guided-trip-list">
                      {bookings.filter((b) => b.status === "COMPLETED").map((inq) => (
                        <li key={inq.id}>
                          <GuidedTripCard inquiry={inq} onOpen={() => openRoom(inq.id)} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : null}
          </>
        )}

        {tab === "saved" && (
          <>
            {savedLoading ? <p className="muted">Loading saved items…</p> : null}
            {!savedLoading && savedItems.length === 0 ? (
              <EmptyState
                title="No saved tours yet"
                description="Tap the heart on any tour to build your wishlist."
                action={{ label: "Browse offers", to: "/offers" }}
              />
            ) : null}
            {!savedLoading && savedItems.length > 0 ? (
              <ul className="saved-tour-grid">
                {savedItems.map(({ tour }) => (
                  <li key={tour.id}>
                    <article className="saved-tour-card">
                      <Link to={tour.tourPath} className="saved-tour-card-media">
                        <CoverImage
                          src={tour.coverUrl ?? DEFAULT_TOUR_COVER_URL}
                          className="saved-tour-card-cover"
                        />
                      </Link>
                      <div className="saved-tour-card-body">
                        <p className="saved-tour-card-agency muted">{tour.agency.name}</p>
                        <h3>
                          <Link to={tour.tourPath}>{tour.title}</Link>
                        </h3>
                        <p className="saved-tour-card-meta muted">
                          {tour.days} days · <FormatTourPrice amount={tour.publicPriceLkr} />
                        </p>
                        {tour.summary && (
                          <p className="saved-tour-card-summary">{stripRichHtml(tour.summary)}</p>
                        )}
                        <div className="saved-tour-card-actions">
                          <Link to={tour.tourPath} className="btn btn-teal">
                            Preview tour
                          </Link>
                          <SaveTourButton
                            tourId={tour.id}
                            showLabel
                            onChange={(saved) => {
                              if (!saved) {
                                setSavedItems((prev) => prev.filter((i) => i.tour.id !== tour.id));
                              }
                            }}
                          />
                        </div>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
