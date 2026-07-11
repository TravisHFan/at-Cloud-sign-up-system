/**
 * Vitest integration DB setup.
 *
 * This file is loaded only by vitest.integration.config.ts. Unit tests use
 * vitest.unit.config.ts and do not import this file.
 */
import { beforeAll } from "vitest";

beforeAll(async () => {
  const {
    clearIntegrationDB,
    ensureIntegrationDB,
    ensureIntegrationIndexes,
  } = await import("../integration/setup/connect");
  await ensureIntegrationDB();
  await ensureIntegrationIndexes();
  await clearIntegrationDB();
});
