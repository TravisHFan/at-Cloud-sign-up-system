import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import {
  refundRequestsService,
  type RefundRequestDetail,
  type RefundRequestUserDecision,
} from "../services/api";
import { formatCurrency } from "../utils/currency";

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RefundRequestDecision() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const notification = useToastReplacement();
  const [request, setRequest] = useState<RefundRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<RefundRequestUserDecision | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRequest() {
      if (!id) return;
      try {
        setLoading(true);
        const data = await refundRequestsService.getById(id);
        if (!cancelled) {
          setRequest(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load refund request.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRequest();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const submitDecision = async (decision: RefundRequestUserDecision) => {
    if (!id) return;
    try {
      setSaving(decision);
      const updated = await refundRequestsService.submitUserDecision(
        id,
        decision,
      );
      setRequest(updated);
      notification.success(
        decision === "unenroll_without_refund"
          ? "You have been unenrolled without a refund."
          : "You will stay enrolled.",
      );
    } catch (err) {
      notification.error(
        err instanceof Error ? err.message : "Failed to save your decision.",
      );
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto flex max-w-3xl justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">
          {error || "Refund request not found."}
        </div>
      </div>
    );
  }

  const isOwner = currentUser?.id === request.requester?.id;
  const decidedBy = request.decidedBy?.display || "an administrator";

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-yellow-200 bg-yellow-50 p-5 text-yellow-900">
          This page is only available to the user who made the request.
        </div>
      </div>
    );
  }

  const decisionLabel =
    request.userDecision === "unenroll_without_refund"
      ? "You chose to unenroll without a refund."
      : request.userDecision === "stay_enrolled"
        ? "You chose to stay enrolled."
        : "";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Choose Enrollment Option
          </h1>
          <p className="mt-1 text-gray-600">
            Your refund request was reviewed by an administrator.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Your refund request for <strong>{request.itemTitle}</strong> was
            rejected by <strong>{decidedBy}</strong>. You are still enrolled.
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Order Number</span>
              <span className="font-medium text-gray-900">
                {request.purchase?.orderNumber || "Not recorded"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Refund Amount Requested</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(request.refundAmount)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Rejected At</span>
              <span className="font-medium text-gray-900">
                {formatDate(request.decidedAt)}
              </span>
            </div>
          </div>

          {request.status !== "rejected" && (
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
              This request is no longer waiting for your decision.
            </div>
          )}

          {request.userDecision && (
            <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              {decisionLabel}
            </div>
          )}

          {request.status === "rejected" && !request.userDecision && (
            <div className="mt-6">
              <p className="mb-4 text-sm text-gray-700">
                Do you still want to unenroll without a refund?
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  onClick={() => submitDecision("stay_enrolled")}
                  disabled={!!saving}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {saving === "stay_enrolled" ? "Saving..." : "No, Stay Enrolled"}
                </button>
                <button
                  onClick={() => submitDecision("unenroll_without_refund")}
                  disabled={!!saving}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {saving === "unenroll_without_refund"
                    ? "Unenrolling..."
                    : "Yes, Unenroll Without Refund"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5">
          <Link
            to="/dashboard/purchase-history"
            className="text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            Back to Purchase History
          </Link>
        </div>
      </div>
    </div>
  );
}
