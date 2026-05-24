import { useCallback, useEffect, useState } from "react";

import { Link } from "react-router-dom";

import { api, ApiError } from "../api/client";

import { useAuth } from "../context/AuthContext";
import { InquiryThread, type ThreadMessage } from "../components/inquiry/InquiryThread";



type ProposalItem = {

  id: string;

  kind: string;

  tour?: {

    id: string;

    title: string;

    slug: string;

    days: number;

    basePriceLkr: number;

    coverUrl?: string | null;

  } | null;

  itinerary?: {

    id: string;

    title: string | null;

    grandMax: number;

    shareToken: string | null;

    days?: Array<{

      dayNumber: number;

      title: string | null;

      lineItems: Array<{ label: string; priceLkr: number | null }>;

    }>;

  } | null;

};



type InquiryProposal = {

  id: string;

  message: string;

  updatedAt: string;

  items: ProposalItem[];

};



type InquiryResponse = {

  id: string;

  message: string;

  kind: string;

  createdAt: string;

  tour?: {

    id: string;

    title: string;

    slug: string;

    days: number;

    basePriceLkr: number;

  } | null;

  itinerary?: {

    id: string;

    title: string | null;

    grandMax: number;

    shareToken: string | null;

    isSent: boolean;

    days?: Array<{

      dayNumber: number;

      title: string | null;

      lineItems: Array<{ label: string; priceLkr: number | null }>;

    }>;

  } | null;

};



type Inquiry = {

  id: string;

  status: string;

  type: string;

  pax: number;

  message: string | null;

  budgetBand: string | null;

  startDate: string | null;

  endDate: string | null;

  createdAt: string;

  agency: { name: string; slug: string };

  tour: { title: string; slug: string } | null;

  proposal?: InquiryProposal | null;

  proposalEditable?: boolean;

  thread?: ThreadMessage[];

  responses: InquiryResponse[];

};



const RESPONDABLE = new Set(["SENT_TO_TOURIST", "TOURIST_VIEWED"]);



export function ProfilePage() {

  const { user, token } = useAuth();

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  const [actionStatus, setActionStatus] = useState("");

  const [actingId, setActingId] = useState<string | null>(null);

  const [revisionInquiryId, setRevisionInquiryId] = useState<string | null>(null);

  const [revisionNote, setRevisionNote] = useState("");



  const loadInquiries = useCallback(async () => {

    if (!token) return;

    const list = await api<Inquiry[]>("/inquiries/mine", { token });

    setInquiries(list);

  }, [token]);

<<<<<<< HEAD
  if (!user) {
    return (
      <section className="section">
        <p>
          Please <Link to="/login">log in</Link> or <Link to="/register">create an account</Link>.
        </p>
      </section>
    );
=======


  useEffect(() => {

    loadInquiries().catch(console.error);

  }, [loadInquiries]);



  async function respond(inquiryId: string, action: "accept" | "revision" | "decline", note?: string) {

    if (!token) return;

    setActingId(inquiryId);

    setActionStatus("");

    try {

      await api(`/inquiries/${inquiryId}/respond`, {

        method: "POST",

        token,

        body: JSON.stringify({ action, note }),

      });

      setActionStatus(

        action === "accept"

          ? "You accepted the proposal."

          : action === "decline"

            ? "You declined the proposal."

            : "Revision requested — the agency can update their proposal."

      );

      await loadInquiries();

      setRevisionInquiryId(null);

      setRevisionNote("");

    } catch (err) {

      setActionStatus(err instanceof ApiError ? err.message : "Action failed");

    } finally {

      setActingId(null);

    }

>>>>>>> a1fb766 (Implement dashboard and API updates)
  }



  if (!user) {

    return (

      <section className="section">

        <p>

          Please <Link to="/login">log in</Link>.

        </p>

      </section>

    );

  }



  return (

    <section className="section profile-page">

      <h1 className="section-title">My profile</h1>

      <div className="panel">

        <p>

          <strong>{user.name}</strong>

        </p>

        <p className="muted">{user.phone}</p>

        <p className="muted">Role: {user.role}</p>

        <p className="price">Wallet: LKR {user.walletBalance.toLocaleString()}</p>

      </div>



      {user.role === "TOURIST" && (

        <>

          <h2 className="section-title">My inquiries &amp; agency replies</h2>

          {actionStatus && <p className="driver-status">{actionStatus}</p>}

          {inquiries.length === 0 ? (

            <p className="muted">

              No inquiries yet. Browse <Link to="/agencies">agencies</Link> and request a custom

              tour.

            </p>

          ) : (

            <div className="profile-inquiry-list">

              {inquiries.map((inq) => (

                <article key={inq.id} className="panel profile-inquiry-card">

                  <header className="profile-inquiry-head">

                    <div>

                      <h3>

                        <Link to={`/agencies/${inq.agency.slug}`}>{inq.agency.name}</Link>

                      </h3>

                      <p className="muted">

                        Sent {formatDate(inq.createdAt)} · {inq.pax} travelers ·{" "}

                        {inq.status.replace(/_/g, " ")}

                      </p>

                    </div>

                  </header>



                  <div className="profile-inquiry-request">

                    <h4>Your request</h4>

                    {inq.startDate && (

                      <p className="muted">

                        Dates: {formatDate(inq.startDate)}

                        {inq.endDate ? ` – ${formatDate(inq.endDate)}` : ""}

                      </p>

                    )}

                    {inq.budgetBand && <p className="muted">Budget: {inq.budgetBand}</p>}

                    <p>{inq.message || "No message."}</p>

                  </div>



                  {inq.proposal ? (

                    <div className="profile-proposal">

                      <h4>Agency proposal</h4>

                      <p className="muted">

                        Updated {formatDate(inq.proposal.updatedAt)} ·{" "}

                        {inq.proposal.items.length} tour option

                        {inq.proposal.items.length === 1 ? "" : "s"}

                      </p>

                      <p className="profile-reply-message">{inq.proposal.message}</p>



                      <ul className="profile-proposal-items">

                        {inq.proposal.items.map((item) => (

                          <li key={item.id} className="profile-proposal-item">

                            {item.kind === "READY_MADE" && item.tour && (

                              <>

                                <span className="profile-proposal-tag">Ready-made</span>

                                <strong>{item.tour.title}</strong>

                                <span className="muted">

                                  {" "}

                                  · {item.tour.days} days · from LKR{" "}

                                  {item.tour.basePriceLkr.toLocaleString()}

                                </span>

                                <br />

                                <Link

                                  to={`/tours/${inq.agency.slug}/${item.tour.slug}`}

                                >

                                  View tour details

                                </Link>

                              </>

                            )}

                            {item.kind === "CUSTOM" && item.itinerary && (

                              <>

                                <span className="profile-proposal-tag">Custom</span>

                                <strong>{item.itinerary.title || "Custom itinerary"}</strong>

                                <span className="price">

                                  {" "}

                                  · up to LKR {item.itinerary.grandMax.toLocaleString()}

                                </span>

                                {item.itinerary.shareToken && (

                                  <>

                                    <br />

                                    <Link to={`/itinerary/${item.itinerary.shareToken}`}>

                                      View full itinerary

                                    </Link>

                                  </>

                                )}

                              </>

                            )}

                          </li>

                        ))}

                      </ul>



                      {inq.thread && inq.thread.length > 0 && (
                        <InquiryThread messages={inq.thread} />
                      )}



                      {RESPONDABLE.has(inq.status) && (

                        <div className="profile-proposal-actions">

                          <button

                            type="button"

                            className="btn btn-primary"

                            disabled={actingId === inq.id}

                            onClick={() => respond(inq.id, "accept")}

                          >

                            Accept proposal

                          </button>

                          {revisionInquiryId !== inq.id ? (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              disabled={actingId === inq.id}
                              onClick={() => {
                                setRevisionInquiryId(inq.id);
                                setRevisionNote("");
                              }}
                            >
                              Request changes
                            </button>
                          ) : null}

                          <button

                            type="button"

                            className="btn btn-ghost"

                            disabled={actingId === inq.id}

                            onClick={() => respond(inq.id, "decline")}

                          >

                            Decline

                          </button>

                        </div>

                      )}



                      {revisionInquiryId === inq.id && (
                        <div className="profile-revision-form">
                          <label className="profile-revision-label">
                            What would you like changed?
                            <textarea
                              rows={4}
                              value={revisionNote}
                              onChange={(e) => setRevisionNote(e.target.value)}
                              placeholder="e.g. Prefer fewer days, add whale watching, adjust budget…"
                            />
                          </label>
                          <div className="profile-proposal-actions">
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={actingId === inq.id || !revisionNote.trim()}
                              onClick={() => respond(inq.id, "revision", revisionNote.trim())}
                            >
                              Send feedback to agency
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => {
                                setRevisionInquiryId(null);
                                setRevisionNote("");
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}



                      {inq.status === "REVISION_REQUESTED" && (
                        <p className="muted profile-awaiting">
                          You requested changes. The agency will update the proposal and send it
                          again.
                        </p>
                      )}



                      {inq.status === "ACCEPTED" && (

                        <p className="muted profile-proposal-accepted">You accepted this proposal.</p>

                      )}

                    </div>

                  ) : inq.responses.length === 0 ? (

                    <p className="muted profile-awaiting">

                      Waiting for the agency to reply…

                    </p>

                  ) : (

                    <div className="profile-inquiry-replies">

                      <h4>Agency replies</h4>

                      {inq.responses.map((reply) => (

                        <div key={reply.id} className="profile-reply-bubble">

                          <p className="profile-reply-meta">

                            {formatDate(reply.createdAt)} · {responseKindLabel(reply.kind)}

                          </p>

                          <p className="profile-reply-message">{reply.message}</p>



                          {reply.tour && (

                            <div className="profile-reply-tour">

                              <strong>{reply.tour.title}</strong>

                              <span className="muted">

                                {" "}

                                · {reply.tour.days} days · from LKR{" "}

                                {reply.tour.basePriceLkr.toLocaleString()}

                              </span>

                            </div>

                          )}



                          {reply.itinerary?.shareToken && (

                            <div className="profile-reply-itinerary">

                              <p className="price">

                                Custom itinerary · up to LKR{" "}

                                {reply.itinerary.grandMax.toLocaleString()}

                              </p>

                              <Link to={`/itinerary/${reply.itinerary.shareToken}`}>

                                View full itinerary

                              </Link>

                            </div>

                          )}

                        </div>

                      ))}

                    </div>

                  )}

                </article>

              ))}

            </div>

          )}

        </>

      )}

    </section>

  );

}



function responseKindLabel(kind: string) {

  if (kind === "READY_MADE") return "Ready-made tour";

  if (kind === "CUSTOM_ITINERARY") return "Custom itinerary";

  return "Message";

}



function formatDate(value: string) {

  return new Date(value).toLocaleDateString(undefined, {

    year: "numeric",

    month: "short",

    day: "numeric",

  });

}

