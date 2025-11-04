import type {
  UseFormRegister,
  UseFormWatch,
  UseFormSetValue,
  FieldErrors,
} from "react-hook-form";
import OrganizerSelection from "../events/OrganizerSelection";
import ValidationIndicator from "../events/ValidationIndicator";
import { fileService } from "../../services/api";
import { getProgramTypes } from "../../constants/programTypes";

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

interface User {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  roleInAtCloud?: string;
  gender: "male" | "female";
  avatar?: string | null;
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
  isFree?: string;
  earlyBirdDeadline?: string;
  fullPriceTicket: number | undefined;
  classRepDiscount?: number | undefined;
  earlyBirdDiscount?: number | undefined;
  classRepLimit?: number | undefined;
}

interface Validation {
  isValid: boolean;
  message: string;
  color: string;
}

interface ProgramFormFieldsProps {
  register: UseFormRegister<ProgramFormData>;
  watch: UseFormWatch<ProgramFormData>;
  setValue: UseFormSetValue<ProgramFormData>;
  errors: FieldErrors<ProgramFormData>;
  validations: {
    programType: Validation;
    title: Validation;
    startYear: Validation;
    startMonth: Validation;
    endYear: Validation;
    endMonth: Validation;
    introduction: Validation;
  };
  currentUser: User | null;
  mentors: Mentor[];
  onMentorsChange: (mentors: Mentor[]) => void;
  originalFlyerUrl: string | null;
  YEARS: string[];
  MONTHS: string[];
}

const PROGRAM_TYPES = getProgramTypes();

export default function ProgramFormFields({
  register,
  watch,
  setValue,
  errors,
  validations,
  currentUser,
  mentors,
  onMentorsChange,
  originalFlyerUrl,
  YEARS,
  MONTHS,
}: ProgramFormFieldsProps) {
  return (
    <>
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
          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
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
            onOrganizersChange={onMentorsChange}
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
                  const { url } = await fileService.uploadGenericImage(file);
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
          {(watch("flyerUrl") || originalFlyerUrl) && (
            <button
              type="button"
              className="px-3 py-2 border rounded-md text-red-600 hover:bg-red-50"
              title="Remove current flyer"
              onClick={() => {
                setValue("flyerUrl", "", {
                  shouldDirty: true,
                  shouldValidate: false,
                });
              }}
            >
              Remove
            </button>
          )}
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
    </>
  );
}
