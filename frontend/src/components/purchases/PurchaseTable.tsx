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
  status: "pending" | "completed" | "failed" | "refunded";
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
      refunded: "bg-gray-100 text-gray-800",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          statusStyles[status as keyof typeof statusStyles] ||
          "bg-gray-100 text-gray-800"
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
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
                Discounts
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Final
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {purchases.map((purchase) => {
              const totalDiscount =
                (purchase.classRepDiscount || 0) +
                (purchase.earlyBirdDiscount || 0) +
                (purchase.promoDiscountAmount || 0);

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
                    {purchase.isClassRep && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                        Class Rep
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(purchase.fullPrice)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      -{formatCurrency(totalDiscount)}
                    </div>
                    {purchase.isEarlyBird && (
                      <div className="text-xs text-green-600">Early Bird</div>
                    )}
                    {purchase.promoCode && (
                      <div className="text-xs text-blue-600">
                        {purchase.promoCode}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(purchase.finalPrice)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(purchase.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {purchase.purchaseDate
                      ? format(new Date(purchase.purchaseDate), "MMM d, yyyy")
                      : format(
                          new Date(purchase.createdAt || ""),
                          "MMM d, yyyy"
                        )}
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
