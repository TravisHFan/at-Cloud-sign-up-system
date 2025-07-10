import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { loginSchema } from "../schemas/loginSchema";
import type {
  LoginFormData,
  ForgotPasswordFormData,
} from "../schemas/loginSchema";
import { FormField } from "../components/ui";
import LoginPasswordField from "../components/forms/LoginPasswordField";
import {
  LoginHeader,
  LoginFormWrapper,
  LoginAttemptsWarning,
  ForgotPasswordForm,
} from "../components/login";
import { useLogin } from "../hooks/useLogin";
import { useForgotPassword } from "../hooks/useForgotPassword";
import { useAuthForm } from "../hooks/useAuthForm";

export default function Login() {
  const { isSubmitting, loginAttempts, handleLogin, resetLoginAttempts } =
    useLogin();
  const { isSubmitting: isRecoverySubmitting, handleForgotPassword } =
    useForgotPassword();
  const { showForgotPassword, showForgotPasswordForm, showLoginForm } =
    useAuthForm();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    await handleLogin(data);
  };

  const onForgotPasswordSubmit = async (data: ForgotPasswordFormData) => {
    const success = await handleForgotPassword(data);
    if (success) {
      showLoginForm();
      resetLoginAttempts();
    }
  };

  if (showForgotPassword) {
    return (
      <ForgotPasswordForm
        onSubmit={onForgotPasswordSubmit}
        isSubmitting={isRecoverySubmitting}
        onBackToLogin={showLoginForm}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <LoginHeader />

        <LoginFormWrapper
          onSubmit={handleSubmit(onSubmit)}
          isSubmitting={isSubmitting}
          loginAttempts={loginAttempts}
          onForgotPassword={showForgotPasswordForm}
        >
          <LoginAttemptsWarning loginAttempts={loginAttempts} />

          <FormField
            label="Username"
            name="username"
            register={register}
            errors={errors}
            placeholder="Enter your username"
            required={true}
            className={loginAttempts >= 5 ? "opacity-50" : ""}
          />

          <LoginPasswordField
            register={register}
            errors={errors}
            disabled={loginAttempts >= 5}
          />

          {loginAttempts > 0 && loginAttempts < 5 && (
            <LoginAttemptsWarning loginAttempts={loginAttempts} />
          )}
        </LoginFormWrapper>
      </div>
    </div>
  );
}
