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
      <FormField
        label="Phone"
        name="phone"
        register={register}
        errors={errors}
        type="tel"
        placeholder="Enter your phone number"
        required={false}
      />
    </FormSectionWrapper>
  );
}
