# MongoDB Troubleshooting for Integration Tests (macOS)

This guide helps diagnose and fix intermittent mongod aborts seen when running backend integration tests.

Our tests expect a running MongoDB at:

- mongodb://localhost:27017/atcloud-signup-test

See `.github/copilot-instructions.md` for the canonical test DB URI.

---

## Symptoms

- Starting mongod manually shows lines like:
  `[1] 1463 abort  mongod --config /opt/homebrew/etc/mongod.conf`
- Integration tests intermittently fail to connect or hang, especially after switching between Docker and local services.

---

## Common Root Causes and Fixes

1. Port 27017 already in use (Docker vs Homebrew)

- Cause: Docker Compose maps `27017:27017` (service `mongodb`). If the container is running, Homebrew mongod can’t bind and aborts.
- Fix:
  - Use exactly one MongoDB provider at a time.
    - EITHER stop Docker before starting Homebrew:
      - `docker compose -f docker-compose.dev.yml down`
      - `brew services restart mongodb-community`
    - OR stop Homebrew before using Docker:
      - `brew services stop mongodb-community`
      - `docker compose -f docker-compose.dev.yml up -d mongodb`
  - Verify the listener:
    - `lsof -i :27017 | grep LISTEN`

2. Data/log directory permissions (Homebrew)

- Cause: mongod can abort if it can’t read/write the dbPath or logs.
- Fix:
  - Ensure these paths exist and are owned by your user:
    - `/opt/homebrew/var/mongodb`
    - `/opt/homebrew/var/log/mongodb`
  - Repair ownership/permissions (replace `$USER` if needed):
    - `sudo mkdir -p /opt/homebrew/var/mongodb /opt/homebrew/var/log/mongodb`
    - `sudo chown -R "$USER":staff /opt/homebrew/var/mongodb /opt/homebrew/var/log/mongodb`
  - Restart service:
    - `brew services restart mongodb-community`

3. Stale lock or WiredTiger crash recovery

- Cause: abrupt shutdown leaves a lock or partial recovery state and mongod aborts.
- Fix:
  - Stop mongod: `brew services stop mongodb-community`
  - Remove stale lock (if present):
    - `rm -f /opt/homebrew/var/mongodb/mongod.lock`
  - Run repair:
    - `mongod --dbpath /opt/homebrew/var/mongodb --repair`
  - Start service: `brew services start mongodb-community`

4. IPv6 localhost vs IPv4

- Cause: `localhost` may resolve to `::1` on macOS. If mongod is bound only to `127.0.0.1`, some clients trying `::1` can fail.
- Fix:
  - Prefer `127.0.0.1` in env when you see connection flakiness during tests:
    - `export MONGODB_TEST_URI="mongodb://127.0.0.1:27017/atcloud-signup-test"`
  - Or ensure bindIp includes both in your mongod.conf:
    ```yaml
    net:
      bindIp: 127.0.0.1,localhost
    ```

5. Multiple mongod instances

- Cause: Manually launching `mongod --config ...` while the Homebrew service is also running can conflict on pid/ports and abort.
- Fix:
  - Use the Homebrew service exclusively:
    - `brew services list`
    - `brew services restart mongodb-community`
  - Avoid running a second mongod in parallel on the same port.

---

## Quick Health Checks (Optional)

- Who owns the port?
  - `lsof -i :27017 | grep LISTEN`
- Is mongod healthy (Homebrew)?
  - `brew services list | grep mongo`
  - `tail -n +1 /opt/homebrew/var/log/mongodb/mongo*.log | tail -200`
- Can we connect?
  - `mongosh "mongodb://localhost:27017/atcloud-signup-test" --eval 'db.runCommand({ ping: 1 })'`

---

## Recommended Stable Setup for Tests

- Choose one of these:

  1. Homebrew MongoDB (default)
     - `brew services start mongodb-community`
     - Confirm: `mongosh mongodb://localhost:27017/atcloud-signup-test`
  2. Docker MongoDB
     - `docker compose -f docker-compose.dev.yml up -d mongodb`
     - Ensure Homebrew mongod is stopped

- Before running tests, make sure only one MongoDB is listening on 27017.
- If you frequently flip between Docker and local, add a short pre-test check to ensure port state is clean.

---

## Notes about the Test Suite

- Backend Vitest runs tests in a single thread to avoid DB conflicts.
- Some tests directly connect using `process.env.MONGODB_TEST_URI` (defaults to `mongodb://localhost:27017/atcloud-signup-test`). Others use `127.0.0.1` explicitly to force IPv4.
- If you still see occasional connection flakiness on macOS, exporting `MONGODB_TEST_URI` with `127.0.0.1` is a safe local tweak without changing code.

---

## When to Repair or Reset the Test DB

- If crashes persist and logs mention WiredTiger errors or locks:
  - Stop service, remove `mongod.lock`, run `--repair`, then start.
- As a last resort for test data only, you can clear the test db directory (this will delete all test data):
  - `brew services stop mongodb-community`
  - `rm -rf /opt/homebrew/var/mongodb/*`
  - `brew services start mongodb-community`

Use caution with the above; only do this for test databases you are comfortable resetting.

---

## TL;DR

- Don’t run Docker MongoDB and Homebrew mongod at the same time.
- Ensure dbPath/log paths exist and are writable.
- Remove stale locks and run `--repair` if you see WiredTiger-related aborts.
- Prefer `127.0.0.1` in local `MONGODB_TEST_URI` when in doubt.
