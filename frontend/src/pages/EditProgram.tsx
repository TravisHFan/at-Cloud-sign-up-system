import { useState, useEffect, useMemo } from "react";
import { formatCurrency } from "../utils/currency";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../hooks/useAuth";
import { useProgramValidation } from "../hooks/useProgramValidation";
import OrganizerSelection from "../components/events/OrganizerSelection";
import ValidationIndicator from "../components/events/ValidationIndicator";
import { fileService, programService } from "../services/api";

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
  programType: "EMBA Mentor Circles" | "Effective Communication Workshops";
  hostedBy?: string;
  period: {
    startYear?: string;
    startMonth?: string;
    endYear?: string;
    endMonth?: string;
  };
  introduction?: string;
  flyerUrl?: string;
  isFree?: boolean;
  earlyBirdDeadline?: string;
  mentors?: MentorPayload[];
  mentorsByCircle?: {
    E?: MentorPayload[];
    M?: MentorPayload[];
    B?: MentorPayload[];
    A?: MentorPayload[];
  };
  // Pricing fields (kept here until form fields are added)
  fullPriceTicket: number;
  classRepDiscount?: number;
  earlyBirdDiscount?: number;
};

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

  // Separate mentor states for different program types
  const [effectiveCommunicationMentors, setEffectiveCommunicationMentors] =
    useState<Mentor[]>([]);
  const [eMentors, setEMentors] = useState<Mentor[]>([]);
  const [mMentors, setMMentors] = useState<Mentor[]>([]);
  const [bMentors, setBMentors] = useState<Mentor[]>([]);
  const [aMentors, setAMentors] = useState<Mentor[]>([]);

  // Store original mentor arrays to detect changes
  const [
    originalEffectiveCommunicationMentors,
    setOriginalEffectiveCommunicationMentors,
  ] = useState<Mentor[]>([]);
  const [originalEMentors, setOriginalEMentors] = useState<Mentor[]>([]);
  const [originalMMentors, setOriginalMMentors] = useState<Mentor[]>([]);
  const [originalBMentors, setOriginalBMentors] = useState<Mentor[]>([]);
  const [originalAMentors, setOriginalAMentors] = useState<Mentor[]>([]);

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
      earlyBirdDeadline: "",
    },
  });

  const selectedProgramType = watch("programType");
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
      fullPrice <= 2000 &&
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

  // Check if mentors have changed
  const mentorsChanged =
    selectedProgramType === "Effective Communication Workshops"
      ? !compareMentorArrays(
          effectiveCommunicationMentors,
          originalEffectiveCommunicationMentors
        )
      : !compareMentorArrays(eMentors, originalEMentors) ||
        !compareMentorArrays(mMentors, originalMMentors) ||
        !compareMentorArrays(bMentors, originalBMentors) ||
        !compareMentorArrays(aMentors, originalAMentors);

  // Custom isDirty that includes mentor changes
  const customIsDirty = isDirty || mentorsChanged;

  // Check if pricing has changed
  const hasPricingChanges = useMemo(() => {
    const currentIsFree = isFreeProgram === "true";
    const currentFullPrice = fullPrice ?? 0;
    const currentClassRep = watch("classRepDiscount") ?? 0;
    const currentEarlyBird = earlyBirdDiscountValue ?? 0;
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

  // Load existing program data
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const program = (await programService.getById(id)) as {
          title?: string;
          programType?:
            | "EMBA Mentor Circles"
            | "Effective Communication Workshops";
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
          mentorsByCircle?: {
            E?: Array<{
              userId: string;
              firstName?: string;
              lastName?: string;
              email?: string;
              gender?: "male" | "female";
              avatar?: string;
              roleInAtCloud?: string;
            }>;
            M?: Array<{
              userId: string;
              firstName?: string;
              lastName?: string;
              email?: string;
              gender?: "male" | "female";
              avatar?: string;
              roleInAtCloud?: string;
            }>;
            B?: Array<{
              userId: string;
              firstName?: string;
              lastName?: string;
              email?: string;
              gender?: "male" | "female";
              avatar?: string;
              roleInAtCloud?: string;
            }>;
            A?: Array<{
              userId: string;
              firstName?: string;
              lastName?: string;
              email?: string;
              gender?: "male" | "female";
              avatar?: string;
              roleInAtCloud?: string;
            }>;
          };
          fullPriceTicket?: number;
          classRepDiscount?: number;
          earlyBirdDiscount?: number;
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
        // Pricing
        setValue(
          "fullPriceTicket",
          (program.fullPriceTicket as number | undefined) ?? 0
        );
        setValue(
          "classRepDiscount",
          (program.classRepDiscount as number | undefined) ?? 0
        );
        setValue(
          "earlyBirdDiscount",
          (program.earlyBirdDiscount as number | undefined) ?? 0
        );

        // Store original pricing values for change detection
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

        // Set mentor states based on program type
        if (program.mentors) {
          const transformedMentors = program.mentors.map(
            transformMentorFromBackend
          );
          setEffectiveCommunicationMentors(transformedMentors);
          setOriginalEffectiveCommunicationMentors(transformedMentors);
        }
        if (program.mentorsByCircle) {
          const transformedE = (program.mentorsByCircle.E || []).map(
            transformMentorFromBackend
          );
          const transformedM = (program.mentorsByCircle.M || []).map(
            transformMentorFromBackend
          );
          const transformedB = (program.mentorsByCircle.B || []).map(
            transformMentorFromBackend
          );
          const transformedA = (program.mentorsByCircle.A || []).map(
            transformMentorFromBackend
          );

          setEMentors(transformedE);
          setMMentors(transformedM);
          setBMentors(transformedB);
          setAMentors(transformedA);

          setOriginalEMentors(transformedE);
          setOriginalMMentors(transformedM);
          setOriginalBMentors(transformedB);
          setOriginalAMentors(transformedA);
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

  const handleEffectiveCommunicationMentorsChange = (mentors: Mentor[]) => {
    setEffectiveCommunicationMentors(mentors);
  };

  const handleEMentorsChange = (mentors: Mentor[]) => {
    setEMentors(mentors);
  };

  const handleMMentorsChange = (mentors: Mentor[]) => {
    setMMentors(mentors);
  };

  const handleBMentorsChange = (mentors: Mentor[]) => {
    setBMentors(mentors);
  };

  const handleAMentorsChange = (mentors: Mentor[]) => {
    setAMentors(mentors);
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
        isFree: data.isFree === "true",
        earlyBirdDeadline: data.earlyBirdDeadline
          ? data.earlyBirdDeadline
          : undefined,
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

      // Add mentors based on program type
      if (data.programType === "Effective Communication Workshops") {
        payload.mentors = effectiveCommunicationMentors.map(transformMentor);
      } else if (data.programType === "EMBA Mentor Circles") {
        payload.mentorsByCircle = {
          E: eMentors.map(transformMentor),
          M: mMentors.map(transformMentor),
          B: bMentors.map(transformMentor),
          A: aMentors.map(transformMentor),
        };
      }

      console.log("Updating program with payload:", payload);

      // Update the program via API
      await programService.update(id, payload);

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

  // Check if user needs the restricted access overlay (Participant or Guest Expert)
  const shouldShowRestrictedOverlay =
    currentUser?.role === "Participant" || currentUser?.role === "Guest Expert";

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
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
                Edit Program access requires @Cloud Co‑worker authorization
              </h2>
              <p className="text-sm text-gray-600">
                To edit programs, you'll need elevated permissions. Please
                contact your @Cloud Leaders to request access.
              </p>
            </div>
          </div>
        )}

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Program</h1>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
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
              <option value="">Select program type</option>
              {PROGRAM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {errors.programType && (
              <p className="mt-1 text-sm text-red-600">
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
              <p className="mt-1 text-sm text-red-600">
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
                <p className="mt-1 text-sm text-red-600">
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
                <p className="mt-1 text-sm text-red-600">
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
                <p className="mt-1 text-sm text-red-600">
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
                <p className="mt-1 text-sm text-red-600">
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

          {/* Mentors Selection - conditional based on program type */}
          {currentUser &&
            selectedProgramType === "Effective Communication Workshops" && (
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
                  selectedOrganizers={effectiveCommunicationMentors}
                  onOrganizersChange={handleEffectiveCommunicationMentorsChange}
                  hideMainOrganizer={true}
                  excludeMainOrganizer={false}
                  organizersLabel="Mentors"
                  buttonText="Add Mentors"
                />
              </div>
            )}

          {currentUser && selectedProgramType === "EMBA Mentor Circles" && (
            <div className="space-y-6">
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Mentors for Each Circle
              </label>

              {/* E Circle Mentors */}
              <div className="space-y-2">
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
                  selectedOrganizers={eMentors}
                  onOrganizersChange={handleEMentorsChange}
                  hideMainOrganizer={true}
                  excludeMainOrganizer={false}
                  organizersLabel="Mentors for E Circle"
                  buttonText="Add Mentors for E Circle"
                />
              </div>

              {/* M Circle Mentors */}
              <div className="space-y-2">
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
                  selectedOrganizers={mMentors}
                  onOrganizersChange={handleMMentorsChange}
                  hideMainOrganizer={true}
                  excludeMainOrganizer={false}
                  organizersLabel="Mentors for M Circle"
                  buttonText="Add Mentors for M Circle"
                />
              </div>

              {/* B Circle Mentors */}
              <div className="space-y-2">
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
                  selectedOrganizers={bMentors}
                  onOrganizersChange={handleBMentorsChange}
                  hideMainOrganizer={true}
                  excludeMainOrganizer={false}
                  organizersLabel="Mentors for B Circle"
                  buttonText="Add Mentors for B Circle"
                />
              </div>

              {/* A Circle Mentors */}
              <div className="space-y-2">
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
                  selectedOrganizers={aMentors}
                  onOrganizersChange={handleAMentorsChange}
                  hideMainOrganizer={true}
                  excludeMainOrganizer={false}
                  organizersLabel="Mentors for A Circle"
                  buttonText="Add Mentors for A Circle"
                />
              </div>
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
              <p className="mt-1 text-sm text-red-600">
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

          {/* Pricing (Phase 3) */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Pricing
            </h2>

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
                  Enter whole-dollar amounts between 1 and 2000. Discounts
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
                      max={2000}
                      step={1}
                      {...register("fullPriceTicket", {
                        valueAsNumber: true,
                        required: "Full price is required",
                        min: { value: 1, message: "Must be ≥ 1" },
                        max: { value: 2000, message: "Must be ≤ 2000" },
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
                    {/* Real-time validation prompt */}
                    {isFreeProgram === "false" && (
                      <p className="mt-1 text-xs text-red-500">
                        {fullPrice === undefined ||
                        fullPrice === null ||
                        fullPrice <= 0
                          ? "Full Price Ticket is required"
                          : ""}
                      </p>
                    )}
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
                      max={2000}
                      step={1}
                      {...register("classRepDiscount", {
                        valueAsNumber: true,
                        min: { value: 0, message: "Must be ≥ 0" },
                        max: { value: 2000, message: "Must be ≤ 2000" },
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
                      max={2000}
                      step={1}
                      {...register("earlyBirdDiscount", {
                        valueAsNumber: true,
                        min: { value: 0, message: "Must be ≥ 0" },
                        max: { value: 2000, message: "Must be ≤ 2000" },
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
                      Early Bird Deadline{" "}
                      {earlyBirdDiscountValue &&
                        Number(earlyBirdDiscountValue) > 0 && (
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
                  <div className="text-sm text-gray-600 mb-2">
                    Computed Examples
                  </div>
                  {(() => {
                    const full = Number(fullPrice || 0);
                    const rep = Number(watch("classRepDiscount") || 0);
                    const early = Number(earlyBirdDiscountValue || 0);
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
      {showConfirmation && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            {/* Background overlay */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={handleConfirmationCancel}
            ></div>

            {/* Modal panel */}
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={
                confirmationStep === 1
                  ? "pricing-confirmation-title"
                  : "pricing-final-title"
              }
              className="relative inline-block bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all max-w-lg w-full mx-4 sm:p-6"
            >
              {confirmationStep === 1 ? (
                <>
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                      <svg
                        className="h-6 w-6 text-yellow-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.12 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <h3
                        id="pricing-confirmation-title"
                        className="text-lg leading-6 font-medium text-gray-900"
                      >
                        Pricing Changes Detected
                      </h3>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          You have made changes to the program's pricing
                          section. This will affect how participants are charged
                          for this program.
                        </p>
                        <div className="mt-3 p-3 bg-gray-50 rounded-md">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">
                            Changes detected:
                          </h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {originalPricing.isFree !==
                              (isFreeProgram === "true") && (
                              <li>
                                • Program type:{" "}
                                {originalPricing.isFree ? "Free" : "Paid"} →{" "}
                                {isFreeProgram === "true" ? "Free" : "Paid"}
                              </li>
                            )}
                            {originalPricing.fullPriceTicket !==
                              (fullPrice ?? 0) && (
                              <li>
                                • Full price:{" "}
                                {formatCurrency(
                                  originalPricing.fullPriceTicket || 0
                                )}{" "}
                                → {formatCurrency(fullPrice || 0)}
                              </li>
                            )}
                            {originalPricing.classRepDiscount !==
                              (watch("classRepDiscount") ?? 0) && (
                              <li>
                                • Class rep discount:{" "}
                                {formatCurrency(
                                  originalPricing.classRepDiscount || 0
                                )}{" "}
                                →{" "}
                                {formatCurrency(watch("classRepDiscount") || 0)}
                              </li>
                            )}
                            {originalPricing.earlyBirdDiscount !==
                              (earlyBirdDiscountValue ?? 0) && (
                              <li>
                                • Early bird discount:{" "}
                                {formatCurrency(
                                  originalPricing.earlyBirdDiscount || 0
                                )}{" "}
                                → {formatCurrency(earlyBirdDiscountValue || 0)}
                              </li>
                            )}
                            {originalPricing.earlyBirdDeadline !==
                              (earlyBirdDeadline ?? "") && (
                              <li>
                                • Early bird deadline:{" "}
                                {originalPricing.earlyBirdDeadline || "None"} →{" "}
                                {earlyBirdDeadline || "None"}
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-yellow-600 text-base font-medium text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 sm:ml-3 sm:w-auto sm:text-sm"
                      onClick={handleConfirmationNext}
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                      onClick={handleConfirmationCancel}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                      <svg
                        className="h-6 w-6 text-red-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.12 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <h3
                        id="pricing-final-title"
                        className="text-lg leading-6 font-medium text-gray-900"
                      >
                        Final Confirmation
                      </h3>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Are you absolutely sure you want to update the pricing
                          for this program? This action cannot be undone and
                          will immediately affect all future registrations.
                        </p>
                        <div className="mt-3 p-3 bg-red-50 rounded-md">
                          <p className="text-sm font-medium text-red-800">
                            ⚠️ This will change how participants are charged
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                      onClick={handleConfirmationNext}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Updating..." : "Yes, Update Pricing"}
                    </button>
                    <button
                      type="button"
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                      onClick={handleConfirmationCancel}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
