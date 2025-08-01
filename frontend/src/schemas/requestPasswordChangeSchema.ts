import * as yup from "yup";
import { passwordValidation } from "./common/passwordValidation";

export const requestPasswordChangeSchema = yup.object({
  currentPassword: passwordValidation.currentPassword,
  newPassword: passwordValidation.newPassword,
  confirmPassword: passwordValidation.confirmPassword("newPassword"),
});

export type RequestPasswordChangeFormData = yup.InferType<
  typeof requestPasswordChangeSchema
>;
