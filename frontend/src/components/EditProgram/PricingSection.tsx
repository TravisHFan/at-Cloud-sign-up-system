import type {
  UseFormRegister,
  UseFormWatch,
  UseFormSetValue,
  FieldErrors,
} from "react-hook-form";
import { formatCurrency } from "../../utils/currency";
import type { ProgramStudentRoleForm } from "../../types/program";
import {
  createStudentRoleForm,
  DEFAULT_STUDENT_ROLES,
} from "../../utils/programRoles";

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
  zoomLink?: string;
  meetingId?: string;
  passcode?: string;
  teacherRoleName?: string;
  studentRoles?: ProgramStudentRoleForm[];
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
  setValue: UseFormSetValue<ProgramFormData>;
  errors: FieldErrors<ProgramFormData>;
}

export default function PricingSection({
  register,
  watch,
  setValue,
  errors,
}: PricingSectionProps) {
  const isFreeProgram = watch("isFree");
  const fullPrice = watch("fullPriceTicket");
  const earlyBirdDiscountValue = watch("earlyBirdDiscount");
  const earlyBirdDeadline = watch("earlyBirdDeadline");
  const studentRoles =
    watch("studentRoles") && watch("studentRoles")!.length > 0
      ? watch("studentRoles")!
      : DEFAULT_STUDENT_ROLES;
  const discountRoles = studentRoles
    .map((role, index) => ({ role, index }))
    .filter(({ role }) => role.discountEligible);

  const updateStudentRoles = (nextRoles: ProgramStudentRoleForm[]) => {
    setValue("studentRoles", nextRoles, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const toggleDiscountRole = (index: number, checked: boolean) => {
    updateStudentRoles(
      studentRoles.map((role, roleIndex) => ({
        ...role,
        discountEligible: roleIndex === index ? checked : role.discountEligible,
        discountAmount:
          roleIndex === index && !checked ? 0 : role.discountAmount,
        limit: roleIndex === index && !checked ? 0 : role.limit,
      })),
    );
  };

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

      <div className="mb-4 border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Student Roles
            </h3>
            <p className="text-xs text-gray-500">
              These are the enrollment choices students will see.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              updateStudentRoles([
                ...studentRoles,
                createStudentRoleForm(studentRoles.length),
              ])
            }
            className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
          >
            Add Role
          </button>
        </div>

        <div className="space-y-3">
          {studentRoles.map((role, index) => (
            <div
              key={role.id || index}
              className="bg-white border border-gray-200 rounded-md p-3"
            >
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1">
                  <label
                    htmlFor={`studentRoles.${index}.name`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Role Name
                  </label>
                  <input
                    id={`studentRoles.${index}.name`}
                    {...register(`studentRoles.${index}.name`)}
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Student Role ${index + 1}`}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
                  <input
                    type="checkbox"
                    checked={!!role.discountEligible}
                    onChange={(event) =>
                      toggleDiscountRole(index, event.currentTarget.checked)
                    }
                    className="h-4 w-4 text-blue-600 border-gray-300"
                  />
                  Tuition discount role
                </label>
                {studentRoles.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      updateStudentRoles(
                        studentRoles.filter((_, roleIndex) => roleIndex !== index),
                      )
                    }
                    className="px-3 py-2 text-sm border border-red-200 text-red-700 rounded-md hover:bg-red-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
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

          {/* Row 2: Discount Role Amount + Limit */}
          {discountRoles.length > 0 && (
            <div className="space-y-4 mb-4">
              {discountRoles.map(({ role, index }) => (
                <div
                  key={role.id || index}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-md border border-gray-200 bg-white p-3"
                >
                  <div>
                    <label
                      htmlFor={`studentRoles.${index}.discountAmount`}
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      {role.name || "Student Role"} Discount
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 pointer-events-none">
                        $
                      </span>
                      <input
                        id={`studentRoles.${index}.discountAmount`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100000}
                        step={0.01}
                        {...register(`studentRoles.${index}.discountAmount`, {
                          valueAsNumber: true,
                          min: { value: 0, message: "Must be ≥ $0" },
                          max: {
                            value: 100000,
                            message: "Must be ≤ $100,000",
                          },
                        })}
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor={`studentRoles.${index}.limit`}
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      {role.name || "Student Role"} Limit
                    </label>
                    <input
                      id={`studentRoles.${index}.limit`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={5}
                      step={1}
                      {...register(`studentRoles.${index}.limit`, {
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
                    <p className="mt-1 text-xs text-gray-500">
                      Maximum number of discounted slots. Set to 0 for
                      unlimited.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

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
            const full = Number(fullPrice || 0) * 100;
            const largestRoleDiscount = Math.max(
              0,
              ...discountRoles.map(
                ({ role }) => Number(role.discountAmount || 0) * 100,
              ),
            );
            const early = Number(earlyBirdDiscountValue || 0) * 100;
            const singleDiscountTooLarge =
              largestRoleDiscount > full || early > full;
            return singleDiscountTooLarge ? (
              <p className="mt-2 text-sm text-red-500">
                Individual discounts cannot exceed the full price. The student
                role discount and Early Bird are mutually exclusive.
              </p>
            ) : null;
          })()}
          <div className="mt-4 border-t pt-3">
            <div className="text-sm text-gray-600 mb-2">Computed Examples</div>
            {(() => {
              // Convert dollar values to cents for display
              const full = Number(fullPrice || 0) * 100;
              const early = Number(earlyBirdDiscountValue || 0) * 100;
              const clamp = (n: number) => Math.max(0, n);
              const examples = [
                { label: "Standard", value: clamp(full) },
                ...discountRoles.map(({ role }) => ({
                  label: role.name || "Discount Role",
                  value: clamp(full - Number(role.discountAmount || 0) * 100),
                })),
                { label: "Early Bird", value: clamp(full - early) },
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
              Student role and Early Bird discounts are mutually exclusive.
              Examples are illustrative. Final pricing is validated on the
              server.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
