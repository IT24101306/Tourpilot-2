import { Navigate } from "react-router-dom";

/**
 * Legacy /discover URL used to show a separate pricing page.
 * Pricing now lives on the home page (#pricing).
 */
export function DiscoverPage() {
  return <Navigate to="/#pricing" replace />;
}
