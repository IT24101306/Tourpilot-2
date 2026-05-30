import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { DisplayTabPanel } from "../../components/display/DisplayTabPanel";

export function AgencyDisplayPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  return (
    <DisplayTabPanel
      token={token}
      agencySlug={user?.agency?.slug}
      onGoToTours={() => navigate("/dashboard/agency/tours")}
    />
  );
}
