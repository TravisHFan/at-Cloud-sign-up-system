import type { UseFormRegister, FieldErrors } from "react-hook-form";
import TextareaField from "../forms/TextareaField";

interface LeaderQuestionSectionProps<
  TForm extends Record<string, unknown> = Record<string, unknown>
> {
  register: UseFormRegister<TForm>;
  errors: FieldErrors<TForm>;
  isAtCloudLeader: string;
}

export default function LeaderQuestionSection<
  TForm extends Record<string, unknown> = Record<string, unknown>
>({ register, errors, isAtCloudLeader }: LeaderQuestionSectionProps<TForm>) {
  return (
    <>
      {/* @Cloud Co-worker Question */}
      <div className="border rounded-lg p-4 bg-blue-50">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Are you an @Cloud Co-worker? <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              {...register(
                "isAtCloudLeader" as unknown as Parameters<typeof register>[0]
              )}
              type="radio"
              value="true"
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Yes</span>
          </label>
          <label className="flex items-center">
            <input
              {...register(
                "isAtCloudLeader" as unknown as Parameters<typeof register>[0]
              )}
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
            name={"roleInAtCloud" as unknown as Parameters<typeof register>[0]}
            register={register}
            errors={errors}
            placeholder="Please describe your role in @Cloud organization (e.g., Founder, CFO, Event Director, IT Director, etc.)"
            required={true}
          />
          <p className="mt-2 text-sm text-blue-600">
            Note: The Admin will receive an email notification about your @Cloud
            Co-worker role request.
          </p>
        </div>
      )}
    </>
  );
}
