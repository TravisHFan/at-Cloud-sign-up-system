import mongoose from "mongoose";

function databaseParts() {
  const uri =
    process.env.MONGODB_TEST_URI ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/atcloud-signup-test";
  const [base] = uri.split("?", 1);
  const databaseName = base.slice(base.lastIndexOf("/") + 1);
  const runId = process.env.VITEST_RUN_ID?.replace(
    /[^a-zA-Z0-9_-]/g,
    "-",
  );
  return { uri, databaseName, runId };
}

export function setup() {
  if (!process.env.VITEST_RUN_ID) {
    process.env.VITEST_RUN_ID = `${process.pid}-${Date.now()}`;
  }
}

export async function teardown() {
  const { uri, databaseName, runId } = databaseParts();
  if (!databaseName.includes("test") || !runId) return;

  const client = await mongoose.mongo.MongoClient.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    const prefix = `${databaseName}-${runId}-w`;
    const databases = await client.db().admin().listDatabases();
    await Promise.all(
      databases.databases
        .map(({ name }) => name)
        .filter((name) => name.startsWith(prefix) && name.includes("test"))
        .map((name) => client.db(name).dropDatabase()),
    );
  } finally {
    await client.close();
  }
}
