import type { UseFormRegister, FieldErrors } from "react-hook-form";
import TextareaField from "../forms/TextareaField";

interface LeaderQuestionSectionProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  isAtCloudLeader: string;
}

export default function LeaderQuestionSection({
  register,
  errors,
  isAtCloudLeader,
}: LeaderQuestionSectionProps) {
  return (
    <>
      {/* @Cloud Leader Question */}
      <div className="border rounded-lg p-4 bg-blue-50">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Are you an @Cloud Leader? *
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              {...register("isAtCloudLeader")}
              type="radio"
              value="true"
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Yes</span>
          </label>
          <label className="flex items-center">
            <input
              {...register("isAtCloudLeader")}
              type="radio"
              value="false"
              className="mr-2"
            />
            <span className="text-sm text-gray-700">No</span>
          </label>
        </div>
        {typeof errors.isAtCloudLeader?.message === "string" && (
          <p className="mt-1 text-sm text-red-600">
            {errors.isAtCloudLeader.message}
          </p>
        )}
      </div>

      {/* Role in @Cloud (conditional) */}
      {isAtCloudLeader === "true" && (
        <div className="border rounded-lg p-4 bg-green-50">
          <TextareaField
            label="What is your role in @Cloud?"
            name="roleInAtCloud"
            register={register}
            errors={errors}
            placeholder="Please describe your role in @Cloud organization (e.g., Founder, CFO, Event Director, IT Director, etc.)"
            required={true}
          />
          <p className="mt-2 text-sm text-blue-600">
            Note: The Admin will receive an email notification about your Leader
            role request.
          </p>
        </div>
      )}
    </>
  );
}
