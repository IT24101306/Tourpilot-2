import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { TripRoomView } from "../../components/negotiation/TripRoomView";

export function InfluencerTripRoomPage() {
  const { inquiryId } = useParams<{ inquiryId: string }>();
  const { token } = useAuth();

  if (!inquiryId || !token) {
    return <p className="muted">Missing trip.</p>;
  }

  return (
    <TripRoomView
      inquiryId={inquiryId}
      token={token}
      role="INFLUENCER"
      backTo="/dashboard/i/inquiries"
      backLabel="All chats"
    />
  );
}
