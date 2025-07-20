import * as yup from "yup";

// Password change validation schema
export const changePasswordSchema = yup.object({
  currentPassword: yup.string().required("Current password is required"),
  newPassword: yup
    .string()
    .required("New password is required")
    .min(8, "Password must be at least 8 characters")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  confirmPassword: yup
    .string()
    .required("Please confirm your new password")
    .oneOf([yup.ref("newPassword")], "Passwords must match"),
});

export type ChangePasswordFormData = yup.InferType<typeof changePasswordSchema>;

// Password requirements for display
export const PASSWORD_REQUIREMENTS = [
  {
    key: "length",
    label: "At least 8 characters long",
    test: (password: string) => (password?.length || 0) >= 8,
  },
  {
    key: "lowercase",
    label: "Contains lowercase letters",
    test: (password: string) => /[a-z]/.test(password || ""),
  },
  {
    key: "uppercase",
    label: "Contains uppercase letters",
    test: (password: string) => /[A-Z]/.test(password || ""),
  },
  {
    key: "numbers",
    label: "Contains numbers",
    test: (password: string) => /\d/.test(password || ""),
  },
] as const;
