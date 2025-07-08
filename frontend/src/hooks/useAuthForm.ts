import { useState } from "react";

export function useAuthForm() {
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const showForgotPasswordForm = () => {
    setShowForgotPassword(true);
  };

  const showLoginForm = () => {
    setShowForgotPassword(false);
  };

  return {
    showForgotPassword,
    showForgotPasswordForm,
    showLoginForm,
  };
}