// Quick test component to trigger message loading
import { useNotifications } from "../../contexts/NotificationContext";

export const MessageTestButton = () => {
  const { loadConversationsFromBackend } = useNotifications();

  const handleTestLoad = () => {
    console.log("🧪 Manually triggering loadConversationsFromBackend...");
    loadConversationsFromBackend(true); // Force reload
  };

  return (
    <button
      onClick={handleTestLoad}
      style={{
        position: "fixed",
        top: "10px",
        right: "10px",
        zIndex: 9999,
        padding: "10px",
        backgroundColor: "#ff6b6b",
        color: "white",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
      }}
    >
      🧪 Test Load Messages
    </button>
  );
};
