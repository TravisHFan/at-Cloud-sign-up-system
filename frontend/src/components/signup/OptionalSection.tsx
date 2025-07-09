import type { UseFormRegister, FieldErrors } from "react-hook-form";
import type { SignUpFormData } from "../../schemas/signUpSchema";
import { FORM_SECTIONS } from "../../config/signUpConstants";
import FormField from "../forms/FormField";
import TextareaField from "../forms/TextareaField";

interface OptionalSectionProps {
  register: UseFormRegister<SignUpFormData>;
  errors: FieldErrors<SignUpFormData>;
}

export default function OptionalSection({
  register,
  errors,
}: OptionalSectionProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        {FORM_SECTIONS.optional.title}
      </h2>
      <p className="text-gray-600 mb-4">{FORM_SECTIONS.optional.description}</p>

      <div className="space-y-4">
        {/* Home Address */}
        <TextareaField
          label="Home Address"
          name="homeAddress"
          register={register}
          errors={errors}
          placeholder="Enter your home address"
          required={false}
        />

        {/* Company */}
        <FormField
          label="Company"
          name="company"
          register={register}
          errors={errors}
          placeholder="Your company or organization"
          required={false}
        />
      </div>
    </div>
  );
}
