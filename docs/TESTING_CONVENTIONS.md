# Testing Conventions

**Last Updated**: 2026-07-10

This document establishes conventions that keep the test tiers fast, stable,
and readable. Product-risk ownership is defined in
`TEST_PROTECTION_MATRIX.md`.

## Tier selection

- Put pure functions, mocked controllers, services, and serializers in
  `backend/tests/unit`.
- Put DB-free Express and Supertest behavior in
  `backend/tests/http-contract`.
- Put persistence and cross-model behavior in `backend/tests/integration`.
- Put seeded query-plan and runtime assertions in
  `backend/tests/integration/perf`; they run through the dedicated performance
  command, not the normal integration command.
- Put real browser journeys in `frontend/e2e` and run them with Playwright.

Tests must not open or close the shared Mongoose connection. The integration
harness assigns an isolated database to each worker, connects lazily once, and
clears collections between files. Test files should clean only data they need
to reset within a file.

---

## Scope

This convention applies to:

- **Isolated route tests**: Tiny in-memory Express apps composed inside tests and exercised with Supertest
- **Controller unit tests**: Directly invoke controller functions using mocked `req`/`res` and assert headers/body logic

---

## JSON Response Convention

### Rule: Use `res.json()` for JSON responses

When returning JSON from an isolated test route, use `res.json(...)` and set only `Content-Disposition` if a download filename is desired. **Do not manually set `Content-Type` for JSON** in these isolated routes.

### Why This Convention?

1. **Prevents HTTP framing issues**: Letting Express serialize and set headers prevents `HPE_INVALID_CONSTANT` parse errors observed by Supertest when mixing custom headers with `res.send(JSON.stringify(...))`.

2. **Reduces brittle assertions**: We still assert payload shape and any required disposition headers, but avoid low-level HTTP framing concerns.

3. **Express handles serialization**: Express properly sets `Content-Type: application/json` and handles encoding/chunking automatically.

---

## Policy Summary

| Response Type | Method             | Content-Type                                                                           | Content-Disposition         |
| ------------- | ------------------ | -------------------------------------------------------------------------------------- | --------------------------- |
| **JSON**      | `res.json(data)`   | ❌ Let Express handle                                                                  | ✅ Optional (for downloads) |
| **CSV**       | `res.send(string)` | ✅ Set explicitly: `text/csv`                                                          | ✅ Required                 |
| **XLSX**      | `res.send(buffer)` | ✅ Set explicitly: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | ✅ Required                 |

---

## Example: Isolated Test App

```typescript
app.get("/api/analytics/export", (req, res) => {
  const format = (req.query.format as string) || "json";
  const data = {
    users: 42,
    events: 15,
    registrations: 128,
  };

  // JSON response - let Express handle Content-Type
  if (format === "json") {
    res.setHeader("Content-Disposition", "attachment; filename=analytics.json");
    return res.json(data); // ✅ Correct
  }

  // CSV response - explicit Content-Type required
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=analytics.csv");
    return res.send("Type,Count\nUsers,42\nEvents,15\n"); // ✅ Correct
  }

  // XLSX response - explicit Content-Type required
  if (format === "xlsx") {
    const buffer = generateExcelBuffer(data);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=analytics.xlsx");
    return res.send(buffer); // ✅ Correct
  }

  // Error response
  return res
    .status(400)
    .json({ success: false, message: "Unsupported format." });
});
```

---

## Anti-Patterns to Avoid

### ❌ Don't: Manually set Content-Type for JSON

```typescript
// Bad - causes HTTP framing issues in tests
app.get("/api/data", (req, res) => {
  res.setHeader("Content-Type", "application/json"); // ❌ Don't do this
  res.send(JSON.stringify({ data: "value" })); // ❌ Don't do this
});
```

### ✅ Do: Use res.json()

```typescript
// Good - Express handles serialization
app.get("/api/data", (req, res) => {
  res.json({ data: "value" }); // ✅ Correct
});
```

---

## Controller Unit Tests

Controller unit tests may continue to assert explicit headers (e.g., `Content-Type`) where it is part of the contract under test. Prefer `res.json(...)` unless the test specifically targets header behavior.

### Example: Controller Test

```typescript
describe("EventController.getEvent", () => {
  it("should return event data as JSON", async () => {
    const req = { params: { id: "event123" } } as Request;
    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    } as unknown as Response;

    await EventController.getEvent(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ id: "event123" }),
    });
  });
});
```

---

## Test Assertions

### JSON Response Assertions

```typescript
// Assert payload structure
const response = await request(app)
  .get("/api/data")
  .expect(200)
  .expect("Content-Type", /application\/json/);

expect(response.body).toEqual({
  success: true,
  data: expect.any(Object),
});
```

### Download Response Assertions

```typescript
// Assert download headers for JSON export
const response = await request(app)
  .get("/api/export?format=json")
  .expect(200)
  .expect("Content-Type", /application\/json/)
  .expect("Content-Disposition", /attachment; filename=export\.json/);

expect(response.body).toHaveProperty("data");
```

### CSV Response Assertions

```typescript
// Assert CSV format
const response = await request(app)
  .get("/api/export?format=csv")
  .expect(200)
  .expect("Content-Type", "text/csv")
  .expect("Content-Disposition", /attachment; filename=export\.csv/);

expect(response.text).toContain("Type,Count");
```

---

## Coverage policy

Backend coverage is measured once across the complete DB-free unit and HTTP
contract tier (`npm run test:coverage` in `backend/`). Measuring those tiers in
separate processes under-counts route modules and must not be used as the
global gate. Database coverage writes to its own directory and is diagnostic.

Frontend coverage counts the production application broadly. Its current
thresholds are a measured non-regression baseline, not a claim that every page
is adequately protected; raise them as critical browser/component contracts
are added rather than excluding untested features.

## Benefits of This Convention

1. **Reliability**: Eliminates HTTP framing parse errors in Supertest
2. **Simplicity**: Less boilerplate code in tests
3. **Consistency**: Uniform pattern across all route tests
4. **Maintainability**: Clear separation between JSON and binary responses
5. **Performance**: Express optimizations for JSON serialization

---

## Summary

- **Isolated route tests**: Use `res.json` for JSON; set only `Content-Disposition` when naming downloads
- **Non-JSON downloads (CSV/XLSX)**: Keep explicit content type and disposition headers
- **Controller unit tests**: Assert headers when it's part of the contract under test
- **Benefits**: Robust tests that avoid transport-level parsing issues while preserving intent

---

## Related Documentation

- `CODEBASE_OPTIMIZATION_TODO.md` - Active test-suite modernization roadmap
- Backend test suite: `/backend/tests/`
