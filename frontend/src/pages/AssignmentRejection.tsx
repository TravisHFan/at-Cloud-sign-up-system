import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { assignmentService } from "../services/api";
import {
  formatEventDate,
  formatEventDateTimeInViewerTZ,
} from "../utils/eventStatsUtils";

type ValidateResponse = {
  success: boolean;
  event?: {
    id: string;
    title?: string;
    date?: string;
    time?: string;
    roleName?: string;
    timeZone?: string;
  };
  role?: string;
};

export default function AssignmentRejection() {
  const [search] = useSearchParams();
  const token = search.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validated, setValidated] = useState<ValidateResponse | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        if (!token) {
          throw Object.assign(new Error("Invalid or missing link"), {
            status: 410,
          });
        }
        const res = await assignmentService.validateRejection(token);
        // The generic request returns ApiResponse shape
        if (!res.success) {
          // Backend uses 410 Gone with code when invalid/expired/replayed
          throw Object.assign(new Error(res.message || "Link invalid"), {
            status: 410,
          });
        }
        if (!cancelled) setValidated(res as unknown as ValidateResponse);
      } catch (e: unknown) {
        const err = e as Error & { status?: number };
        const msg =
          err?.status === 410
            ? "This link is invalid or has expired."
            : err?.message || "Failed to validate link.";
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const timeDetails = useMemo(() => {
    const ev = validated?.event;
    if (!ev?.date || !ev?.time) return null;
    const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const eventTz = ev.timeZone;
    // Build event datetime string to derive abbreviation
    let eventAbbrev: string | undefined;
    try {
      if (eventTz) {
        const dtf = new Intl.DateTimeFormat(undefined, {
          timeZone: eventTz,
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
        });
        // Use an arbitrary date/time combined
        const parts = dtf.formatToParts(
          new Date(`${ev.date}T${ev.time}:00Z`) // base; tz applied via format options
        );
        const tzPart = parts.find((p) => p.type === "timeZoneName");
        eventAbbrev = tzPart?.value;
      }
    } catch {
      // ignore abbreviation failure
    }
    const viewerLocal = formatEventDateTimeInViewerTZ(ev.date, ev.time);
    const hideLocal = eventTz && viewerTz === eventTz;
    return { viewerLocal, hideLocal, eventAbbrev, eventTz };
  }, [validated]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !note.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await assignmentService.submitRejection(token, note.trim());
      if (!res.success) {
        throw new Error(res.message || "Failed to submit rejection");
      }
      setDone(true);
    } catch (e: unknown) {
      const err = e as Error & { status?: number };
      if (err?.message?.includes("NOTE_REQUIRED")) {
        setError("Please provide a brief note explaining your rejection.");
      } else if (err?.status === 410) {
        setError("This link is invalid or has expired.");
      } else {
        setError(err?.message || "Submission failed.");
      }
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

  if (error && !validated) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Link Problem</h1>
        <p className="text-red-600" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Assignment Rejected</h1>
        <p className="text-green-700">
          Thanks. Your role assignment has been released.
        </p>
      </div>
    );
  }

  const ev = validated?.event;
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Reject Role Assignment</h1>

      {ev && (
        <div className="mb-6 rounded border p-4 bg-gray-50">
          <div className="font-medium">{ev.title || "Event"}</div>
          {ev.date && (
            <div className="text-sm text-gray-700">
              Event Time: {formatEventDate(ev.date)} at {ev.time || "--:--"}
              {timeDetails?.eventAbbrev && (
                <span className="ml-1 text-gray-500">
                  ({timeDetails.eventAbbrev})
                </span>
              )}
            </div>
          )}
          {timeDetails && !timeDetails.hideLocal && (
            <div className="text-xs text-gray-500">
              Your local time: {timeDetails.viewerLocal}
            </div>
          )}
          {ev.roleName && (
            <div className="text-sm text-gray-700">Role: {ev.roleName}</div>
          )}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="note" className="block text-sm font-medium mb-1">
            Please tell us briefly why you’re rejecting this assignment
            <span className="text-red-600"> *</span>
          </label>
          <textarea
            id="note"
            rows={4}
            className="w-full border rounded p-2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            aria-required="true"
          />
          <p className="text-xs text-gray-500 mt-1">
            Your note helps us plan better. Minimum 1 character.
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
            disabled={submitting || !note.trim()}
          >
            {submitting ? "Submitting…" : "Reject Assignment"}
          </button>
        </div>
      </form>
    </div>
  );
}
