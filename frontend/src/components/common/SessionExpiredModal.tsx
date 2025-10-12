import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onSessionExpired } from "../../services/session";
import AlertModal from "./AlertModal";

/**
 * Global session expiration handler that shows a custom modal
 * instead of browser alert when session expires.
 */
export default function SessionExpiredModal() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Register listener for session expiration events
    const unsubscribe = onSessionExpired(() => {
      setIsOpen(true);
    });

    return unsubscribe;
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    // Navigate to login page after closing modal
    navigate("/login");
  };

  return (
    <AlertModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Session Expired"
      message="Your session has expired. Please login again."
      type="warning"
      buttonText="Login"
    />
  );
}
