// Re-export the useAuth hook from the context
// This maintains backward compatibility for existing imports
export { useAuth, useRequireRole, withAuth } from "../contexts/AuthContext";
export type { AuthUser } from "../types";
