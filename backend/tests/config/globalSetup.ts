// Simple test setup - no database connections
export default async function globalSetup() {
  // Set test environment variables
  process.env.NODE_ENV = "test";
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  process.env.PORT = "5002";
}
