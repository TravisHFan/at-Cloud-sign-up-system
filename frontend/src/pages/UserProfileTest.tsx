import { useParams } from "react-router-dom";
import { PageHeader, Card, CardContent } from "../components/ui";

export default function UserProfileTest() {
  const { userId } = useParams<{ userId: string }>();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader title={`User Profile Test - ID: ${userId}`} />
      <Card>
        <CardContent>
          <div className="space-y-4">
            <p>This is a test user profile page.</p>
            <p>User ID from URL: {userId}</p>
            <p>If you can see this, the routing is working.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
