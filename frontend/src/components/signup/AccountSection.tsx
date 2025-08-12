import type { UseFormRegister, FieldErrors } from "react-hook-form";
import type { SignUpFormData } from "../../schemas/signUpSchema";
import { FORM_SECTIONS } from "../../config/signUpConstants";
import UniversalPasswordField from "../forms/common/UniversalPasswordField";
import UniversalPasswordRequirements from "../forms/common/UniversalPasswordRequirements";
import FormField from "../forms/FormField";
import UsernameRequirements from "../forms/common/UsernameRequirements";
import { FormSectionWrapper } from "../forms/common";

interface AccountSectionProps {
  register: UseFormRegister<SignUpFormData>;
  errors: FieldErrors<SignUpFormData>;
  username: string;
  password: string;
}

export default function AccountSection({
  register,
  errors,
  username,
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

      {/* Username Requirements */}
      <UsernameRequirements username={username || ""} className="mt-3" />

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
