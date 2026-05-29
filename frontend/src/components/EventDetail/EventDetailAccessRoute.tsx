import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import LoadingSpinner from "../common/LoadingSpinner";
import EventDetail from "../../pages/EventDetail";

export default function EventDetailAccessRoute() {
  const { id } = useParams<{ id: string }>();
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!currentUser) {
    return (
      <Navigate to={id ? `/p/${encodeURIComponent(id)}` : "/events"} replace />
    );
  }

  return <EventDetail />;
}
