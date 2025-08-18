import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import GuestEventSignup from "../components/events/GuestEventSignup";
import { apiClient } from "../services/api";
import type { EventData, EventRole } from "../types/event";

export default function GuestRegistration() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const roleIdFromQuery = params.get("roleId") || "";

  // Local state for role selection fallback
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  const onSuccess = (data: any) => {
    navigate("/guest/confirmation", { state: { guest: data } });
  };

  // If no roleId is supplied, fetch event and allow role selection
  useEffect(() => {
    if (!id || roleIdFromQuery) return; // No need to fetch if role present
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const evt = await apiClient.getEvent(id);
        if (!cancelled) {
          setEvent(evt);
          // Pre-select first available role if exists
          const firstRole = (evt?.roles || [])[0]?.id;
          if (firstRole) setSelectedRoleId(firstRole);
        }
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || "Failed to load event");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, roleIdFromQuery]);

  const roles: EventRole[] = useMemo(() => event?.roles || [], [event]);

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg w-full space-y-4 text-center">
          <h1 className="text-xl font-semibold">Missing event</h1>
          <p className="text-gray-600">
            Return to the events list and try again.
          </p>
        </div>
      </div>
    );
  }

  // If role is present in query, render signup directly
  if (roleIdFromQuery) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <GuestEventSignup
            eventId={id}
            roleId={roleIdFromQuery}
            onSuccess={onSuccess}
          />
        </div>
      </div>
    );
  }

  // Otherwise render role selection UI
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-xl font-semibold">Choose a role to join</h1>
        {loading && <p className="text-gray-600">Loading event roles…</p>}
        {loadError && <p className="text-red-600 text-sm">{loadError}</p>}
        {!loading && !loadError && roles.length === 0 && (
          <p className="text-gray-600">No roles available for this event.</p>
        )}
        {!loading && !loadError && roles.length > 0 && (
          <div className="space-y-3">
            <label className="block text-sm" htmlFor="guest-role-select">
              Select role
            </label>
            <select
              id="guest-role-select"
              className="input w-full"
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {selectedRoleId && (
              <div className="mt-4">
                <GuestEventSignup
                  eventId={id}
                  roleId={selectedRoleId}
                  onSuccess={onSuccess}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
