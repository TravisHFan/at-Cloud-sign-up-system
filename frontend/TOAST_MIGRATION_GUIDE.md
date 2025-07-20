// Example migration guide for replacing toast with custom notifications

// BEFORE (using toast):
import toast from "react-hot-toast";

const deleteUser = useCallback(async (userId: string) => {
try {
await userService.deleteUser(userId);
setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));
toast.success("User deleted successfully");
} catch (error) {
console.error("Error deleting user:", error);
toast.error("Failed to delete user");
}
}, []);

// AFTER (using custom notification):
import { useToastReplacement } from "../contexts/NotificationModalContext";

const notification = useToastReplacement();

const deleteUser = useCallback(async (userId: string) => {
try {
await userService.deleteUser(userId);
setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));

    notification.success("User deleted successfully", {
      title: "Success",
      actionButton: {
        text: "View Users",
        onClick: () => {
          // Navigate to users list or refresh
        },
        variant: "secondary"
      }
    });

} catch (error) {
console.error("Error deleting user:", error);

    notification.error("Failed to delete user. Please try again.", {
      title: "Error",
      autoCloseDelay: 6000,
      actionButton: {
        text: "Retry",
        onClick: () => deleteUser(userId),
        variant: "primary"
      }
    });

}
}, [notification]);

// For more complex scenarios:
import { useNotification } from "../contexts/NotificationModalContext";

const { showNotification } = useNotification();

const handleComplexAction = () => {
showNotification({
title: "Confirm Action",
message: "Are you sure you want to proceed? This action cannot be undone.",
type: "warning",
autoClose: false,
actionButton: {
text: "Proceed",
onClick: () => {
// Perform the action
performAction();
},
variant: "primary"
},
showCloseButton: true
});
};

// Migration steps:
// 1. Replace `import toast from "react-hot-toast"` with `import { useToastReplacement } from "../contexts/NotificationModalContext"`
// 2. Add `const notification = useToastReplacement()` at the top of your component/hook
// 3. Replace `toast.success(message)` with `notification.success(message)`
// 4. Replace `toast.error(message)` with `notification.error(message)`
// 5. Replace `toast.warning(message)` with `notification.warning(message)`
// 6. Replace `toast.info(message)` with `notification.info(message)`
// 7. Add custom options like action buttons, custom titles, etc. as needed
