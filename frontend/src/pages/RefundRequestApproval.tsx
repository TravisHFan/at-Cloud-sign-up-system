import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import {
  refundRequestsService,
  type RefundRequestDetail,
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

function StatusBadge({ status }: { status: RefundRequestDetail["status"] }) {
  const classes = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
    expired: "bg-gray-100 text-gray-700 border-gray-200",
  };

  const labels = {
    pending: "Pending Review",
    approved: "Approved",
    rejected: "Rejected",
    expired: "Expired",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${classes[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-gray-100 py-3 sm:flex-row sm:justify-between">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 sm:text-right">
        {value}
      </dd>
    </div>
  );
}

export default function RefundRequestApproval() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const notification = useToastReplacement();
  const [request, setRequest] = useState<RefundRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const isAdmin =
    currentUser?.role === "Super Admin" ||
    currentUser?.role === "Administrator";

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

  const handleApprove = async () => {
    if (!id) return;
    try {
      setAction("approve");
      const updated = await refundRequestsService.approve(id);
      setRequest(updated);
      if (updated.status === "approved") {
        notification.success("Refund approved and unenrollment submitted.");
      } else {
        notification.info("This request has already been answered.");
      }
    } catch (err) {
      notification.error(
        err instanceof Error
          ? err.message
          : "Failed to approve refund request.",
      );
    } finally {
      setAction(null);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    try {
      setAction("reject");
      const updated = await refundRequestsService.reject(id, rejectNote);
      setRequest(updated);
      if (updated.status === "rejected") {
        notification.success("Refund rejected. The user has been notified.");
      } else {
        notification.info("This request has already been answered.");
      }
    } catch (err) {
      notification.error(
        err instanceof Error ? err.message : "Failed to reject refund request.",
      );
    } finally {
      setAction(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto flex max-w-4xl justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-4xl rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">
          {error || "Refund request not found."}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-4xl rounded-lg border border-yellow-200 bg-yellow-50 p-5 text-yellow-900">
          This page is only available to Administrators and Super Admins.
        </div>
      </div>
    );
  }

  const sourceText =
    request.source === "program_unenroll"
      ? "Program detail unenroll request"
      : "Purchase History refund request";
  const roleText = request.purchase?.isClassRep
    ? "class representative"
    : "mentee";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Refund Approval
            </h1>
            <p className="mt-1 text-gray-600">
              Review the over-30-day refund and unenrollment request.
            </p>
          </div>
          <StatusBadge status={request.status} />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            {request.requester?.name || "A user"} requested help with{" "}
            <strong>{request.itemTitle}</strong> after the 30-day automatic
            refund period. If approved, the user will be unenrolled immediately
            and a refund will be submitted to Stripe.
          </div>

          <dl>
            <DetailRow
              label="Requester"
              value={`${request.requester?.name || "Unknown"} (${request.requester?.email || "no email"})`}
            />
            <DetailRow label="System Auth Level" value={request.requester?.role || "Unknown"} />
            <DetailRow
              label="Role in @Cloud"
              value={request.requester?.roleInAtCloud || "Not set"}
            />
            <DetailRow label="Source" value={sourceText} />
            <DetailRow
              label="Enrollment"
              value={
                request.purchaseType === "program"
                  ? roleText
                  : "event participant"
              }
            />
            <DetailRow label="Order Number" value={request.purchase?.orderNumber || "Not recorded"} />
            <DetailRow label="Item" value={request.itemTitle} />
            <DetailRow label="Refund Amount" value={formatCurrency(request.refundAmount)} />
            <DetailRow label="Purchase Date" value={formatDate(request.purchase?.purchaseDate)} />
            <DetailRow label="Requested At" value={formatDate(request.requestedAt)} />
            <DetailRow label="Admin Response Deadline" value={formatDate(request.requestExpiresAt)} />
            {request.reason && <DetailRow label="Policy Note" value={request.reason} />}
          </dl>

          {request.status !== "pending" && (
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
              {request.status === "approved" && (
                <>
                  This request was approved by{" "}
                  <strong>{request.decidedBy?.display || "an administrator"}</strong>{" "}
                  on {formatDate(request.decidedAt)}. No further admin action is
                  available.
                </>
              )}
              {request.status === "rejected" && (
                <>
                  This request was rejected by{" "}
                  <strong>{request.decidedBy?.display || "an administrator"}</strong>{" "}
                  on {formatDate(request.decidedAt)}. The user has been asked if
                  they still want to unenroll without a refund.
                </>
              )}
              {request.status === "expired" && (
                <>
                  This request expired because no administrator responded before
                  the deadline. The requester can submit a new request.
                </>
              )}
              {request.userDecision && (
                <div className="mt-2">
                  User decision:{" "}
                  <strong>
                    {request.userDecision === "unenroll_without_refund"
                      ? "Unenrolled without refund"
                      : "Stayed enrolled"}
                  </strong>
                  .
                </div>
              )}
            </div>
          )}

          {request.status === "pending" && (
            <div className="mt-6">
              <label
                htmlFor="reject-note"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Rejection note (optional)
              </label>
              <textarea
                id="reject-note"
                value={rejectNote}
                onChange={(event) => setRejectNote(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Add a short internal note for this decision"
              />

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  onClick={handleReject}
                  disabled={!!action}
                  className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  {action === "reject" ? "Rejecting..." : "Reject"}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={!!action}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {action === "approve" ? "Approving..." : "Approve Refund"}
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
