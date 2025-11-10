import { formatCurrency } from "../../utils/currency";
import { format } from "date-fns";

export interface PurchaseTableRow {
  id: string;
  orderNumber: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  program: {
    id?: string;
    name: string;
  };
  fullPrice: number;
  classRepDiscount: number;
  earlyBirdDiscount: number;
  promoDiscountAmount?: number;
  promoDiscountPercent?: number;
  finalPrice: number;
  isClassRep: boolean;
  isEarlyBird: boolean;
  promoCode?: string;
  status:
    | "pending"
    | "completed"
    | "failed"
    | "refunded"
    | "refund_processing"
    | "refund_failed";
  purchaseDate: string;
  createdAt?: string;
  paymentMethod?: {
    type: string;
    cardBrand?: string;
    last4?: string;
    cardholderName?: string;
  };
}

interface PurchaseTableProps {
  purchases: PurchaseTableRow[];
  showUser?: boolean; // Show user column for admin view
  onRowClick?: (purchase: PurchaseTableRow) => void;
}

export default function PurchaseTable({
  purchases,
  showUser = false,
  onRowClick,
}: PurchaseTableProps) {
  if (purchases.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900">
          No purchases found
        </h3>
        <p className="mt-2 text-gray-600">
          No purchase records match your search.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      completed: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      failed: "bg-red-100 text-red-800",
      refunded: "bg-blue-100 text-blue-800",
      refund_processing: "bg-purple-100 text-purple-800",
      refund_failed: "bg-red-100 text-red-800",
    };

    const statusLabels = {
      completed: "Completed",
      pending: "Pending",
      failed: "Failed",
      refunded: "Refunded",
      refund_processing: "Refund Processing",
      refund_failed: "Refund Failed",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          statusStyles[status as keyof typeof statusStyles] ||
          "bg-gray-100 text-gray-800"
        }`}
      >
        {statusLabels[status as keyof typeof statusLabels] ||
          status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order Number
              </th>
              {showUser && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Program
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {purchases.map((purchase) => {
              const totalDiscount =
                (purchase.classRepDiscount || 0) +
                (purchase.earlyBirdDiscount || 0) +
                (purchase.promoDiscountAmount ||
                  (purchase.promoDiscountPercent
                    ? Math.round(
                        ((purchase.fullPrice -
                          (purchase.classRepDiscount || 0) -
                          (purchase.earlyBirdDiscount || 0)) *
                          purchase.promoDiscountPercent) /
                          100
                      )
                    : 0));
              const hasDiscount = totalDiscount > 0;

              return (
                <tr
                  key={purchase.id}
                  onClick={() => onRowClick?.(purchase)}
                  className={
                    onRowClick
                      ? "hover:bg-gray-50 cursor-pointer transition-colors"
                      : ""
                  }
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {purchase.purchaseDate
                      ? format(new Date(purchase.purchaseDate), "MMM d, yyyy")
                      : format(
                          new Date(purchase.createdAt || ""),
                          "MMM d, yyyy"
                        )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {purchase.orderNumber}
                  </td>
                  {showUser && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {purchase.user?.name || "Unknown User"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {purchase.user?.email || ""}
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {purchase.program.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {formatCurrency(purchase.finalPrice || 0)}
                      </div>
                      {hasDiscount && (
                        <div className="text-xs text-gray-500">
                          <span className="line-through">
                            {formatCurrency(purchase.fullPrice || 0)}
                          </span>
                          <span className="ml-1 text-green-600 font-medium">
                            ({formatCurrency(totalDiscount)} off)
                          </span>
                        </div>
                      )}
                      {purchase.isClassRep && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                          Class Rep
                        </span>
                      )}
                      {purchase.isEarlyBird && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 mt-1 ml-1">
                          Early Bird
                        </span>
                      )}
                      {purchase.promoCode && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1 ml-1">
                          {purchase.promoDiscountPercent === 100
                            ? "Staff 100%"
                            : purchase.promoCode}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(purchase.status)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
