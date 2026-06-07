/**
 * Vitest integration DB setup.
 *
 * This file is loaded only by vitest.integration.config.ts. Unit tests use
 * vitest.unit.config.ts and do not import this file.
 */
import { beforeAll, afterAll } from "vitest";

beforeAll(async () => {
  const { ensureIntegrationDB } = await import("../integration/setup/connect");
  await ensureIntegrationDB();
});

afterAll(async () => {
  if (process.env.INTEGRATION_DB_PERSIST !== "true") {
    const { closeIntegrationDB } = await import("../integration/setup/connect");
    await closeIntegrationDB();
  }
});
