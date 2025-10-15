import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../hooks/useAuth";
import { useProgramValidation } from "../hooks/useProgramValidation";
import OrganizerSelection from "../components/events/OrganizerSelection";
import ValidationIndicator from "../components/events/ValidationIndicator";
import { fileService, programService } from "../services/api";
import { formatCurrency } from "../utils/currency";

interface Mentor {
  id: string;
  firstName: string;
  lastName: string;
  systemAuthorizationLevel: string;
  roleInAtCloud?: string;
  gender: "male" | "female";
  avatar: string | null;
  email: string;
  phone?: string;
}

// Payload types sent to backend
type MentorPayload = {
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  gender?: "male" | "female";
  avatar?: string | null;
  roleInAtCloud?: string;
};

type ProgramPayload = {
  programType: string;
  title: string;
  hostedBy?: string;
  period?: {
    startYear?: string;
    startMonth?: string;
    endYear?: string;
    endMonth?: string;
  };
  introduction?: string;
  flyerUrl?: string;
  earlyBirdDeadline?: string;
  isFree?: boolean;
  mentors?: MentorPayload[];
  // Pricing fields
  fullPriceTicket: number;
  classRepDiscount?: number;
  earlyBirdDiscount?: number;
};

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
  // Early Bird deadline (optional)
  earlyBirdDeadline?: string; // YYYY-MM-DD
  // Free program toggle
  isFree: string; // Radio buttons return strings
  // Pricing (Phase 3)
  fullPriceTicket: number | undefined;
  classRepDiscount?: number | undefined;
  earlyBirdDiscount?: number | undefined;
}

const PROGRAM_TYPES = [
  "EMBA Mentor Circles",
  "Effective Communication Workshops",
];

// Generate years from current year to 5 years in the future
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => (currentYear + i).toString());

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function CreateNewProgram() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Unified mentor state for all program types
  const [mentors, setMentors] = useState<Mentor[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProgramFormData>({
    defaultValues: {
      programType: "", // Start with placeholder (no selection)
      hostedBy: "@Cloud Marketplace Ministry",
      startYear: currentYear.toString(),
      endYear: currentYear.toString(),
      fullPriceTicket: 0,
      classRepDiscount: 0,
      earlyBirdDiscount: 0,
      earlyBirdDeadline: "",
      isFree: "true", // Default to free program
    },
  });

  const isFreeProgram = watch("isFree");

  // Real-time validation
  const { validations, overallStatus } = useProgramValidation(watch);

  // Extract watched values for pricing validation
  const fullPrice = watch("fullPriceTicket");
  const earlyBirdDiscountValue = watch("earlyBirdDiscount");
  const earlyBirdDeadline = watch("earlyBirdDeadline");

  // Pricing validation (only when program is not free)
  const pricingValidation = useMemo(() => {
    if (isFreeProgram === "true") return { isValid: true, invalidCount: 0 };

    const earlyBirdDiscount = Number(earlyBirdDiscountValue || 0);

    // Validate Full Price Ticket (must be > 0)
    const isFullPriceValid =
      fullPrice !== undefined &&
      fullPrice !== null &&
      fullPrice > 0 &&
      fullPrice <= 100000 &&
      Number.isInteger(fullPrice);

    // Validate Early Bird Deadline (required if Early Bird Discount > 0)
    const isEarlyBirdDeadlineValid =
      earlyBirdDiscount > 0 ? !!earlyBirdDeadline : true;

    const invalidCount =
      (isFullPriceValid ? 0 : 1) + (isEarlyBirdDeadlineValid ? 0 : 1);

    return {
      isValid: isFullPriceValid && isEarlyBirdDeadlineValid,
      invalidCount,
    };
  }, [isFreeProgram, fullPrice, earlyBirdDiscountValue, earlyBirdDeadline]);

  // Combined validation status
  const combinedValidation = useMemo(() => {
    const baseInvalidCount = Object.values(validations).filter(
      (v) => !v.isValid
    ).length;
    const totalInvalidCount = baseInvalidCount + pricingValidation.invalidCount;

    return {
      isValid: overallStatus.isValid && pricingValidation.isValid,
      message:
        totalInvalidCount > 0
          ? `${totalInvalidCount} field(s) need attention before creating program`
          : overallStatus.message,
      color: totalInvalidCount > 0 ? "text-red-500" : overallStatus.color,
    };
  }, [validations, overallStatus, pricingValidation]);

  // Unified mentor change handler for all program types
  const handleMentorsChange = (newMentors: Mentor[]) => {
    setMentors(newMentors);
  };

  const onSubmit = async (data: ProgramFormData) => {
    try {
      setIsSubmitting(true);
      console.log("Form data:", data);

      // Map month name (e.g., "April") to 2-digit code (e.g., "04") for API payload
      const monthNameToCode: Record<string, string> = {
        January: "01",
        February: "02",
        March: "03",
        April: "04",
        May: "05",
        June: "06",
        July: "07",
        August: "08",
        September: "09",
        October: "10",
        November: "11",
        December: "12",
      };

      // Transform mentor data to API format
      const transformMentor = (mentor: Mentor): MentorPayload => ({
        userId: mentor.id,
        firstName: mentor.firstName,
        lastName: mentor.lastName,
        email: mentor.email,
        gender: mentor.gender,
        avatar: mentor.avatar,
        roleInAtCloud: mentor.roleInAtCloud,
      });

      // Prepare program payload based on program type
      const payload: ProgramPayload = {
        title: data.title,
        programType: data.programType as
          | "EMBA Mentor Circles"
          | "Effective Communication Workshops",
        hostedBy: data.hostedBy,
        period: {
          startYear: data.startYear,
          startMonth:
            monthNameToCode[data.startMonth] || data.startMonth?.slice(0, 2),
          endYear: data.endYear,
          endMonth:
            monthNameToCode[data.endMonth] || data.endMonth?.slice(0, 2),
        },
        introduction: data.introduction,
        flyerUrl: data.flyerUrl,
        earlyBirdDeadline: data.earlyBirdDeadline
          ? data.earlyBirdDeadline
          : undefined,
        isFree: data.isFree === "true",
        // Pricing from form
        fullPriceTicket: Number.isFinite(data.fullPriceTicket as number)
          ? (data.fullPriceTicket as number)
          : 0,
        classRepDiscount: Number.isFinite(data.classRepDiscount as number)
          ? (data.classRepDiscount as number)
          : 0,
        earlyBirdDiscount: Number.isFinite(data.earlyBirdDiscount as number)
          ? (data.earlyBirdDiscount as number)
          : 0,
      };

      // Add unified mentors for all program types
      payload.mentors = mentors.map(transformMentor);

      console.log("Creating program with payload:", payload);

      // Create the program via API
      await programService.create(payload);

      console.log("Program created successfully");
      navigate("/dashboard/programs");
    } catch (error) {
      console.error("Error creating program:", error);
      // TODO: Show user-friendly error message
      alert("Failed to create program. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleCancel = () => {
    navigate("/dashboard/programs");
  };

  // Check if user needs the restricted access overlay (Participant or Guest Expert)
  const shouldShowRestrictedOverlay =
    currentUser?.role === "Participant" || currentUser?.role === "Guest Expert";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div
        className={`relative bg-white rounded-lg shadow-sm p-6 ${
          shouldShowRestrictedOverlay ? "bg-gray-50" : ""
        }`}
      >
        {shouldShowRestrictedOverlay && (
          <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] rounded-lg flex flex-col items-center justify-center text-center p-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-4 mx-auto">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Create Program access requires @Cloud Co‑worker authorization
              </h2>
              <p className="text-sm text-gray-600">
                To create new programs, you'll need elevated permissions. Please
                contact your @Cloud Leaders to request access.
              </p>
            </div>
          </div>
        )}

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Create New Program
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Program Type */}
          <div>
            <label
              htmlFor="programType"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Program Type <span className="text-red-500">*</span>
            </label>
            <select
              id="programType"
              {...register("programType", {
                required: "Program type is required",
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                -- Select Program Type --
              </option>
              {PROGRAM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {errors.programType && (
              <p className="mt-1 text-sm text-red-500">
                {errors.programType.message}
              </p>
            )}
            <ValidationIndicator validation={validations.programType} />
          </div>

          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Program Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              {...register("title", { required: "Program title is required" })}
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter program title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-500">
                {errors.title.message}
              </p>
            )}
            <ValidationIndicator validation={validations.title} />
          </div>

          {/* Start Year and Month */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            <div>
              <label
                htmlFor="startYear"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Start Year <span className="text-red-500">*</span>
              </label>
              <select
                id="startYear"
                {...register("startYear", {
                  required: "Start year is required",
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select year</option>
                {YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              {errors.startYear && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.startYear.message}
                </p>
              )}
              <ValidationIndicator validation={validations.startYear} />
            </div>

            <div>
              <label
                htmlFor="startMonth"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Start Month <span className="text-red-500">*</span>
              </label>
              <select
                id="startMonth"
                {...register("startMonth", {
                  required: "Start month is required",
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select month</option>
                {MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
              {errors.startMonth && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.startMonth.message}
                </p>
              )}
              <ValidationIndicator validation={validations.startMonth} />
            </div>

            <div>
              <label
                htmlFor="endYear"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                End Year <span className="text-red-500">*</span>
              </label>
              <select
                id="endYear"
                {...register("endYear", { required: "End year is required" })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select year</option>
                {YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              {errors.endYear && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.endYear.message}
                </p>
              )}
              <ValidationIndicator validation={validations.endYear} />
            </div>

            <div>
              <label
                htmlFor="endMonth"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                End Month <span className="text-red-500">*</span>
              </label>
              <select
                id="endMonth"
                {...register("endMonth", { required: "End month is required" })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select month</option>
                {MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
              {errors.endMonth && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.endMonth.message}
                </p>
              )}
              <ValidationIndicator validation={validations.endMonth} />
            </div>
          </div>

          {/* Hosted By */}
          <div>
            <label
              htmlFor="hostedBy"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Hosted By
            </label>
            <input
              id="hostedBy"
              {...register("hostedBy")}
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
              readOnly
            />
            <p className="mt-1 text-sm text-gray-500">
              This field cannot be changed
            </p>
          </div>

          {/* Mentors Field - Shown for ALL program types */}
          {currentUser && (
            <div className="space-y-4">
              <OrganizerSelection
                mainOrganizer={{
                  id: currentUser.id,
                  firstName: currentUser.firstName,
                  lastName: currentUser.lastName,
                  systemAuthorizationLevel: currentUser.role,
                  roleInAtCloud: currentUser.roleInAtCloud,
                  gender: currentUser.gender,
                  avatar: currentUser.avatar || null,
                  email: currentUser.email,
                  phone: currentUser.phone,
                }}
                currentUserId={currentUser.id}
                selectedOrganizers={mentors}
                onOrganizersChange={handleMentorsChange}
                hideMainOrganizer={true}
                excludeMainOrganizer={false}
                organizersLabel="Mentors"
                buttonText="Add Mentors"
              />
            </div>
          )}

          {/* Program Introduction */}
          <div>
            <label
              htmlFor="introduction"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Program Introduction <span className="text-red-500">*</span>
            </label>
            <textarea
              id="introduction"
              {...register("introduction", {
                required: "Program introduction is required",
              })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Provide a detailed introduction to the program..."
            />
            {errors.introduction && (
              <p className="mt-1 text-sm text-red-500">
                {errors.introduction.message}
              </p>
            )}
            <ValidationIndicator validation={validations.introduction} />
          </div>

          {/* Program Flyer (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Program Flyer
            </label>
            <div className="flex items-center gap-3">
              <input
                type="url"
                {...register("flyerUrl")}
                placeholder="https://... or /uploads/images/your-file.png"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <label
                className="px-3 py-2 border rounded-md cursor-pointer hover:bg-gray-50"
                title="Upload image"
              >
                📎
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const inputEl = e.currentTarget;
                    const file = inputEl.files?.[0];
                    if (!file) return;
                    try {
                      const { url } = await fileService.uploadImage(file);
                      setValue("flyerUrl", url, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    } catch (err) {
                      console.error("Flyer upload failed", err);
                      alert("Failed to upload image");
                    } finally {
                      inputEl.value = "";
                    }
                  }}
                />
              </label>
            </div>
            {watch("flyerUrl") && (
              <div className="mt-3">
                <img
                  src={watch("flyerUrl")}
                  alt="Program flyer preview"
                  className="w-full max-w-2xl h-auto rounded border border-gray-200 object-contain"
                />
              </div>
            )}
          </div>

          {/* Tuition (formerly Pricing Phase 3) */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Tuition
            </h2>

            {/* Free Program Toggle */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Is this program free?
              </label>
              <div className="flex items-center space-x-6">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="true"
                    {...register("isFree")}
                    className="mr-3 w-4 h-4 text-blue-500 focus:ring-0"
                  />
                  <span className="text-base text-gray-700">Yes (Free)</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="false"
                    {...register("isFree")}
                    className="mr-3 w-4 h-4 text-blue-500 focus:ring-0"
                  />
                  <span className="text-base text-gray-700">No (Paid)</span>
                </label>
              </div>
            </div>

            {isFreeProgram === "false" && (
              <>
                <p className="text-xs text-gray-600 mb-3">
                  Enter whole-dollar amounts between 0 and 100000. Discounts
                  reduce the full price. Combined discounts cannot exceed the
                  full price.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="fullPriceTicket"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Full Price Ticket <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="fullPriceTicket"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100000}
                      step={1}
                      {...register("fullPriceTicket", {
                        valueAsNumber: true,
                        required: "Full price is required",
                        min: { value: 1, message: "Must be greater than 0" },
                        max: { value: 100000, message: "Must be ≤ 100000" },
                        validate: (v) =>
                          Number.isInteger(v as number) || "Must be an integer",
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {errors.fullPriceTicket && (
                      <p className="mt-1 text-sm text-red-500">
                        {errors.fullPriceTicket.message}
                      </p>
                    )}
                    {/* Real-time validation indicator */}
                    {(() => {
                      const fullPrice = watch("fullPriceTicket");
                      const isEmpty =
                        fullPrice === undefined || fullPrice === null;
                      const isInvalid =
                        !isEmpty &&
                        (fullPrice <= 0 ||
                          fullPrice > 100000 ||
                          !Number.isInteger(fullPrice));

                      if (isEmpty) {
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
                              ? "Must be greater than 0"
                              : fullPrice > 100000
                              ? "Must be ≤ 100000"
                              : "Must be a whole number"}
                          </p>
                        );
                      }
                      return (
                        <p className="mt-1 text-xs text-green-600">
                          ✓ Valid price
                        </p>
                      );
                    })()}
                  </div>
                  <div>
                    <label
                      htmlFor="classRepDiscount"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Class Rep Discount
                    </label>
                    <input
                      id="classRepDiscount"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100000}
                      step={1}
                      {...register("classRepDiscount", {
                        valueAsNumber: true,
                        min: { value: 0, message: "Must be ≥ 0" },
                        max: { value: 100000, message: "Must be ≤ 100000" },
                        validate: (v) =>
                          v == null || Number.isInteger(v as number)
                            ? true
                            : "Must be an integer",
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {errors.classRepDiscount && (
                      <p className="mt-1 text-sm text-red-500">
                        {errors.classRepDiscount.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="earlyBirdDiscount"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Early Bird Discount
                    </label>
                    <input
                      id="earlyBirdDiscount"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100000}
                      step={1}
                      {...register("earlyBirdDiscount", {
                        valueAsNumber: true,
                        min: { value: 0, message: "Must be ≥ 0" },
                        max: { value: 100000, message: "Must be ≤ 100000" },
                        validate: (v) =>
                          v == null || Number.isInteger(v as number)
                            ? true
                            : "Must be an integer",
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {errors.earlyBirdDiscount && (
                      <p className="mt-1 text-sm text-red-500">
                        {errors.earlyBirdDiscount.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Early Bird Deadline */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="earlyBirdDeadline"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Early Bird Deadline
                      {Number(watch("earlyBirdDiscount") || 0) > 0 && (
                        <span className="text-red-500">*</span>
                      )}
                    </label>
                    <input
                      id="earlyBirdDeadline"
                      type="date"
                      {...register("earlyBirdDeadline", {
                        validate: (v) => {
                          const earlyBirdDiscount = Number(
                            watch("earlyBirdDiscount") || 0
                          );
                          // If Early Bird Discount is not 0, deadline is required
                          if (earlyBirdDiscount > 0 && !v) {
                            return "Early Bird Deadline is required when Early Bird Discount is set";
                          }
                          if (!v) return true;
                          // basic YYYY-MM-DD validation
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
                    {/* Real-time validation indicator for Early Bird Deadline */}
                    {(() => {
                      const earlyBirdDiscount = Number(
                        watch("earlyBirdDiscount") || 0
                      );
                      const earlyBirdDeadline = watch("earlyBirdDeadline");
                      const isRequired = earlyBirdDiscount > 0;

                      if (!isRequired) {
                        return (
                          <p className="mt-1 text-xs text-gray-500">
                            If set, Early Bird pricing applies until this date.
                          </p>
                        );
                      }

                      if (isRequired && !earlyBirdDeadline) {
                        return (
                          <p className="mt-1 text-xs text-amber-600">
                            Early Bird Deadline is required when discount is set
                          </p>
                        );
                      }

                      if (
                        earlyBirdDeadline &&
                        !/^\d{4}-\d{2}-\d{2}$/.test(earlyBirdDeadline)
                      ) {
                        return (
                          <p className="mt-1 text-xs text-red-500">
                            Use format YYYY-MM-DD
                          </p>
                        );
                      }

                      if (earlyBirdDeadline) {
                        const d = new Date(earlyBirdDeadline + "T00:00:00");
                        if (isNaN(d.getTime())) {
                          return (
                            <p className="mt-1 text-xs text-red-500">
                              Invalid date
                            </p>
                          );
                        }
                        return (
                          <p className="mt-1 text-xs text-green-600">
                            ✓ Valid deadline
                          </p>
                        );
                      }

                      return (
                        <p className="mt-1 text-xs text-gray-500">
                          If set, Early Bird pricing applies until this date.
                        </p>
                      );
                    })()}
                  </div>
                </div>

                {/* Combined discount validation (client-side mirror of backend) */}
                {(() => {
                  const full = Number(watch("fullPriceTicket") || 0);
                  const rep = Number(watch("classRepDiscount") || 0);
                  const early = Number(watch("earlyBirdDiscount") || 0);
                  const combinedTooLarge = full - rep - early < 0;
                  return combinedTooLarge ? (
                    <p className="mt-2 text-xs text-red-500">
                      Combined discounts cannot exceed the full price.
                    </p>
                  ) : null;
                })()}

                {/* Computed examples */}
                <div className="mt-4 border-t pt-3">
                  <div className="text-sm text-gray-600 mb-2">
                    Computed Examples
                  </div>
                  {(() => {
                    const full = Number(watch("fullPriceTicket") || 0);
                    const rep = Number(watch("classRepDiscount") || 0);
                    const early = Number(watch("earlyBirdDiscount") || 0);
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

          {/* Overall Validation Status */}
          <div className="mb-4 border-b pb-4">
            <ValidationIndicator
              validation={combinedValidation}
              showWhenEmpty={true}
            />
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Program"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
