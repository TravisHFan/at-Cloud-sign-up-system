import mongoose from "mongoose";

let connecting: Promise<typeof mongoose> | null = null;
let indexesReady = false;

function getWorkerDatabaseUri(): string {
  const configuredUri =
    process.env.MONGODB_TEST_URI ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/atcloud-signup-test";

  if (process.env.VITEST_DB_ISOLATION === "false") {
    return configuredUri;
  }

  const [base, query] = configuredUri.split("?", 2);
  const slashIndex = base.lastIndexOf("/");
  const databaseName = base.slice(slashIndex + 1) || "atcloud-signup-test";
  const runId = (process.env.VITEST_RUN_ID || String(process.ppid)).replace(
    /[^a-zA-Z0-9_-]/g,
    "-",
  );
  const workerId = (process.env.VITEST_POOL_ID || "1").replace(
    /[^a-zA-Z0-9_-]/g,
    "-",
  );
  const isolatedDatabase = `${databaseName}-${runId}-w${workerId}`;

  return `${base.slice(0, slashIndex + 1)}${isolatedDatabase}${
    query ? `?${query}` : ""
  }`;
}

/**
 * Ensure a single shared MongoDB connection for integration tests.
 * Safe to call multiple times; subsequent calls reuse the in-flight or established connection.
 *
 * IMPORTANT: Use this function instead of mongoose.connect() directly in test files
 * to prevent connection pool exhaustion.
 */
export async function ensureIntegrationDB() {
  // Reuse existing connection more aggressively (1 = connected, 2 = connecting)
  if (
    mongoose.connection.readyState === 1 ||
    mongoose.connection.readyState === 2
  ) {
    return;
  }

  if (connecting) {
    await connecting;
    return;
  }

  const uri = getWorkerDatabaseUri();
  const configuredFamily = Number(process.env.MONGODB_TEST_FAMILY);
  const familyOption =
    configuredFamily === 4 || configuredFamily === 6
      ? { family: configuredFamily }
      : {};

  connecting = mongoose.connect(uri, {
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    autoIndex: true, // Enable auto-indexing for tests that need it
    ...familyOption,
  } as any);

  try {
    await connecting;
  } finally {
    connecting = null;
  }
}

/**
 * Clear a worker database between test files while retaining its indexes.
 * Parallel workers never share a database, so this is the only broad cleanup
 * required by the harness.
 */
export async function clearIntegrationDB() {
  if (mongoose.connection.readyState !== 1) return;

  const databaseName = mongoose.connection.db?.databaseName;
  if (!databaseName?.includes("test")) {
    throw new Error("Safety check: integration database name must include test");
  }

  const collections = await mongoose.connection.db.collections();
  await Promise.all(
    collections.map((collection) => collection.deleteMany({})),
  );
}

export async function ensureIntegrationIndexes() {
  if (indexesReady) return;

  await Promise.all(
    mongoose.modelNames().map((modelName) => mongoose.model(modelName).init()),
  );
  indexesReady = true;
}
