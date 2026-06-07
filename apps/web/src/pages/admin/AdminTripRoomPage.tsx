import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { TripRoomView } from "../../components/negotiation/TripRoomView";

export function AdminTripRoomPage() {
  const { inquiryId } = useParams<{ inquiryId: string }>();
  const { token } = useAuth();

  if (!inquiryId || !token) {
    return (
      <p className="muted">
        <Link to="/dashboard/admin/inquiries">Back to inquiries</Link>
      </p>
    );
  }

  return (
    <TripRoomView
      inquiryId={inquiryId}
      token={token}
      role="ADMIN"
      backTo="/dashboard/admin/inquiries"
      backLabel="Back to inquiries"
    />
  );
}
