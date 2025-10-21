// Global Vitest setup to unify DB handling and environment guard.
// This complements tests/config/setup.ts and integrationDBSetup.ts.
// If future consolidation desired, those can be merged here; for now we keep non-breaking.
import mongoose from "mongoose";

// Disable HTTP proxies for supertest/local requests
// Prevents "Parse Error: Expected HTTP/" when proxy env vars are set
// See: https://github.com/visionmedia/supertest/issues/556
for (const key of [
  "HTTP_PROXY",
  "http_proxy",
  "HTTPS_PROXY",
  "https_proxy",
  "ALL_PROXY",
  "all_proxy",
]) {
  delete (process.env as any)[key];
}
// Explicitly disable proxying local addresses
process.env.NO_PROXY = "localhost,127.0.0.1,::1";

// Optional eager connection if VITEST_EAGER_DB=true (mostly for local developer speed on repeated runs)
if (process.env.VITEST_EAGER_DB === "true") {
  (async () => {
    try {
      if (mongoose.connection.readyState === 0) {
        const uri =
          process.env.MONGODB_TEST_URI ||
          process.env.MONGODB_URI ||
          "mongodb://127.0.0.1:27017/atcloud-signup-test";
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 } as any);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[vitest.setup] optional eager DB connect failed:", e);
    }
  })();
}
