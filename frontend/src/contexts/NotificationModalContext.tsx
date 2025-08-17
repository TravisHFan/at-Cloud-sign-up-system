import React, { createContext, useContext, useState, useCallback } from "react";
import NotificationModal from "../components/common/NotificationModal";

interface NotificationOptions {
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
  closeButtonText?: string;
}

interface NotificationContextType {
  showNotification: (options: NotificationOptions) => void;
  hideNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotification must be used within a NotificationProvider"
    );
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const [notification, setNotification] = useState<NotificationOptions | null>(
    null
  );

  const showNotification = useCallback((options: NotificationOptions) => {
    setNotification(options);
  }, []);

  const hideNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return (
    <NotificationContext.Provider
      value={{ showNotification, hideNotification }}
    >
      {children}
      <NotificationModal
        isOpen={!!notification}
        onClose={hideNotification}
        title={notification?.title || ""}
        message={notification?.message || ""}
        type={notification?.type}
        actionButton={notification?.actionButton}
        showCloseButton={notification?.showCloseButton}
        closeButtonText={notification?.closeButtonText}
      />
    </NotificationContext.Provider>
  );
};

// Convenience functions that match toast API for easy migration
export const useToastReplacement = () => {
  const { showNotification } = useNotification();

  return {
    success: (message: string, options?: Partial<NotificationOptions>) => {
      showNotification({
        title: "Success",
        message,
        type: "success",
        autoClose: true,
        autoCloseDelay: 3000,
        ...options,
      });
    },
    error: (message: string, options?: Partial<NotificationOptions>) => {
      showNotification({
        title: "Error",
        message,
        type: "error",
        autoClose: true,
        autoCloseDelay: 5000,
        ...options,
      });
    },
    warning: (message: string, options?: Partial<NotificationOptions>) => {
      showNotification({
        title: "Warning",
        message,
        type: "warning",
        autoClose: true,
        autoCloseDelay: 4000,
        ...options,
      });
    },
    info: (message: string, options?: Partial<NotificationOptions>) => {
      showNotification({
        title: "Info",
        message,
        type: "info",
        autoClose: true,
        autoCloseDelay: 4000,
        ...options,
      });
    },
  };
};
