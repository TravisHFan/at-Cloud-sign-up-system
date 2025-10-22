import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader, LoadingSpinner, Badge, Button } from "../components/ui";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { apiClient } from "../services/api";
import { formatDistanceToNow } from "date-fns";

export default function PromoCodeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codeDetails, setCodeDetails] = useState<{
    code: string;
    type: string;
    isGeneral: boolean;
    description?: string;
    usageHistory: Array<{
      userId: string;
      userName: string;
      userEmail: string;
      usedAt: string;
      programId?: string;
      programTitle?: string;
    }>;
    usageCount: number;
  } | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchUsageHistory = async () => {
      try {
        setLoading(true);
        const data = await apiClient.getPromoCodeUsageHistory(id);
        setCodeDetails(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchUsageHistory();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !codeDetails) {
    return (
      <div className="p-6">
        <div className="text-red-600">{error || "Code not found"}</div>
        <Button
          onClick={() => navigate("/dashboard/admin/promo-codes")}
          className="mt-4"
        >
          Back to Promo Codes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/dashboard/admin/promo-codes")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <PageHeader
          title={`Promo Code: ${codeDetails.code}`}
          subtitle={
            codeDetails.isGeneral
              ? "General Staff Code - Usage History"
              : "Personal Staff Code"
          }
        />
      </div>

      {/* Code Details Card */}
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-600">Type:</span>
            <p className="font-medium">
              {codeDetails.isGeneral ? (
                <Badge variant="success">General Staff</Badge>
              ) : (
                <Badge variant="info">Personal Staff</Badge>
              )}
            </p>
          </div>
          {codeDetails.description && (
            <div>
              <span className="text-sm text-gray-600">Description:</span>
              <p className="font-medium">{codeDetails.description}</p>
            </div>
          )}
          <div>
            <span className="text-sm text-gray-600">Total Uses:</span>
            <p className="font-medium text-lg">{codeDetails.usageCount}</p>
          </div>
        </div>
      </div>

      {/* Usage History Table */}
      {codeDetails.isGeneral && codeDetails.usageHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Usage History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Program
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Used
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {codeDetails.usageHistory.map((usage, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {usage.userName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {usage.userEmail}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {usage.programTitle || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDistanceToNow(new Date(usage.usedAt))} ago
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {codeDetails.isGeneral && codeDetails.usageHistory.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <p className="text-gray-500">This code has not been used yet.</p>
        </div>
      )}
    </div>
  );
}
