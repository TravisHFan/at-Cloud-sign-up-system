import type { UseFormRegister, FieldErrors } from "react-hook-form";
import type { SignUpFormData } from "../../schemas/signUpSchema";
import { FORM_SECTIONS, GENDER_OPTIONS } from "../../config/signUpConstants";
import FormField from "../forms/FormField";
import SelectField from "../forms/SelectField";

interface PersonalSectionProps {
  register: UseFormRegister<SignUpFormData>;
  errors: FieldErrors<SignUpFormData>;
}

export default function PersonalSection({
  register,
  errors,
}: PersonalSectionProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        {FORM_SECTIONS.personal.title}
      </h2>
      <p className="text-gray-600 mb-4">{FORM_SECTIONS.personal.description}</p>

      <div className="space-y-4">
        {/* Name Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="First Name"
            name="firstName"
            register={register}
            errors={errors}
            placeholder="Enter your first name"
            required={true}
          />
          <FormField
            label="Last Name"
            name="lastName"
            register={register}
            errors={errors}
            placeholder="Enter your last name"
            required={true}
          />
        </div>

        {/* Gender */}
        <SelectField
          label="Gender"
          name="gender"
          register={register}
          errors={errors}
          options={GENDER_OPTIONS}
          placeholder="Select Gender"
          required={true}
        />
      </div>
    </div>
  );
}
