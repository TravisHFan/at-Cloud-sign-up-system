import type { UseFormRegister, FieldErrors } from "react-hook-form";
import type { SignUpFormData } from "../../schemas/signUpSchema";
import { FORM_SECTIONS } from "../../config/signUpConstants";
import PasswordField from "../forms/PasswordField";
import ConfirmPasswordField from "../forms/ConfirmPasswordField";
import FormField from "../forms/FormField";

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
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        {FORM_SECTIONS.account.title}
      </h2>
      <p className="text-gray-600 mb-4">{FORM_SECTIONS.account.description}</p>

      <div className="space-y-4">
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
      </div>
    </div>
  );
}
