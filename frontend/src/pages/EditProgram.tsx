import { useState, useEffect } from "react";
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
      fullPriceTicket: 0,
      classRepDiscount: 0,
      earlyBirdDiscount: 0,
    },
  });

  const selectedProgramType = watch("programType");

  // Real-time validation
  const { validations, overallStatus } = useProgramValidation(watch);

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

  const onSubmit = async (data: ProgramFormData) => {
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
            <p className="text-xs text-gray-600 mb-3">
              Enter whole-dollar amounts between 0 and 2000. Discounts reduce
              the full price. Combined discounts cannot exceed the full price.
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
                  min={0}
                  max={2000}
                  step={1}
                  {...register("fullPriceTicket", {
                    valueAsNumber: true,
                    required: "Full price is required",
                    min: { value: 0, message: "Must be ≥ 0" },
                    max: { value: 2000, message: "Must be ≤ 2000" },
                    validate: (v) =>
                      Number.isInteger(v as number) || "Must be an integer",
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.fullPriceTicket && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.fullPriceTicket.message}
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
                  <p className="mt-1 text-sm text-red-600">
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
                  <p className="mt-1 text-sm text-red-600">
                    {errors.earlyBirdDiscount.message}
                  </p>
                )}
              </div>
            </div>
            {(() => {
              const full = Number(watch("fullPriceTicket") || 0);
              const rep = Number(watch("classRepDiscount") || 0);
              const early = Number(watch("earlyBirdDiscount") || 0);
              const combinedTooLarge = full - rep - early < 0;
              return combinedTooLarge ? (
                <p className="mt-2 text-sm text-red-600">
                  Combined discounts cannot exceed the full price.
                </p>
              ) : null;
            })()}
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
          </div>

          {/* Overall Validation Status */}
          <div className="mb-4">
            <ValidationIndicator
              validation={overallStatus}
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
    </div>
  );
}
