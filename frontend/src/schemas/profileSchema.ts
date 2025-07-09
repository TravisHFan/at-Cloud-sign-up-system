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
  roleInAtCloud: yup.string().required("Role in @Cloud is required"),
  atCloudRole: yup.string().required("@Cloud role is required"),
  homeAddress: yup.string().notRequired(),
  company: yup.string().notRequired(),
});

export type ProfileFormData = yup.InferType<typeof profileSchema>;

export interface UserData extends ProfileFormData {
  avatar: string;
  systemRole: string;
}
