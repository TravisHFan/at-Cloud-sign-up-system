import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { onSessionExpired } from "../../services/session";
import AlertModal from "./AlertModal";

/**
 * Global session expiration handler that shows a custom modal
 * instead of browser alert when session expires.
 */
export default function SessionExpiredModal() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Register listener for session expiration events
    const unsubscribe = onSessionExpired(() => {
      setIsOpen(true);
    });

    return unsubscribe;
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    // Store the original location so user can return after login
    if (location.pathname !== "/login") {
      sessionStorage.setItem("returnUrl", location.pathname + location.search);
    }
    // Use hard navigation to force full app reload.
    // This ensures AuthContext re-initializes with no token, avoiding
    // race conditions where stale currentUser state redirects back.
    window.location.href = "/login";
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
