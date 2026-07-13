import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CoverImage } from "../CoverImage";
import { FormatTourPrice } from "../currency/FormatLkr";
import { GuidedTripCard } from "../guided/GuidedTripCard";
import { ModuleHeader } from "../module/ModuleHeader";
import { SaveTourButton } from "./SaveTourButton";
import { TouristTripRoomDrawer } from "./TouristTripRoomDrawer";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import type { NegotiationListItem } from "../../types/negotiation";
import type { SavedTourItem } from "../../pages/TouristSavedPage";
import { DEFAULT_TOUR_COVER_URL } from "@tourpilot/shared";

type TravelTab = "inquiries" | "bookings" | "saved";

const BOOKING_STATUSES = new Set(["ACCEPTED"]);

function tabFromParam(raw: string | null): TravelTab {
  if (raw === "bookings" || raw === "saved" || raw === "inquiries") return raw;
  return "inquiries";
}

export function TouristTravelHub() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromParam(searchParams.get("tab"));
  const roomId = searchParams.get("room");

  const [inquiries, setInquiries] = useState<NegotiationListItem[]>([]);
  const [savedItems, setSavedItems] = useState<SavedTourItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedLoading, setSavedLoading] = useState(false);
  const [error, setError] = useState("");

  const openRoom = useCallback(
    (inquiryId: string) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("room", inquiryId);
          return p;
        },
        { replace: false }
      );
    },
    [setSearchParams]
  );

  const closeRoom = useCallback(() => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete("room");
        return p;
      },
      { replace: true }
    );
  }, [setSearchParams]);

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

  useEffect(() => {
    if (!roomId) return;
    void loadInquiries();
  }, [roomId, loadInquiries]);

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
              <div className="guided-empty-panel">
                <h3>No inquiries yet</h3>
                <p>Visit an agency or tour page and send an inquiry to track proposals here.</p>
              </div>
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
              <div className="guided-empty-panel">
                <h3>No confirmed bookings yet</h3>
                <p>When you accept a proposal, your trip appears here.</p>
                <Link to="/trips" className="btn btn-primary">
                  View inquiries
                </Link>
              </div>
            ) : null}
            {!loading && bookings.length > 0 ? (
              <>
                <p className="guided-list-summary muted">
                  {bookings.length} confirmed trip{bookings.length === 1 ? "" : "s"}
                </p>
                <ul className="guided-trip-list">
                  {bookings.map((inq) => (
                    <li key={inq.id}>
                      <GuidedTripCard inquiry={inq} onOpen={() => openRoom(inq.id)} />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}

        {tab === "saved" && (
          <>
            {savedLoading ? <p className="muted">Loading saved items…</p> : null}
            {!savedLoading && savedItems.length === 0 ? (
              <div className="guided-empty-panel">
                <h3>No saved tours yet</h3>
                <p>Tap the heart on any tour to build your wishlist.</p>
              </div>
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
                        {tour.summary && <p className="saved-tour-card-summary">{tour.summary}</p>}
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

      <TouristTripRoomDrawer open={Boolean(roomId)} inquiryId={roomId} onClose={closeRoom} />
    </section>
  );
}
