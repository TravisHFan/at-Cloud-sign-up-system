import * as yup from "yup";
import { passwordValidation } from "./common/passwordValidation";

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

  password: passwordValidation.password,

  confirmPassword: passwordValidation.confirmPassword("password"),

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
  occupation: yup.string().optional(),
  company: yup.string().optional(),
  weeklyChurch: yup.string().optional(),
  churchAddress: yup.string().optional(),
});

export type SignUpFormData = yup.InferType<typeof signUpSchema>;
