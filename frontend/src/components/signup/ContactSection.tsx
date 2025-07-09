import type { UseFormRegister, FieldErrors } from "react-hook-form";
import type { SignUpFormData } from "../../schemas/signUpSchema";
import { FORM_SECTIONS } from "../../config/signUpConstants";
import FormField from "../forms/FormField";

interface ContactSectionProps {
  register: UseFormRegister<SignUpFormData>;
  errors: FieldErrors<SignUpFormData>;
}

export default function ContactSection({
  register,
  errors,
}: ContactSectionProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        {FORM_SECTIONS.contact.title}
      </h2>
      <p className="text-gray-600 mb-4">{FORM_SECTIONS.contact.description}</p>

      <div className="space-y-4">
        {/* Contact Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="Email"
            name="email"
            register={register}
            errors={errors}
            type="email"
            placeholder="Enter your email address"
            required={true}
          />
          <FormField
            label="Phone"
            name="phone"
            register={register}
            errors={errors}
            type="tel"
            placeholder="Enter your phone number"
            required={false}
          />
        </div>
      </div>
    </div>
  );
}
