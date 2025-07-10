import type { UseFormRegister, FieldErrors } from "react-hook-form";
import type { SignUpFormData } from "../../schemas/signUpSchema";
import { FORM_SECTIONS } from "../../config/signUpConstants";
import PasswordField from "../forms/PasswordField";
import ConfirmPasswordField from "../forms/ConfirmPasswordField";
import { FormField } from "../ui";
import { FormSectionWrapper } from "../forms/common";

interface AccountSectionProps {
  register: UseFormRegister<SignUpFormData>;
  errors: FieldErrors<SignUpFormData>;
  password: string;
}

export default function AccountSection({
  register,
  errors,
  password,
}: AccountSectionProps) {
  return (
    <FormSectionWrapper
      title={FORM_SECTIONS.account.title}
      description={FORM_SECTIONS.account.description}
    >
      {/* Username */}
      <FormField
        label="Username"
        name="username"
        register={register}
        errors={errors}
        placeholder="Choose a username"
        required={true}
      />

      {/* Password Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PasswordField
          register={register}
          errors={errors}
          password={password}
          showStrengthIndicator={true}
        />
        <ConfirmPasswordField register={register} errors={errors} />
      </div>
    </FormSectionWrapper>
  );
}
