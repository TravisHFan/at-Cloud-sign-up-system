export default async function globalSetup() {
  // Set test environment variables
  process.env.NODE_ENV = "test";
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

  // Use separate test port to avoid conflicts with dev server
  process.env.PORT = "5002";

  // Ensure we use test database
  process.env.MONGODB_URI = "mongodb://localhost:27017/atcloud-signup-test";
  process.env.MONGODB_URI_TEST =
    "mongodb://localhost:27017/atcloud-signup-test";
}
