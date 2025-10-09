# MongoDB Abort Issue - Debug Analysis

## Problem Description

MongoDB process aborts with >50% probability during integration test runs:

```
47644 abort mongod --config /opt/homebrew/etc/mongod.conf
```

MongoDB is running manually in foreground mode.

## Root Cause Analysis

### 1. **Connection Pool Exhaustion** ⚠️ PRIMARY SUSPECT

**Issue**: Multiple test files are creating independent MongoDB connections without proper pooling:

- `vitest.setup.ts`: Creates eager connection if `VITEST_EAGER_DB=true`
- `integrationDBSetup.ts`: Each test file may create its own connection
- `events-api.test.ts` (and others): Some tests manually connect in `beforeAll`
- Total: 103+ test files potentially creating connections

**Current Pool Size**: `maxPoolSize: 10` (in `src/models/index.ts`)

**Problem**:

- When running 103 test files, even sequentially, if connections aren't properly closed, the pool gets exhausted
- MongoDB's default max connections is usually 100-200 (depends on configuration)
- Running tests in parallel or with connection leaks can hit this limit

### 2. **Improper Connection Lifecycle Management**

**Multiple connection points**:

```typescript
// vitest.setup.ts - Optional eager connection
mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });

// tests/integration/setup/connect.ts - Integration tests
mongoose.connect(uri, {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  family: 4,
});

// Individual test files (e.g., events-api.test.ts)
mongoose.connect(uri, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  family: 4,
});

// src/models/index.ts - Production connection
mongoose.connect(mongoUri, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferMaxEntries: 0,
  bufferCommands: false,
});
```

**Problems**:

- Inconsistent connection options across test files
- Some tests create their own connection in `beforeAll`
- Connection reuse logic in `ensureIntegrationDB()` checks `mongoose.connection.readyState` but may not catch all edge cases
- Race conditions when multiple test suites run

### 3. **Collection Deletion Pattern Issues**

**Current cleanup pattern**:

```typescript
beforeEach/afterEach: User.deleteMany({}), Event.deleteMany({})
```

**Problems**:

- `deleteMany({})` operations can be slow and hold connections
- Multiple concurrent `deleteMany` operations from different test files
- No connection pooling awareness
- Can cause connection queue buildup

### 4. **Test Configuration Issues**

**From vitest.config.ts**:

```typescript
poolOptions: {
  threads: {
    singleThread: true,  // ✅ Good - prevents parallel execution
  },
},
testTimeout: 30000,  // ⚠️ Long timeout may mask connection issues
```

While tests run sequentially (`singleThread: true`), connection cleanup between tests may not be complete before the next test starts.

### 5. **MongoDB Memory Pressure**

Running in foreground mode without proper resource limits can cause:

- Memory exhaustion from accumulated connections
- WiredTiger cache pressure
- Lock contention from rapid collection operations

## Evidence from Test Output

The failing test was:

```
tests/integration/api/guests-phone-clear-on-update.admin-legacy.integration.test.ts
MongoNetworkError: connection 9 to 127.0.0.1:27017 closed
```

**Key indicators**:

- Connection numbered "9" - suggests multiple connections being created
- Test runs ~102 tests before failing
- Happens after significant test execution (connection accumulation)

## Recommended Fixes

### Priority 1: Consolidate Connection Management (CRITICAL)

**Action**: Create a single, reusable connection for all tests

```typescript
// tests/config/mongoConnection.ts
import mongoose from "mongoose";

let connection: typeof mongoose | null = null;

export async function getTestConnection() {
  if (connection && mongoose.connection.readyState === 1) {
    return connection;
  }

  const uri =
    process.env.MONGODB_TEST_URI ||
    "mongodb://127.0.0.1:27017/atcloud-signup-test";

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, {
      maxPoolSize: 50, // ⬆️ Increase for test suite
      minPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
      // Prevent connection reuse issues
      autoIndex: false, // Disable auto-indexing in tests
    });
  }

  connection = mongoose;
  return connection;
}

export async function closeTestConnection() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close(true); // Force close
    connection = null;
  }
}
```

**Update vitest.config.ts**:

```typescript
globalSetup: "./tests/config/globalSetup.ts",
```

**Update globalSetup.ts**:

```typescript
import { getTestConnection, closeTestConnection } from "./mongoConnection";

export async function setup() {
  console.log("🔧 Setting up test environment...");
  await getTestConnection(); // ✅ Single connection for entire suite
  console.log("✅ Test environment ready");
}

export async function teardown() {
  console.log("🧹 Cleaning up test environment...");
  await closeTestConnection(); // ✅ Close after all tests
  console.log("✅ Test environment cleaned up");
}
```

**Remove duplicate connections**:

- ❌ Remove `mongoose.connect()` from `vitest.setup.ts`
- ❌ Remove `mongoose.connect()` from individual test `beforeAll` hooks
- ✅ Use shared connection from `getTestConnection()`

### Priority 2: Optimize Collection Cleanup

**Replace deleteMany pattern**:

```typescript
// tests/test-utils/dbCleanup.ts
import mongoose from "mongoose";

export async function fastCleanup(collections: string[]) {
  const db = mongoose.connection.db;
  if (!db) return;

  // Drop collections instead of deleteMany (much faster)
  await Promise.allSettled(
    collections.map(async (name) => {
      try {
        await db.dropCollection(name);
      } catch (error: any) {
        // Ignore if collection doesn't exist
        if (error.code !== 26) throw error;
      }
    })
  );
}

// Or truncate without dropping indexes
export async function truncateCollections(collections: string[]) {
  const operations = collections.map((name) => {
    const model = mongoose.model(name);
    return model.deleteMany({}, { writeConcern: { w: 0 } }); // Fire and forget
  });
  await Promise.all(operations);
}
```

**Usage in tests**:

```typescript
import { fastCleanup } from "../../test-utils/dbCleanup";

afterEach(async () => {
  await fastCleanup(["users", "events", "registrations"]);
});
```

### Priority 3: Add Connection Health Monitoring

```typescript
// tests/test-utils/connectionMonitor.ts
import mongoose from "mongoose";

export function logConnectionStats() {
  const stats = {
    readyState: mongoose.connection.readyState,
    name: mongoose.connection.name,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
  };

  if (mongoose.connection.client) {
    const poolStats = mongoose.connection.client.topology?.s.pool;
    if (poolStats) {
      console.log("📊 Connection Pool:", {
        available: poolStats.availableConnectionCount,
        pending: poolStats.pendingConnectionCount,
        total: poolStats.totalConnectionCount,
      });
    }
  }

  return stats;
}

// Add to afterEach in problematic tests
afterEach(() => {
  if (process.env.DEBUG_MONGO) {
    logConnectionStats();
  }
});
```

### Priority 4: Increase MongoDB Limits (Temporary)

Edit MongoDB config `/opt/homebrew/etc/mongod.conf`:

```yaml
net:
  maxIncomingConnections: 500 # ⬆️ Increase from default ~100

storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 2 # ⬆️ Increase cache if available
```

Restart MongoDB:

```bash
brew services restart mongodb-community
```

### Priority 5: Test Execution Strategy

**Add retry logic for flaky tests**:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    retry: 2, // ✅ Retry failed tests
    bail: 10, // ✅ Stop after 10 failures to prevent cascading issues
    // ... rest of config
  },
});
```

**Run in smaller batches** (temporary workaround):

```bash
# Backend only
npm run test:backend

# Split by directory
npx vitest run tests/integration/api/ --reporter=verbose
npx vitest run tests/integration/services/ --reporter=verbose
```

## Verification Steps

1. **Check current MongoDB connections**:

```bash
# While tests are running
mongosh --eval "db.serverStatus().connections"
```

2. **Monitor MongoDB logs**:

```bash
tail -f /opt/homebrew/var/log/mongodb/mongo.log
```

3. **Test with debug logging**:

```bash
DEBUG_MONGO=true npm run test:backend
```

4. **Check connection limits**:

```bash
mongosh --eval "db.serverStatus().connections.available"
```

## Quick Fix (Apply First)

**Immediate workaround** - Increase pool size and add connection reuse:

```typescript
// backend/tests/integration/setup/connect.ts
export async function ensureIntegrationDB() {
  // ✅ Reuse existing connection more aggressively
  if (
    mongoose.connection.readyState === 1 ||
    mongoose.connection.readyState === 2
  ) {
    return; // 1 = connected, 2 = connecting
  }

  if (connecting) {
    await connecting;
    return;
  }

  const uri =
    process.env.MONGODB_TEST_URI ||
    "mongodb://127.0.0.1:27017/atcloud-signup-test";

  connecting = mongoose.connect(uri, {
    maxPoolSize: 50, // ⬆️ Increase from default 10
    minPoolSize: 5,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
  } as any);

  try {
    await connecting;
  } finally {
    connecting = null;
  }
}
```

## Long-term Solution

1. Implement Priority 1 (Single connection for entire test suite)
2. Implement Priority 2 (Faster cleanup with collection dropping)
3. Add connection pooling metrics/monitoring
4. Consider using `mongodb-memory-server` for isolated test environments

## Additional Resources

- [Mongoose Connection Pooling Docs](https://mongoosejs.com/docs/connections.html)
- [MongoDB Connection Pool Docs](https://www.mongodb.com/docs/manual/reference/connection-string/#connection-pool-options)
- [Vitest Global Setup](https://vitest.dev/config/#globalsetup)
