import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function ChatRedirect() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();

  useEffect(() => {
    // Redirect to the new hybrid chat page
    const destination = userId
      ? `/dashboard/hybrid-chat/${userId}`
      : "/dashboard/hybrid-chat";

    navigate(destination, { replace: true });
  }, [navigate, userId]);

  // Show a brief loading message during redirect
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to chat...</p>
      </div>
    </div>
  );
}
