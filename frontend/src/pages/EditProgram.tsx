import { useState, useEffect, useMemo } from "react";
import { deriveFlyerUrlForUpdate } from "../utils/flyerUrl";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../hooks/useAuth";
import { useProgramValidation } from "../hooks/useProgramValidation";
import ValidationIndicator from "../components/events/ValidationIndicator";
import PricingSection from "../components/EditProgram/PricingSection";
import PricingConfirmationModal from "../components/EditProgram/PricingConfirmationModal";
import ProgramFormFields from "../components/EditProgram/ProgramFormFields";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { programService } from "../services/api";
import { type ProgramType } from "../constants/programTypes";

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
  // Free program toggle
  isFree?: string; // "true" or "false"
  // Early Bird deadline (optional)
  earlyBirdDeadline?: string; // YYYY-MM-DD
  // Pricing (Phase 3)
  fullPriceTicket: number | undefined;
  classRepDiscount?: number | undefined;
  earlyBirdDiscount?: number | undefined;
  classRepLimit?: number | undefined;
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

type ProgramUpdatePayload = {
  title: string;
  programType: ProgramType;
  hostedBy?: string;
  period: {
    startYear?: string;
    startMonth?: string;
    endYear?: string;
    endMonth?: string;
  };
  introduction?: string;
  // flyerUrl can be string | null (explicit null signals removal)
  flyerUrl?: string | null;
  isFree?: boolean;
  earlyBirdDeadline?: string;
  mentors?: MentorPayload[];
  // Pricing fields
  fullPriceTicket: number;
  classRepDiscount?: number;
  earlyBirdDiscount?: number;
  classRepLimit?: number;
};

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

export default function EditProgram() {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Confirmation modal states
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState(1);
  const [pendingFormData, setPendingFormData] =
    useState<ProgramFormData | null>(null);

  // Store original pricing values to detect changes
  const [originalPricing, setOriginalPricing] = useState<{
    isFree?: boolean;
    fullPriceTicket?: number;
    classRepDiscount?: number;
    earlyBirdDiscount?: number;
    earlyBirdDeadline?: string;
  }>({});

  // Unified mentor state for all program types
  const [mentors, setMentors] = useState<Mentor[]>([]);
  // Store original mentor array to detect changes
  const [originalMentors, setOriginalMentors] = useState<Mentor[]>([]);
  // Store original program data including mentors to check permissions
  const [programMentorIds, setProgramMentorIds] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ProgramFormData>({
    defaultValues: {
      hostedBy: "@Cloud Marketplace Ministry",
      startYear: currentYear.toString(),
      endYear: currentYear.toString(),
      isFree: "true", // Default to free program
      fullPriceTicket: 0,
      classRepDiscount: 0,
      earlyBirdDiscount: 0,
      classRepLimit: 0, // 0 means unlimited
      earlyBirdDeadline: "",
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
      fullPrice <= 100000;

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

  // Extract validation values for useMemo dependency
  const validationValues = Object.values(validations);

  // Combined validation status
  const combinedValidation = useMemo(() => {
    const baseInvalidCount = validationValues.filter((v) => !v.isValid).length;
    const totalInvalidCount = baseInvalidCount + pricingValidation.invalidCount;

    return {
      isValid: overallStatus.isValid && pricingValidation.isValid,
      message:
        totalInvalidCount > 0
          ? `${totalInvalidCount} field(s) need attention before updating program`
          : overallStatus.message,
      color: totalInvalidCount > 0 ? "text-red-500" : overallStatus.color,
    };
  }, [validationValues, overallStatus, pricingValidation]);

  // Helper function to compare mentor arrays
  const compareMentorArrays = (arr1: Mentor[], arr2: Mentor[]): boolean => {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((mentor1, index) => {
      const mentor2 = arr2[index];
      return (
        mentor1.id === mentor2.id &&
        mentor1.firstName === mentor2.firstName &&
        mentor1.lastName === mentor2.lastName &&
        mentor1.email === mentor2.email
      );
    });
  };

  // Check if mentors have changed - unified for all program types
  const mentorsChanged = !compareMentorArrays(mentors, originalMentors);

  // Custom isDirty that includes mentor changes
  const customIsDirty = isDirty || mentorsChanged;

  // Check if pricing has changed
  const hasPricingChanges = useMemo(() => {
    const currentIsFree = isFreeProgram === "true";
    // Convert current dollar values to cents for comparison
    const currentFullPrice = Math.round((fullPrice ?? 0) * 100);
    const currentClassRep = Math.round((watch("classRepDiscount") ?? 0) * 100);
    const currentEarlyBird = Math.round((earlyBirdDiscountValue ?? 0) * 100);
    const currentDeadline = earlyBirdDeadline ?? "";

    return (
      originalPricing.isFree !== currentIsFree ||
      originalPricing.fullPriceTicket !== currentFullPrice ||
      originalPricing.classRepDiscount !== currentClassRep ||
      originalPricing.earlyBirdDiscount !== currentEarlyBird ||
      originalPricing.earlyBirdDeadline !== currentDeadline
    );
  }, [
    originalPricing,
    isFreeProgram,
    fullPrice,
    watch,
    earlyBirdDiscountValue,
    earlyBirdDeadline,
  ]);

  // Handle form submission with pricing confirmation
  const handleFormSubmit = (data: ProgramFormData) => {
    if (hasPricingChanges) {
      // Show confirmation modal for pricing changes
      setPendingFormData(data);
      setConfirmationStep(1);
      setShowConfirmation(true);
    } else {
      // No pricing changes, submit directly
      handleActualSubmit(data);
    }
  };

  // Handle confirmation step progression
  const handleConfirmationNext = () => {
    if (confirmationStep === 1) {
      setConfirmationStep(2);
    } else {
      // Final confirmation, proceed with submission
      setShowConfirmation(false);
      if (pendingFormData) {
        handleActualSubmit(pendingFormData);
      }
    }
  };

  const handleConfirmationCancel = () => {
    setShowConfirmation(false);
    setConfirmationStep(1);
    setPendingFormData(null);
  };

  // Track original flyer to detect removal intent
  const [originalFlyerUrl, setOriginalFlyerUrl] = useState<string | null>(null);

  // Load existing program data
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const program = (await programService.getById(id)) as {
          title?: string;
          programType?: ProgramType;
          hostedBy?: string;
          period?: {
            startYear?: string;
            startMonth?: string;
            endYear?: string;
            endMonth?: string;
          };
          introduction?: string;
          flyerUrl?: string;
          isFree?: boolean;
          earlyBirdDeadline?: string;
          mentors?: Array<{
            userId: string;
            firstName?: string;
            lastName?: string;
            email?: string;
            gender?: "male" | "female";
            avatar?: string;
            roleInAtCloud?: string;
          }>;
          fullPriceTicket?: number;
          classRepDiscount?: number;
          earlyBirdDiscount?: number;
          classRepLimit?: number;
        };

        if (cancelled) return;

        // Map 2-digit month codes back to full month names
        const monthCodeToName: Record<string, string> = {
          "01": "January",
          "02": "February",
          "03": "March",
          "04": "April",
          "05": "May",
          "06": "June",
          "07": "July",
          "08": "August",
          "09": "September",
          "10": "October",
          "11": "November",
          "12": "December",
        };

        // Pre-fill form with existing data
        setValue("title", program.title || "");
        setValue("programType", program.programType || "");
        setValue("hostedBy", program.hostedBy || "@Cloud Marketplace Ministry");
        setValue(
          "startYear",
          program.period?.startYear || currentYear.toString()
        );
        setValue(
          "startMonth",
          program.period?.startMonth &&
            monthCodeToName[program.period.startMonth]
            ? monthCodeToName[program.period.startMonth]
            : program.period?.startMonth || ""
        );
        setValue("endYear", program.period?.endYear || currentYear.toString());
        setValue(
          "endMonth",
          program.period?.endMonth && monthCodeToName[program.period.endMonth]
            ? monthCodeToName[program.period.endMonth]
            : program.period?.endMonth || ""
        );
        setValue("introduction", program.introduction || "");
        setValue("flyerUrl", program.flyerUrl || "");
        setOriginalFlyerUrl(program.flyerUrl || null);
        // Set isFree based on backend data (convert boolean to string)
        setValue("isFree", program.isFree ?? false ? "true" : "false");
        if (program.earlyBirdDeadline) {
          // Keep as YYYY-MM-DD for input
          setValue(
            "earlyBirdDeadline",
            program.earlyBirdDeadline.split("T")[0]
          );
        } else {
          setValue("earlyBirdDeadline", "");
        }
        // Pricing - convert cents to dollars for display
        setValue(
          "fullPriceTicket",
          ((program.fullPriceTicket as number | undefined) ?? 0) / 100
        );
        setValue(
          "classRepDiscount",
          ((program.classRepDiscount as number | undefined) ?? 0) / 100
        );
        setValue(
          "earlyBirdDiscount",
          ((program.earlyBirdDiscount as number | undefined) ?? 0) / 100
        );
        setValue(
          "classRepLimit",
          (program.classRepLimit as number | undefined) ?? 0
        );

        // Store original pricing values for change detection (keep in cents)
        setOriginalPricing({
          isFree: program.isFree ?? false,
          fullPriceTicket: (program.fullPriceTicket as number | undefined) ?? 0,
          classRepDiscount:
            (program.classRepDiscount as number | undefined) ?? 0,
          earlyBirdDiscount:
            (program.earlyBirdDiscount as number | undefined) ?? 0,
          earlyBirdDeadline: program.earlyBirdDeadline
            ? program.earlyBirdDeadline.split("T")[0]
            : "",
        });

        // Transform backend mentors to frontend format
        const transformMentorFromBackend = (m: {
          userId: string;
          firstName?: string;
          lastName?: string;
          email?: string;
          gender?: "male" | "female";
          avatar?: string;
          roleInAtCloud?: string;
        }): Mentor => ({
          id: m.userId,
          firstName: m.firstName || "",
          lastName: m.lastName || "",
          systemAuthorizationLevel: "Leader", // Default for mentors
          roleInAtCloud: m.roleInAtCloud,
          gender: (m.gender as "male" | "female") || "male",
          avatar: m.avatar || null,
          email: m.email || "",
          phone: "", // Not stored in program mentors
        });

        // Load unified mentors for all program types
        if (program.mentors) {
          const transformedMentors = program.mentors.map(
            transformMentorFromBackend
          );
          setMentors(transformedMentors);
          setOriginalMentors(transformedMentors);
          // Store mentor user IDs for permission checking
          setProgramMentorIds(
            program.mentors.map((m: { userId: string }) => m.userId)
          );
        }
      } catch (error) {
        console.error("Error loading program:", error);
        alert("Failed to load program. Please try again.");
        navigate("/dashboard/programs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, setValue, navigate]);

  // Unified mentor change handler for all program types
  const handleMentorsChange = (newMentors: Mentor[]) => {
    setMentors(newMentors);
  };

  const handleActualSubmit = async (data: ProgramFormData) => {
    if (!id) return;

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
      const payload: ProgramUpdatePayload = {
        title: data.title,
        programType: data.programType as ProgramType,
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
        // Centralized flyer removal/replacement/no-op logic
        flyerUrl: deriveFlyerUrlForUpdate(originalFlyerUrl, data.flyerUrl),
        isFree: data.isFree === "true",
        earlyBirdDeadline: data.earlyBirdDeadline
          ? data.earlyBirdDeadline
          : undefined,
        // Pricing from form - convert dollars to cents
        fullPriceTicket: Number.isFinite(data.fullPriceTicket as number)
          ? Math.round((data.fullPriceTicket as number) * 100)
          : 0,
        classRepDiscount: Number.isFinite(data.classRepDiscount as number)
          ? Math.round((data.classRepDiscount as number) * 100)
          : 0,
        earlyBirdDiscount: Number.isFinite(data.earlyBirdDiscount as number)
          ? Math.round((data.earlyBirdDiscount as number) * 100)
          : 0,
        classRepLimit: Number.isFinite(data.classRepLimit as number)
          ? (data.classRepLimit as number)
          : 0,
      };

      // Add unified mentors for all program types
      payload.mentors = mentors.map(transformMentor);

      console.log("Updating program with payload:", payload);

      // Update the program via API
      await programService.updateProgram(id, payload);

      console.log("Program updated successfully");
      navigate(`/dashboard/programs/${id}`);
    } catch (error) {
      console.error("Error updating program:", error);
      // TODO: Show user-friendly error message
      alert("Failed to update program. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(`/dashboard/programs/${id}`);
  };

  // Check if user needs the restricted access overlay
  // Allow Super Admin, Administrator, and program mentors to edit
  const isAdmin =
    currentUser?.role === "Super Admin" ||
    currentUser?.role === "Administrator";
  const isMentor = currentUser?.id && programMentorIds.includes(currentUser.id);
  const shouldShowRestrictedOverlay = !isAdmin && !isMentor;

  if (loading) {
    // Standardized dashboard loading: centered, fullscreen, larger spinner
    return <LoadingSpinner size="lg" />;
  }

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
                Edit Program access requires authorization
              </h2>
              <p className="text-sm text-gray-600">
                To edit programs, you need Administrator, Super Admin
                privileges, or be assigned as a mentor for this program. Please
                contact your system administrators to request access.
              </p>
            </div>
          </div>
        )}

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Program</h1>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          <ProgramFormFields
            register={register}
            watch={watch}
            setValue={setValue}
            errors={errors}
            validations={validations}
            currentUser={currentUser}
            mentors={mentors}
            onMentorsChange={handleMentorsChange}
            originalFlyerUrl={originalFlyerUrl}
            YEARS={YEARS}
            MONTHS={MONTHS}
          />

          {/* Tuition (Phase 3) */}
          <PricingSection register={register} watch={watch} errors={errors} />

          {/* Overall Validation Status */}
          <div className="mb-4">
            <ValidationIndicator
              validation={combinedValidation}
              showWhenEmpty={true}
            />
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-6">
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
              disabled={isSubmitting || !customIsDirty}
            >
              {isSubmitting ? "Updating..." : "Update Program"}
            </button>
          </div>
        </form>
      </div>

      {/* Pricing Confirmation Modal */}
      <PricingConfirmationModal
        show={showConfirmation}
        step={confirmationStep}
        isSubmitting={isSubmitting}
        originalPricing={originalPricing}
        currentIsFree={isFreeProgram === "true"}
        currentFullPrice={fullPrice}
        currentClassRepDiscount={watch("classRepDiscount")}
        currentEarlyBirdDiscount={earlyBirdDiscountValue}
        currentEarlyBirdDeadline={earlyBirdDeadline}
        onNext={handleConfirmationNext}
        onCancel={handleConfirmationCancel}
      />
    </div>
  );
}
