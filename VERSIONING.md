<!-- Removed: superseded by simplified unversioned API policy retained elsewhere. -->

The project uses a single, unversioned base path:

```
/api
```

No versioned prefix was ever deployed. Any early experimental references have been removed to keep the surface clean.

## Philosophy

Prefer stability of the base path. Evolve the API through additive, backward‑compatible changes (new fields, optional parameters) instead of URL version bumps.

## Breaking Change Playbook (Only If Unavoidable)

1. Add new behavior behind an opt‑in query param or header (e.g. `?responseVersion=2`).
2. Run both behaviors in parallel while emitting a `Deprecation` header on the old shape.
3. Announce and document the change window clearly.
4. Remove the old shape after the window closes.

## When NOT to Version

- Field additions that don’t break existing consumers.
- More permissive validation.
- Performance or internal implementation changes.

## Acceptable Versioning Patterns (Future)

If a truly incompatible change is required, prefer a narrow scope:

- Query / header negotiated response versions.
- Resource‑specific secondary endpoints (e.g. `/api/reports/export2`).

Avoid introducing a global `/api/v2` unless a majority of endpoints must change simultaneously (rare).

## Contribution Rules

- Do not introduce versioned path prefixes.
- Document only `/api/...` routes in code, tests, and docs.
- Remove any stray reappearances of deprecated versioned paths immediately.

## FAQ

**Q: How do clients know about new fields?** They are additive – clients may ignore unknown fields safely.

**Q: How to deprecate a field?** Start returning a `Deprecation` header when the field is present; update docs; remove after window.

**Q: How long is a deprecation window?** Decide per change (recommend minimum 2 release cycles).

---

Owner: API Platform Team  
Status: Stable (No legacy versioning layer)
