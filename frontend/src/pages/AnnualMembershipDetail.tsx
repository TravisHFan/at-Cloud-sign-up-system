import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CheckCircleIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { annualMembershipService } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { formatCurrency } from "../utils/currency";
import type { AnnualMembership } from "../types/annualMembership";

function isAdminRole(role?: string) {
  return role === "Super Admin" || role === "Administrator";
}

function programIdOf(program: { id?: string; _id?: string }) {
  return program.id || program._id || "";
}

export default function AnnualMembershipDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [membership, setMembership] = useState<AnnualMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const canManage = isAdminRole(currentUser?.role);
  const programList = useMemo(() => membership?.programs || [], [membership]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await annualMembershipService.getById(id);
        if (!cancelled) setMembership(data);
      } catch (err) {
        console.error("Failed to load annual membership", err);
        if (!cancelled)
          setError("Failed to load annual membership. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handlePurchase = async () => {
    if (!membership) return;
    try {
      setPurchasing(true);
      const session = await annualMembershipService.createCheckoutSession(
        membership.id,
      );
      window.location.href = session.sessionUrl;
    } catch (err) {
      console.error("Failed to start annual membership checkout", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start annual membership checkout.",
      );
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" />;

  if (error || !membership) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error || "Annual membership not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="h-2 rounded-t-lg bg-gradient-to-r from-slate-900 via-cyan-700 to-emerald-500" />
          <div className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                  Annual Membership
                </p>
                <h1 className="mt-2 text-3xl font-bold text-gray-900">
                  {membership.title}
                </h1>
                <p className="mt-3 text-gray-600">
                  This membership includes free access to every program listed
                  below.
                </p>
              </div>
              {canManage && (
                <button
                  onClick={() =>
                    navigate(`/dashboard/annual-memberships/${membership.id}/edit`)
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <PencilSquareIcon className="h-5 w-5" />
                  Edit
                </button>
              )}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-sm font-medium text-gray-600">Price</div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {formatCurrency(membership.price)}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-sm font-medium text-gray-600">
                  Programs
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {programList.length}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-sm font-medium text-gray-600">Status</div>
                <div className="mt-2">
                  {membership.purchased ? (
                    <span className="inline-flex items-center gap-2 rounded-md bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-700">
                      <CheckCircleIcon className="h-5 w-5" />
                      Access Included
                    </span>
                  ) : (
                    <span className="inline-flex rounded-md bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700">
                      Not Purchased
                    </span>
                  )}
                </div>
              </div>
            </div>

            {!canManage && !membership.purchased && (
              <div className="mt-8">
                <button
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className="w-full rounded-md bg-cyan-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800 disabled:opacity-60 sm:w-auto"
                >
                  {purchasing
                    ? "Redirecting..."
                    : `Purchase Membership - ${formatCurrency(membership.price)}`}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Included Programs
          </h2>
          <div className="mt-5 divide-y divide-gray-200">
            {programList.map((program) => (
              <button
                key={programIdOf(program) || program.title}
                onClick={() => {
                  const programId = programIdOf(program);
                  if (programId) navigate(`/dashboard/programs/${programId}`);
                }}
                className="flex w-full items-center justify-between gap-4 py-4 text-left hover:bg-gray-50"
              >
                <div>
                  <div className="font-semibold text-gray-900">
                    {program.title}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {program.programType || "Program"}
                  </div>
                </div>
                <span className="text-sm font-medium text-cyan-700">
                  View Program
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
