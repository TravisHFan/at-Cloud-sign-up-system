import * as yup from "yup";

export const signUpSchema = yup.object({
  username: yup
    .string()
    .required("Username is required")
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be less than 20 characters")
    .matches(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),

  password: yup
    .string()
    .required("Password is required")
    .min(8, "Password must be at least 8 characters")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),

  confirmPassword: yup
    .string()
    .required("Please confirm your password")
    .oneOf([yup.ref("password")], "Passwords must match"),

  firstName: yup.string().required("First name is required"),
  lastName: yup.string().required("Last name is required"),
  gender: yup
    .string()
    .required("Gender is required")
    .oneOf(["male", "female"], "Please select a valid gender"),
  email: yup
    .string()
    .email("Invalid email address")
    .required("Email is required"),
  phone: yup.string().optional(),

  isAtCloudLeader: yup
    .string()
    .required("Please select if you are an @Cloud Leader"),
  roleInAtCloud: yup.string().when("isAtCloudLeader", {
    is: "true",
    then: (schema) => schema.required("Please describe your role in @Cloud"),
    otherwise: (schema) => schema.optional(),
  }),

  homeAddress: yup.string().optional(),
  company: yup.string().optional(),
  weeklyChurch: yup.string().optional(),
  churchAddress: yup.string().optional(),
});

export type SignUpFormData = yup.InferType<typeof signUpSchema>;
