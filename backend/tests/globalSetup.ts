export default async function globalSetup() {
  // Set test environment variables
  process.env.NODE_ENV = "test";
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

  // For now, use a test database if MongoDB Memory Server isn't working
  if (!process.env.MONGODB_URI) {
    process.env.MONGODB_URI = "mongodb://localhost:27017/atcloud-signup-test";
  }
}
