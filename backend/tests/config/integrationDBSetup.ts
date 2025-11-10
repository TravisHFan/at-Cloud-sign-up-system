/**
 * Vitest Integration DB Setup
 * Establishes a MongoDB connection for integration tests only.
 */
import { beforeAll, afterAll } from "vitest";

const isIntegration = process.env.VITEST_SCOPE === "integration";

if (isIntegration) {
  beforeAll(async () => {
    const { ensureIntegrationDB } = await import(
      "../integration/setup/connect"
    );
    await ensureIntegrationDB();
  });

  afterAll(async () => {
    // Close only if no other tests need it; for simplicity close always here since scope=integration
    if (process.env.INTEGRATION_DB_PERSIST !== "true") {
      const { closeIntegrationDB } = await import(
        "../integration/setup/connect"
      );
      await closeIntegrationDB();
    }
  });
}
