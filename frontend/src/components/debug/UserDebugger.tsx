import { useEffect, useState } from "react";
import { userService } from "../../services/api";

export default function UserDebugger() {
  const [users, setUsers] = useState<any[]>([]);
  const [sarahUser, setSarahUser] = useState<any>(null);

  useEffect(() => {
    // Fetch all users first
    const fetchData = async () => {
      try {
        console.log("=== DEBUGGING USERS ===");

        // Get all users
        const allUsersResponse = await userService.getUsers();
        console.log("All users response:", allUsersResponse);
        const allUsers = allUsersResponse.users || allUsersResponse; // Handle both formats
        setUsers(allUsers);

        // Find Sarah Brown in the list
        const sarah = allUsers.find(
          (user: any) => user.firstName === "Sarah" && user.lastName === "Brown"
        );
        console.log("Sarah from user list:", sarah);

        // Get Sarah directly by ID if we have it
        if (sarah) {
          const sarahDirect = await userService.getUser(sarah.id);
          console.log("Sarah direct fetch:", sarahDirect);
          setSarahUser(sarahDirect);
        }
      } catch (error) {
        console.error("Debug error:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">User Debug Information</h2>

      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-2">
          All Users ({users.length}):
        </h3>
        {users.map((user, index) => (
          <div key={user.id || index} className="border p-2 mb-2">
            <p>
              <strong>ID:</strong> {user.id}
            </p>
            <p>
              <strong>Name:</strong> {user.firstName} {user.lastName}
            </p>
            <p>
              <strong>Gender:</strong> {user.gender || "NOT SET"}
            </p>
            <p>
              <strong>Avatar:</strong> {user.avatar || "NOT SET"}
            </p>
          </div>
        ))}
      </div>

      {sarahUser && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">
            Sarah Brown (Direct Fetch):
          </h3>
          <div className="border p-2">
            <p>
              <strong>ID:</strong> {sarahUser.id}
            </p>
            <p>
              <strong>Name:</strong> {sarahUser.firstName} {sarahUser.lastName}
            </p>
            <p>
              <strong>Gender:</strong> {sarahUser.gender || "NOT SET"}
            </p>
            <p>
              <strong>Avatar:</strong> {sarahUser.avatar || "NOT SET"}
            </p>
            <p>
              <strong>All keys:</strong> {Object.keys(sarahUser).join(", ")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
