import * as yup from "yup";

// Allow user to supply either a username or an email in a single field
export const loginSchema = yup
  .object({
    emailOrUsername: yup
      .string()
      .required("Username or email is required")
      .min(3, "Must be at least 3 characters"),
    password: yup.string().required("Password is required"),
    rememberMe: yup.boolean().default(false),
  })
  .required();

export const forgotPasswordSchema = yup.object({
  email: yup.string().email("Invalid email").required("Email is required"),
});

export type LoginFormData = yup.InferType<typeof loginSchema>;
export type ForgotPasswordFormData = yup.InferType<typeof forgotPasswordSchema>;
