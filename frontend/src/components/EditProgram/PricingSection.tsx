import type {
  UseFormRegister,
  UseFormWatch,
  FieldErrors,
} from "react-hook-form";
import { formatCurrency } from "../../utils/currency";

interface ProgramFormData {
  programType: string;
  title: string;
  startYear: string;
  startMonth: string;
  endYear: string;
  endMonth: string;
  hostedBy: string;
  introduction: string;
  flyerUrl?: string;
  flyer?: FileList;
  isFree?: string;
  earlyBirdDeadline?: string;
  fullPriceTicket: number | undefined;
  classRepDiscount?: number | undefined;
  earlyBirdDiscount?: number | undefined;
  classRepLimit?: number | undefined;
}

interface PricingSectionProps {
  register: UseFormRegister<ProgramFormData>;
  watch: UseFormWatch<ProgramFormData>;
  errors: FieldErrors<ProgramFormData>;
}

export default function PricingSection({
  register,
  watch,
  errors,
}: PricingSectionProps) {
  const isFreeProgram = watch("isFree");
  const fullPrice = watch("fullPriceTicket");
  const earlyBirdDiscountValue = watch("earlyBirdDiscount");
  const earlyBirdDeadline = watch("earlyBirdDeadline");

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Tuition</h2>

      {/* Free Program Toggle */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Is this a free program?
        </label>
        <div className="flex items-center gap-6">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              value="true"
              {...register("isFree")}
              className="h-5 w-5 text-blue-600 border-gray-300"
            />
            <span className="ml-3 text-lg text-gray-700">Yes</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              value="false"
              {...register("isFree")}
              className="h-5 w-5 text-blue-600 border-gray-300"
            />
            <span className="ml-3 text-lg text-gray-700">No</span>
          </label>
        </div>
      </div>

      {/* Conditional Pricing Fields */}
      {isFreeProgram === "false" && (
        <>
          <p className="text-xs text-gray-600 mb-3">
            Enter dollar amounts (e.g., 19.99 or 20). Discounts reduce the full
            price. Combined discounts cannot exceed the full price.
          </p>

          {/* Row 1: Full Price Ticket */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label
                htmlFor="fullPriceTicket"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Full Price Ticket <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 pointer-events-none">
                  $
                </span>
                <input
                  id="fullPriceTicket"
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  max={100000}
                  step={0.01}
                  {...register("fullPriceTicket", {
                    valueAsNumber: true,
                    required: "Full price is required",
                    min: { value: 0.01, message: "Must be ≥ $0.01" },
                    max: { value: 100000, message: "Must be ≤ $100,000" },
                  })}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {errors.fullPriceTicket && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.fullPriceTicket.message}
                </p>
              )}
              {/* Real-time validation indicator */}
              {(() => {
                const isEmpty = fullPrice === undefined || fullPrice === null;
                const isInvalid =
                  !isEmpty && (fullPrice <= 0 || fullPrice > 100000);

                if (isEmpty && isFreeProgram === "false") {
                  return (
                    <p className="mt-1 text-xs text-amber-600">
                      Full Price Ticket is required
                    </p>
                  );
                }
                if (isInvalid) {
                  return (
                    <p className="mt-1 text-xs text-red-500">
                      {fullPrice <= 0
                        ? "Must be ≥ $0.01"
                        : "Must be ≤ $100,000"}
                    </p>
                  );
                }
                if (!isEmpty && !isInvalid) {
                  return (
                    <p className="mt-1 text-xs text-green-600">
                      ✓ Valid price (${Number(fullPrice).toFixed(2)})
                    </p>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          {/* Row 2: Class Rep Discount + Class Rep Limit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label
                htmlFor="classRepDiscount"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Class Rep Discount
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 pointer-events-none">
                  $
                </span>
                <input
                  id="classRepDiscount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100000}
                  step={0.01}
                  {...register("classRepDiscount", {
                    valueAsNumber: true,
                    min: { value: 0, message: "Must be ≥ $0" },
                    max: { value: 100000, message: "Must be ≤ $100,000" },
                  })}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {errors.classRepDiscount && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.classRepDiscount.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="classRepLimit"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Class Rep Limit
              </label>
              <input
                id="classRepLimit"
                type="number"
                inputMode="numeric"
                min={0}
                max={5}
                step={1}
                {...register("classRepLimit", {
                  valueAsNumber: true,
                  min: { value: 0, message: "Must be ≥ 0" },
                  max: { value: 5, message: "Must be ≤ 5" },
                  validate: (v) =>
                    v == null || Number.isInteger(v as number)
                      ? true
                      : "Must be an integer",
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.classRepLimit && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.classRepLimit.message}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Maximum number of Class Rep slots. Set to 0 for unlimited.
              </p>
            </div>
          </div>

          {/* Row 3: Early Bird Discount + Early Bird Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="earlyBirdDiscount"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Early Bird Discount
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 pointer-events-none">
                  $
                </span>
                <input
                  id="earlyBirdDiscount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100000}
                  step={0.01}
                  {...register("earlyBirdDiscount", {
                    valueAsNumber: true,
                    min: { value: 0, message: "Must be ≥ $0" },
                    max: { value: 100000, message: "Must be ≤ $100,000" },
                  })}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {errors.earlyBirdDiscount && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.earlyBirdDiscount.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="earlyBirdDeadline"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Early Bird Deadline{" "}
                {Number(earlyBirdDiscountValue) > 0 && (
                  <span className="text-red-500">*</span>
                )}
              </label>
              <input
                id="earlyBirdDeadline"
                type="date"
                {...register("earlyBirdDeadline", {
                  validate: (v) => {
                    if (!v) return true;
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(v))
                      return "Use format YYYY-MM-DD";
                    const d = new Date(v + "T00:00:00");
                    return !isNaN(d.getTime()) || "Invalid date";
                  },
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.earlyBirdDeadline && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.earlyBirdDeadline.message as string}
                </p>
              )}
              {/* Real-time validation prompt */}
              {isFreeProgram === "false" && (
                <p className="mt-1 text-xs text-red-500">
                  {earlyBirdDiscountValue &&
                  Number(earlyBirdDiscountValue) > 0 &&
                  !earlyBirdDeadline
                    ? "Early Bird Deadline is required"
                    : ""}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                If set, Early Bird pricing applies until this date.
              </p>
            </div>
          </div>
          {(() => {
            const full = Number(fullPrice || 0);
            const rep = Number(watch("classRepDiscount") || 0);
            const early = Number(earlyBirdDiscountValue || 0);
            const combinedTooLarge = full - rep - early < 0;
            return combinedTooLarge ? (
              <p className="mt-2 text-sm text-red-500">
                Combined discounts cannot exceed the full price.
              </p>
            ) : null;
          })()}
          <div className="mt-4 border-t pt-3">
            <div className="text-sm text-gray-600 mb-2">Computed Examples</div>
            {(() => {
              // Convert dollar values to cents for display
              const full = Number(fullPrice || 0) * 100;
              const rep = Number(watch("classRepDiscount") || 0) * 100;
              const early = Number(earlyBirdDiscountValue || 0) * 100;
              const clamp = (n: number) => Math.max(0, n);
              const examples = [
                { label: "Standard", value: clamp(full) },
                { label: "Class Rep", value: clamp(full - rep) },
                { label: "Early Bird", value: clamp(full - early) },
                {
                  label: "Rep + Early Bird",
                  value: clamp(full - rep - early),
                },
              ];
              return (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {examples.map((ex) => (
                    <li
                      key={ex.label}
                      className="flex items-center justify-between bg-white rounded px-3 py-2 border"
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
              Examples are illustrative. Final pricing is validated on the
              server.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
