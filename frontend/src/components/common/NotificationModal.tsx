import { useEffect } from "react";
import Icon from "./Icon";

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: "success" | "error" | "warning" | "info";
  autoClose?: boolean;
  autoCloseDelay?: number;
  actionButton?: {
    text: string;
    onClick: () => void;
    variant?: "primary" | "secondary";
  };
  showCloseButton?: boolean;
}

export default function NotificationModal({
  isOpen,
  onClose,
  title,
  message,
  type = "info",
  autoClose = true,
  autoCloseDelay = 4000,
  actionButton,
  showCloseButton = true,
}: NotificationModalProps) {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose]);

  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return {
          icon: "check-circle" as const,
          iconColor: "text-green-600",
          borderColor: "border-green-200",
          bgColor: "bg-green-50",
          titleColor: "text-green-900",
          textColor: "text-green-700",
          buttonColor: "bg-green-600 hover:bg-green-700",
        };
      case "error":
        return {
          icon: "x-circle" as const,
          iconColor: "text-red-600",
          borderColor: "border-red-200",
          bgColor: "bg-red-50",
          titleColor: "text-red-900",
          textColor: "text-red-700",
          buttonColor: "bg-red-600 hover:bg-red-700",
        };
      case "warning":
        return {
          icon: "x-circle" as const, // Using x-circle since exclamation-triangle is not available
          iconColor: "text-yellow-600",
          borderColor: "border-yellow-200",
          bgColor: "bg-yellow-50",
          titleColor: "text-yellow-900",
          textColor: "text-yellow-700",
          buttonColor: "bg-yellow-600 hover:bg-yellow-700",
        };
      case "info":
      default:
        return {
          icon: "chat-bubble" as const, // Using chat-bubble for info
          iconColor: "text-blue-600",
          borderColor: "border-blue-200",
          bgColor: "bg-blue-50",
          titleColor: "text-blue-900",
          textColor: "text-blue-700",
          buttonColor: "bg-blue-600 hover:bg-blue-700",
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div
        className={`bg-white rounded-lg shadow-xl max-w-md w-full border-2 ${styles.borderColor} ${styles.bgColor} animate-slide-in`}
      >
        <div className="p-6">
          <div className="flex items-start">
            <div className={`flex-shrink-0 ${styles.iconColor}`}>
              <Icon name={styles.icon} className="w-6 h-6" />
            </div>
            <div className="ml-3 flex-1">
              <h3 className={`text-lg font-semibold ${styles.titleColor} mb-2`}>
                {title}
              </h3>
              <p
                className={`text-sm ${styles.textColor} leading-relaxed whitespace-pre-wrap`}
              >
                {message}
              </p>
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="flex-shrink-0 ml-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Icon name="x-mark" className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex justify-end space-x-3">
            {actionButton && (
              <button
                onClick={() => {
                  actionButton.onClick();
                  onClose();
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  actionButton.variant === "secondary"
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : `text-white ${styles.buttonColor}`
                }`}
              >
                {actionButton.text}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {actionButton ? "Cancel" : "OK"}
            </button>
          </div>

          {/* Auto-close progress bar */}
          {autoClose && (
            <div className="mt-4 w-full bg-gray-200 rounded-full h-1">
              <div
                className={`h-1 rounded-full ${
                  styles.buttonColor.split(" ")[0]
                } animate-shrink`}
                style={{
                  animationDuration: `${autoCloseDelay}ms`,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
