import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, Card, CardContent } from "../components/ui";

export default function ChangePassword() {
  const navigate = useNavigate();

  // Redirect to the new secure password change flow
  useEffect(() => {
    navigate("/dashboard/change-password/request", { replace: true });
  }, [navigate]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Redirecting..."
        subtitle="Redirecting to secure password change flow."
      />

      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-600">
            Redirecting to the new secure password change process...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
