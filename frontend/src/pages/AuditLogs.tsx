import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";

interface AuditLog {
  id: string;
  action: string;
  actorId?: string;
  actorInfo?: {
    username: string;
    email: string;
    name: string;
  };
  eventId?: string;
  eventTitle?: string;
  metadata?: Record<string, unknown>;
  ipHash?: string;
  emailHash?: string;
  createdAt: string;
}

interface AuditLogApiResponse {
  success: boolean;
  data: {
    auditLogs: AuditLog[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  };
}

export default function AuditLogs() {
  const { currentUser } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // Determine API base: in production VITE_API_URL is injected via Render (backend host without protocol per render.yaml)
  const API_BASE = (() => {
    const raw = import.meta.env.VITE_API_URL as string | undefined;
    if (!raw) return ""; // relative mode (dev)
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    // Drop trailing slashes for consistency
    return withProto.replace(/\/+$/g, "");
  })();

  // Helper to build full URL handling cases where API_BASE may or may not already include /api
  const buildApiUrl = (path: string) => {
    // Ensure path starts with '/'
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    if (!API_BASE) {
      // Rely on relative /api when no base supplied
      return `/api${cleanPath}`;
    }
    const baseHasApi = /\/api$/i.test(API_BASE);
    return baseHasApi
      ? `${API_BASE}${cleanPath}`
      : `${API_BASE}/api${cleanPath}`;
  };

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        ...(actionFilter && { action: actionFilter }),
        ...(dateFilter && { date: dateFilter }),
      });

      const url = buildApiUrl(`/audit-logs?${params}`);
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch audit logs");
      }

      const result: AuditLogApiResponse = await response.json();
      if (result.success && result.data) {
        setAuditLogs(result.data.auditLogs || []);
        setTotalPages(result.data.pagination?.totalPages || 1);
        setTotalCount(result.data.pagination?.totalCount || 0);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setAuditLogs([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  }, [currentPage, actionFilter, dateFilter, API_BASE]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Check if user is Super Admin or Administrator
  if (
    currentUser?.role !== "Super Admin" &&
    currentUser?.role !== "Administrator"
  ) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
          <ClipboardDocumentCheckIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Access Restricted
          </h2>
          <p className="text-gray-600">
            Audit logs are only accessible to Super Administrators and
            Administrators.
          </p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "EventPublished":
        return "bg-green-100 text-green-800";
      case "EventUnpublished":
        return "bg-red-100 text-red-800";
      case "PublicRegistrationCreated":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleFilterReset = () => {
    setActionFilter("");
    setDateFilter("");
    setCurrentPage(1);
  };

  if (loading && (!auditLogs || auditLogs.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <ClipboardDocumentCheckIcon className="h-8 w-8 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          </div>
          <p className="text-gray-600">
            View and monitor audit logs for event publishing and public
            registration activities for security and compliance tracking.
          </p>
          <div className="mt-3 inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <svg
              className="w-4 h-4 mr-1.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            Access restricted: only Super Admin and Administrator users can view
            this page
          </div>

          {/* Retention Policy Information */}
          <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-400 shadow-sm rounded-r-lg">
            <div className="p-5">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                    <svg
                      className="w-4 h-4 text-blue-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-base font-semibold text-gray-900 mb-2">
                    Data Retention Policy
                  </h3>
                  <div className="text-sm text-gray-700 space-y-2">
                    <p>
                      Audit logs are automatically retained for{" "}
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        3 months
                      </span>{" "}
                      before being permanently removed.
                    </p>
                    <div className="flex items-center text-xs text-gray-600 bg-white/70 rounded px-3 py-2 mt-3">
                      <svg
                        className="w-4 h-4 text-green-500 mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>
                        Automated cleanup runs hourly • No manual intervention
                        required
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action Type
              </label>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Actions</option>
                <option value="EventPublished">Event Published</option>
                <option value="EventUnpublished">Event Unpublished</option>
                <option value="PublicRegistrationCreated">
                  Public Registration
                </option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleFilterReset}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Showing {auditLogs?.length || 0} of {totalCount} audit logs
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Audit Logs Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {auditLogs?.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionBadgeColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {log.actorInfo ? (
                        <div>
                          <div className="font-medium">
                            {log.actorInfo.name}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {log.actorInfo.username}
                          </div>
                        </div>
                      ) : (
                        "Anonymous"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {log.eventTitle ? (
                        <div>
                          <div className="font-medium">{log.eventTitle}</div>
                          {(() => {
                            const id =
                              typeof log.eventId === "string"
                                ? log.eventId
                                : undefined;
                            const isValidObjectId =
                              id && /^[a-fA-F0-9]{24}$/.test(id);
                            return isValidObjectId ? (
                              <div className="text-gray-500 text-xs font-mono">
                                {id.slice(-8)}
                              </div>
                            ) : null;
                          })()}
                        </div>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {log.metadata && (
                        <details className="cursor-pointer">
                          <summary className="hover:text-blue-600">
                            View metadata
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Prev
              </button>

              <span className="text-sm font-medium text-gray-700">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <svg
                  className="w-4 h-4 ml-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {(!auditLogs || auditLogs.length === 0) && !loading && (
          <div className="text-center py-12">
            <ClipboardDocumentCheckIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No audit logs found
            </h3>
            <p className="text-gray-600">
              {actionFilter || dateFilter
                ? "Try adjusting your filters."
                : "Audit logs will appear here as actions are performed."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
