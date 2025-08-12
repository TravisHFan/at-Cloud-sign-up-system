import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { userService } from "../services/api";

export function useCompletePasswordChange() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAttempted = useRef(false);

  const notification = useToastReplacement();

  const completePasswordChange = async () => {
    if (!token) {
      setError(
        "Invalid password change link. Please request a new password change."
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await userService.completePasswordChange(token);

      // If we reach here, the API call was successful
      setIsSuccess(true);

      notification.success(
        response.message || "Your password has been changed successfully!",
        {
          title: "Password Changed",
          autoCloseDelay: 5000,
        }
      );

      // Redirect to profile page after a short delay
      setTimeout(() => {
        navigate("/dashboard/profile");
      }, 2000);
    } catch (error: unknown) {
      console.error("Error completing password change:", error);

      const errorMessage =
        (error as Error).message ||
        "Unable to complete password change. The link may be invalid or expired.";

      setError(errorMessage);

      notification.error(errorMessage, {
        title: "Password Change Failed",
        actionButton: {
          text: "Request New Change",
          onClick: () => navigate("/dashboard/change-password"),
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Automatically attempt to complete password change when component mounts
  useEffect(() => {
    if (token && !hasAttempted.current && !isLoading && !isSuccess && !error) {
      hasAttempted.current = true;
      completePasswordChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return {
    token,
    isLoading,
    isSuccess,
    error,
    completePasswordChange,
  };
}
