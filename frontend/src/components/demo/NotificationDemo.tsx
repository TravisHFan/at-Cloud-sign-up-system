import {
  useToastReplacement,
  useNotification,
} from "../../contexts/NotificationModalContext";

export default function NotificationDemo() {
  const notification = useToastReplacement();
  const { showNotification } = useNotification();

  const handleSuccess = () => {
    notification.success("Operation completed successfully!");
  };

  const handleError = () => {
    notification.error("Something went wrong. Please try again.");
  };

  const handleWarning = () => {
    notification.warning("This action requires your attention.");
  };

  const handleInfo = () => {
    notification.info("Here's some helpful information for you.");
  };

  const handleCustomAction = () => {
    showNotification({
      title: "Confirm Deletion",
      message:
        "Are you sure you want to delete this user? This action cannot be undone.",
      type: "warning",
      autoClose: false,
      actionButton: {
        text: "Delete",
        onClick: () => {
          notification.success("User has been deleted successfully.");
        },
        variant: "primary",
      },
    });
  };

  const handleWithAction = () => {
    notification.success("User promoted successfully!", {
      title: "Promotion Complete",
      actionButton: {
        text: "View Profile",
        onClick: () => {
          console.log("Navigate to user profile");
        },
        variant: "secondary",
      },
    });
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">Notification Demo</h2>
      <div className="space-y-3">
        <button
          onClick={handleSuccess}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Show Success
        </button>
        <button
          onClick={handleError}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Show Error
        </button>
        <button
          onClick={handleWarning}
          className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
        >
          Show Warning
        </button>
        <button
          onClick={handleInfo}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Show Info
        </button>
        <button
          onClick={handleCustomAction}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Show Custom Action
        </button>
        <button
          onClick={handleWithAction}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Success with Action
        </button>
      </div>
    </div>
  );
}
