import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { TripRoomView } from "../../components/negotiation/TripRoomView";

export function AgencyTripRoomPage() {
  const { inquiryId } = useParams<{ inquiryId: string }>();
  const { token } = useAuth();

  if (!inquiryId || !token) {
    return <p className="muted">Missing trip.</p>;
  }

  return (
    <TripRoomView
      inquiryId={inquiryId}
      token={token}
      role="AGENCY"
      backTo="/dashboard/agency/negotiations"
      backLabel="All negotiations"
    />
  );
}
