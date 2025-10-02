import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import GuestApi from "../services/guestApi";
import { formatEventDate } from "../utils/eventStatsUtils";

interface DeclineInfoSuccess {
  success: true;
  data: {
    registrationId: string;
    eventTitle?: string;
    roleName?: string;
    guestName?: string;
    eventDate?: string | Date;
    location?: string;
  };
}
interface DeclineInfoError {
  success: false;
  message: string;
  reason?: string; // invalid | expired | wrong_type
}

type DeclineInfo = DeclineInfoSuccess | DeclineInfoError;

export default function GuestDecline() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<DeclineInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        setInfo({ success: false, message: "Invalid link" });
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = (await GuestApi.getDeclineInfo(token)) as DeclineInfo;
        if (!cancelled) setInfo(data);
      } catch {
        if (!cancelled)
          setInfo({ success: false, message: "Failed to validate link" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = (await GuestApi.submitDecline(
        token,
        reason.trim() || undefined
      )) as {
        success?: boolean;
        message?: string;
      };
      if (!res?.success) throw new Error(res?.message || "Decline failed");
      setDone(true);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || "Submission failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-xl font-semibold">Validating…</h1>
        <p className="text-gray-600">Please wait while we verify your link.</p>
      </div>
    );
  }

  if (!info || !info.success) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Link Problem</h1>
        <p className="text-red-600" role="alert">
          {info?.message || "This decline link is invalid or has expired."}
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Invitation Declined</h1>
        <p className="text-green-700" data-testid="guest-decline-success">
          Thank you. The organizer has been notified.
        </p>
      </div>
    );
  }

  const { data } = info;
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Decline Guest Invitation</h1>
      <div className="mb-6 rounded border p-4 bg-gray-50">
        <div className="font-medium">{data.eventTitle || "Event"}</div>
        {data.eventDate && (
          <div className="text-sm text-gray-700">
            Event Date: {formatEventDate(String(data.eventDate))}
          </div>
        )}
        {data.roleName && (
          <div className="text-sm text-gray-700">Role: {data.roleName}</div>
        )}
        {data.location && (
          <div className="text-sm text-gray-700">Location: {data.location}</div>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="reason" className="block text-sm font-medium mb-1">
            Optional reason (helps organizer)
          </label>
          <textarea
            id="reason"
            rows={4}
            className="w-full border rounded p-2"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            aria-describedby="reason-help"
          />
          <p id="reason-help" className="text-xs text-gray-500 mt-1">
            You can leave this blank. Max 500 characters.
          </p>
        </div>

        {error && (
          <div className="text-red-600" role="alert">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Decline Invitation"}
          </button>
        </div>
      </form>
    </div>
  );
}
