import type { UseFormRegister, FieldErrors } from "react-hook-form";
import type { SignUpFormData } from "../../schemas/signUpSchema";
import { FORM_SECTIONS } from "../../config/signUpConstants";
import UniversalPasswordField from "../forms/common/UniversalPasswordField";
import UniversalPasswordRequirements from "../forms/common/UniversalPasswordRequirements";
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
      <UniversalPasswordField
        name="password"
        label="Password"
        register={register}
        errors={errors}
        password={password}
        showStrengthIndicator={true}
      />

      <UniversalPasswordField
        name="confirmPassword"
        label="Confirm Password"
        register={register}
        errors={errors}
      />

      {/* Password Requirements */}
      <UniversalPasswordRequirements password={password || ""} />
    </FormSectionWrapper>
  );
}
