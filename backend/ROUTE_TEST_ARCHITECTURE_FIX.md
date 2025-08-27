# Route test architecture and JSON response convention

This note documents our conventions for Express route tests to keep them fast, stable, and readable.

## Scope

- Isolated route tests: Tiny in-memory Express apps composed inside tests and exercised with Supertest.
- Controller unit tests: Directly invoke controller functions using mocked `req`/`res` and assert headers/body logic.

## JSON responses in isolated route tests

When returning JSON from an isolated test route, use `res.json(...)` and set only `Content-Disposition` if a download filename is desired. Do not manually set `Content-Type` for JSON in these isolated routes.

Why:

- Letting Express serialize and set headers prevents HTTP framing issues observed by Supertest (e.g., `HPE_INVALID_CONSTANT` parse errors) when mixing custom headers with `res.send(JSON.stringify(...))`.
- Reduces brittle assertions while preserving intended behavior. We still assert payload shape and any required disposition headers.

Policy:

- JSON: `res.json(data)` and (optionally) `res.setHeader('Content-Disposition', 'attachment; filename=...')`.
- CSV/XLSX: keep explicit `Content-Type` + `Content-Disposition`, then `res.send(...)` as needed.

Example (isolated test app):

```ts
app.get("/api/analytics/export", (req, res) => {
  const format = (req.query.format as string) || "json";
  const data = {
    /* build test data */
  };

  if (format === "json") {
    res.setHeader("Content-Disposition", "attachment; filename=analytics.json");
    return res.json(data);
  }

  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=analytics.csv");
    return res.send("Type,Count\nUsers,1\n");
  }

  if (format === "xlsx") {
    // generate buffer
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=analytics.xlsx");
    return res.send(buffer);
  }

  return res
    .status(400)
    .json({ success: false, message: "Unsupported format." });
});
```

## Controller unit tests

Controller unit tests may continue to assert explicit headers (e.g., `Content-Type`) where it is part of the contract under test. Prefer `res.json(...)` unless the test specifically targets header behavior.

## Summary

- Isolated route tests: use `res.json` for JSON; set only `Content-Disposition` when naming downloads.
- Non-JSON downloads (CSV/XLSX): keep explicit content type and disposition headers.
- This keeps tests robust and avoids transport-level parsing issues while preserving intent.
