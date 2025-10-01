/**
 * Vitest Integration DB Setup
 * Establishes a MongoDB connection for integration tests only.
 */
import mongoose from "mongoose";
import { beforeAll, afterAll } from "vitest";
import {
  ensureIntegrationDB,
  closeIntegrationDB,
} from "../integration/setup/connect";

const isIntegration = process.env.VITEST_SCOPE === "integration";

if (isIntegration) {
  beforeAll(async () => {
    await ensureIntegrationDB();
  });

  afterAll(async () => {
    // Close only if no other tests need it; for simplicity close always here since scope=integration
    if (process.env.INTEGRATION_DB_PERSIST !== "true") {
      await closeIntegrationDB();
    }
  });
}
