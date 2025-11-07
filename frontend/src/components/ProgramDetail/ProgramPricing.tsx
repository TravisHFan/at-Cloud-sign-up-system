import { formatCurrency } from "../../utils/currency";

interface ProgramPricingProps {
  isFree?: boolean;
  fullPriceTicket?: number;
  classRepDiscount?: number;
  earlyBirdDiscount?: number;
  classRepLimit?: number;
  classRepCount?: number;
  earlyBirdDeadline?: string;
  hasAccess: boolean | null;
  accessReason:
    | "admin"
    | "mentor"
    | "free"
    | "purchased"
    | "not_purchased"
    | null;
  onEnrollClick: () => void;
  // Legacy pricing object for compatibility
  pricing?: {
    fullPriceTicket?: number;
    classRepDiscount?: number;
    earlyBirdDiscount?: number;
  };
}

export default function ProgramPricing({
  isFree,
  fullPriceTicket,
  classRepDiscount,
  earlyBirdDiscount,
  classRepLimit,
  classRepCount,
  earlyBirdDeadline,
  hasAccess,
  accessReason,
  onEnrollClick,
  pricing,
}: ProgramPricingProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-3">Tuition</h2>
      {isFree ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
            <svg
              className="w-5 h-5 text-green-500 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-lg font-medium text-green-800">
              This is a free program
            </span>
          </div>
        </div>
      ) : (
        (() => {
          const full = fullPriceTicket ?? pricing?.fullPriceTicket;
          const rep = classRepDiscount ?? pricing?.classRepDiscount;
          const early = earlyBirdDiscount ?? pricing?.earlyBirdDiscount;
          if (full == null) {
            return <p className="text-gray-700">Tuition is being set up.</p>;
          }
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-sm text-gray-600">Full Price Ticket</div>
                  <div className="font-medium">{formatCurrency(full || 0)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">
                    Class Rep Discount
                  </div>
                  <div className="font-medium">{formatCurrency(rep ?? 0)}</div>
                  {/* Class Rep Slot Availability */}
                  {classRepLimit !== undefined && classRepLimit > 0 && (
                    <div className="mt-1 text-xs text-gray-600 bg-purple-50 px-2 py-1 rounded border border-purple-200 max-w-fit">
                      <span className="inline-flex items-center">
                        <svg
                          className="w-3 h-3 mr-1 text-purple-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                        </svg>
                        Slots: {classRepCount ?? 0} / {classRepLimit}
                        {classRepCount !== undefined &&
                          classRepCount >= classRepLimit && (
                            <span className="ml-1 text-red-600 font-medium">
                              (Full)
                            </span>
                          )}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-gray-600">
                    Early Bird Discount
                  </div>
                  <div className="font-medium">
                    {formatCurrency(early ?? 0)}
                  </div>
                  {earlyBirdDeadline && (early ?? 0) > 0 && (
                    <div className="mt-1 text-xs text-gray-500 bg-amber-50 px-2 py-1 rounded border border-amber-200 max-w-fit">
                      <span className="inline-flex items-center">
                        <svg
                          className="w-3 h-3 mr-1 text-amber-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Valid until {earlyBirdDeadline.split("T")[0]}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {/* Early Bird deadline note is now grouped under the Early Bird Discount amount */}
              <div className="border-t pt-3">
                <div className="text-sm text-gray-600 mb-2">
                  Computed Examples
                </div>
                {(() => {
                  const f = full || 0;
                  const r = rep ?? 0;
                  const e = early ?? 0;
                  const clamp = (n: number) => Math.max(0, n);
                  const examples = [
                    { label: "Standard", value: clamp(f) },
                    { label: "Early Bird", value: clamp(f - e) },
                    { label: "Class Rep", value: clamp(f - r) },
                  ];
                  return (
                    <ul className="grid grid-cols-1 gap-2">
                      {examples.map((ex) => (
                        <li
                          key={ex.label}
                          className="flex items-center justify-between bg-gray-50 rounded px-3 py-2"
                        >
                          <span className="text-gray-700">{ex.label}</span>
                          <span className="font-medium">
                            {formatCurrency(ex.value)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
                <p className="text-xs text-gray-500 mt-2" aria-live="polite">
                  Class Rep and Early Bird discounts are mutually exclusive.
                  Final tuition is validated at checkout.
                </p>
              </div>

              {/* Enrollment CTA or Thank You Message - same as in Introduction */}
              {hasAccess !== null &&
                (hasAccess ? (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <img
                        src="/check.svg"
                        alt="Enrolled"
                        className="w-6 h-6 mr-3"
                      />
                      <div>
                        <p className="font-semibold text-green-900">
                          {accessReason === "admin" || accessReason === "mentor"
                            ? "Congratulations!"
                            : "You're enrolled!"}
                        </p>
                        <p className="text-sm text-green-700 mt-1">
                          {accessReason === "admin"
                            ? "As an administrator, you have full access to all programs."
                            : accessReason === "mentor"
                            ? "As a mentor of this program, you have full access."
                            : "Thank you for enrolling. You now have access to all events in this program."}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6">
                    <button
                      onClick={onEnrollClick}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <span>Enroll Now</span>
                      <svg
                        className="w-5 h-5"
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
                ))}
            </div>
          );
        })()
      )}
    </div>
  );
}
