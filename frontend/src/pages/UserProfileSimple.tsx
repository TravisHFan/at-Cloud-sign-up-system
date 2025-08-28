import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { userService } from "../services/api";
import { PageHeader, Card, CardContent } from "../components/ui";

export default function UserProfileSimple() {
  const { userId } = useParams<{ userId: string }>();
  type SimpleUser = {
    id: string;
    username: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    role: string;
  } | null;
  const [user, setUser] = useState<SimpleUser>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (!userId) {
        setError("No user ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const userData = (await userService.getUser(
          userId
        )) as unknown as NonNullable<SimpleUser>;
        setUser(userData);
        setError(null);
      } catch (err: unknown) {
        console.error("❌ Error fetching user:", err);
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: unknown }).message ?? "")
            : "Failed to fetch user";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <PageHeader title="Loading..." />
        <Card>
          <CardContent>
            <p>Loading user profile for ID: {userId}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <PageHeader title="Error" />
        <Card>
          <CardContent>
            <p className="text-red-600">Error: {error}</p>
            <p>User ID: {userId}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <PageHeader
        title={`${user?.firstName || "Unknown"} ${
          user?.lastName || "User"
        }'s Profile`}
      />
      <Card>
        <CardContent>
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">User Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>Name:</strong> {user?.firstName} {user?.lastName}
              </div>
              <div>
                <strong>Username:</strong> {user?.username}
              </div>
              <div>
                <strong>Email:</strong> {user?.email}
              </div>
              <div>
                <strong>Role:</strong> {user?.role}
              </div>
            </div>
            <div className="mt-4 p-4 bg-gray-100 rounded">
              <h3 className="font-semibold">Raw Data:</h3>
              <pre className="text-xs overflow-auto">
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
