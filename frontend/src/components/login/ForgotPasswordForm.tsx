import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { forgotPasswordSchema } from "../../schemas/loginSchema";
import type { ForgotPasswordFormData } from "../../schemas/loginSchema";
import { FormField, Button, Card, CardContent } from "../ui";
import LoginHeader from "./LoginHeader";

interface ForgotPasswordFormProps {
  onSubmit: (data: ForgotPasswordFormData) => void;
  isSubmitting: boolean;
  onBackToLogin: () => void;
}

export default function ForgotPasswordForm({
  onSubmit,
  isSubmitting,
  onBackToLogin,
}: ForgotPasswordFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: yupResolver(forgotPasswordSchema),
  });

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <LoginHeader
          title="Reset your password"
          subtitle="Enter your email address and we'll send you a link to reset your password."
        />

        <Card>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                label="Email Address"
                name="email"
                register={register}
                errors={errors}
                type="email"
                placeholder="Enter your email address"
                required={true}
              />

              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Sending..." : "Send Recovery Email"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Button variant="link" onClick={onBackToLogin}>
                ← Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
