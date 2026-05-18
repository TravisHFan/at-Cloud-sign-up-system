import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircleIcon,
  PlusIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { annualMembershipService } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { formatCurrency } from "../utils/currency";
import type { AnnualMembership } from "../types/annualMembership";

function isAdminRole(role?: string) {
  return role === "Super Admin" || role === "Administrator";
}

function programNames(membership: AnnualMembership) {
  return membership.programs.map((program) => program.title).join(", ");
}

export default function AnnualMemberships() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [memberships, setMemberships] = useState<AnnualMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  const canManage = isAdminRole(currentUser?.role);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await annualMembershipService.list();
        if (!cancelled) setMemberships(data);
      } catch (err) {
        console.error("Failed to load annual memberships", err);
        if (!cancelled)
          setError("Failed to load annual memberships. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedMemberships = useMemo(
    () =>
      [...memberships].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
      ),
    [memberships],
  );

  const handlePurchase = async (
    event: React.MouseEvent,
    membership: AnnualMembership,
  ) => {
    event.stopPropagation();
    try {
      setPurchasingId(membership.id);
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
      setPurchasingId(null);
    }
  };

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="min-h-full bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Annual Membership
            </h1>
            <p className="mt-2 text-gray-600">
              Purchase one membership to unlock every program included in it.
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => navigate("/dashboard/annual-memberships/new")}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              <PlusIcon className="h-5 w-5" />
              New Membership
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {sortedMemberships.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
            <SparklesIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              No annual memberships yet
            </h2>
            <p className="mt-2 text-gray-600">
              Once an administrator creates one, it will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {sortedMemberships.map((membership) => (
              <button
                key={membership.id}
                type="button"
                onClick={() =>
                  navigate(`/dashboard/annual-memberships/${membership.id}`)
                }
                className="group flex min-h-72 flex-col rounded-lg border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
              >
                <div className="h-2 rounded-t-lg bg-gradient-to-r from-slate-900 via-cyan-700 to-emerald-500" />
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                        Annual Suite
                      </p>
                      <h2 className="mt-2 text-xl font-bold text-gray-900 group-hover:text-cyan-800">
                        {membership.title}
                      </h2>
                    </div>
                    {membership.purchased && (
                      <CheckCircleIcon
                        className="h-8 w-8 flex-none text-green-600"
                        aria-label="Purchased"
                      />
                    )}
                  </div>

                  <div className="mt-5">
                    <div className="text-3xl font-bold text-gray-900">
                      {formatCurrency(membership.price)}
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      {membership.programs.length} included program
                      {membership.programs.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <p className="mt-5 line-clamp-3 text-sm leading-6 text-gray-600">
                    {programNames(membership)}
                  </p>

                  <div className="mt-auto pt-6">
                    {canManage ? (
                      <span className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
                        View setup
                      </span>
                    ) : membership.purchased ? (
                      <span className="inline-flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
                        <CheckCircleIcon className="h-5 w-5" />
                        Purchased
                      </span>
                    ) : (
                      <span
                        onClick={(event) => handlePurchase(event, membership)}
                        className="inline-flex rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
                      >
                        {purchasingId === membership.id
                          ? "Redirecting..."
                          : "Enroll"}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
