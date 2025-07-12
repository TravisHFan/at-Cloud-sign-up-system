import Icon from "./Icon";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: "success" | "error" | "warning" | "info";
  buttonText?: string;
}

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = "info",
  buttonText = "OK",
}: AlertModalProps) {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return {
          icon: "check-circle" as const,
          iconColor: "text-green-600",
          buttonColor: "bg-green-600 hover:bg-green-700",
          bgColor: "bg-green-50",
        };
      case "error":
        return {
          icon: "x-circle" as const,
          iconColor: "text-red-600",
          buttonColor: "bg-red-600 hover:bg-red-700",
          bgColor: "bg-red-50",
        };
      case "warning":
        return {
          icon: "x-circle" as const,
          iconColor: "text-yellow-600",
          buttonColor: "bg-yellow-600 hover:bg-yellow-700",
          bgColor: "bg-yellow-50",
        };
      case "info":
      default:
        return {
          icon: "check-circle" as const,
          iconColor: "text-blue-600",
          buttonColor: "bg-blue-600 hover:bg-blue-700",
          bgColor: "bg-blue-50",
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center space-x-3 mb-4">
          <div className={`p-2 rounded-full ${styles.bgColor}`}>
            <Icon 
              name={styles.icon} 
              className={`w-6 h-6 ${styles.iconColor}`} 
            />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className={`px-4 py-2 text-white font-medium rounded-lg transition-colors ${styles.buttonColor}`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
