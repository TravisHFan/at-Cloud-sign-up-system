import type { UseFormRegister, FieldErrors } from "react-hook-form";
import type { SignUpFormData } from "../../schemas/signUpSchema";
import { FORM_SECTIONS } from "../../config/signUpConstants";
import { FormField } from "../ui";
import { FormSectionWrapper } from "../forms/common";

interface ContactSectionProps {
  register: UseFormRegister<SignUpFormData>;
  errors: FieldErrors<SignUpFormData>;
}

export default function ContactSection({
  register,
  errors,
}: ContactSectionProps) {
  return (
    <FormSectionWrapper
      title={FORM_SECTIONS.contact.title}
      description={FORM_SECTIONS.contact.description}
    >
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
    </FormSectionWrapper>
  );
}
