import * as yup from "yup";

// Profile form validation schema
export const profileSchema = yup.object({
  username: yup
    .string()
    .required("Username is required")
    .min(3, "Username must be at least 3 characters"),
  firstName: yup.string().required("First name is required"),
  lastName: yup.string().required("Last name is required"),
  gender: yup
    .string()
    .required("Gender is required")
    .oneOf(["male", "female"], "Please select a valid gender"),
  email: yup.string().email("Invalid email").required("Email is required"),
  phone: yup.string().notRequired(),
  roleInAtCloud: yup.string().when("isAtCloudLeader", {
    is: "Yes",
    then: (schema) =>
      schema.required(
        "Role in @Cloud is required when you are an @Cloud Leader"
      ),
    otherwise: (schema) => schema.notRequired(),
  }),
  isAtCloudLeader: yup
    .string()
    .required("Please specify if you are an @Cloud Leader")
    .oneOf(["Yes", "No"], "Please select Yes or No"),
  homeAddress: yup.string().notRequired(),
  company: yup.string().notRequired(),
  weeklyChurch: yup.string().notRequired(),
  churchAddress: yup.string().notRequired(),
});

export type ProfileFormData = yup.InferType<typeof profileSchema>;

export interface UserData extends ProfileFormData {
  id: string; // UUID from backend
  avatar: string | null; // Allow null for users without custom avatar
  systemAuthorizationLevel: string;
}
