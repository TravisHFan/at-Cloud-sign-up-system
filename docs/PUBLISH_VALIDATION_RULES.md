# Publish Validation & 422 Enforcement

This document captures the rules and rationale for the event publish validation layer introduced with the auto–unpublish phase.

## Summary

When attempting to publish an event (`POST /api/events/:id/publish`), the API now **returns HTTP 422** with a **`code: "MISSING_REQUIRED_FIELDS"`** payload whenever one or more _format‑specific necessary fields_ are absent or blank. These fields are **not schema-required while drafting**; they become mandatory only at publish time (and to remain published thereafter).

Other validation failures (e.g. no public role selected, short optional description under strict mode) continue to surface with **HTTP 400** unless they accompany missing necessary fields—in which case the aggregate 422 response is prioritized for clearer UX.

## Necessary Fields Matrix

The matrix of fields enforced at publish time:

| Format               | Fields Required to Publish                      |
| -------------------- | ----------------------------------------------- |
| Online               | `zoomLink`, `meetingId`, `passcode`             |
| In-person            | `location`                                      |
| Hybrid Participation | `location`, `zoomLink`, `meetingId`, `passcode` |

These are defined in code at `backend/src/utils/validatePublish.ts` (`NECESSARY_PUBLISH_FIELDS_BY_FORMAT`).

## Response Shape (422)

Example response when attempting to publish an Online event missing `meetingId` & `passcode`:

```json
{
  "success": false,
  "code": "MISSING_REQUIRED_FIELDS",
  "format": "Online",
  "missing": ["meetingId", "passcode"],
  "message": "Missing necessary field(s) for publishing: meetingId, passcode.",
  "errors": [
    {
      "field": "meetingId",
      "code": "MISSING",
      "message": "meetingId is required to publish this Online event."
    },
    {
      "field": "passcode",
      "code": "MISSING",
      "message": "passcode is required to publish this Online event."
    },
    {
      "field": "__aggregate__",
      "code": "MISSING_REQUIRED_FIELDS",
      "message": "Missing necessary field(s) for publishing: meetingId, passcode."
    }
  ]
}
```

## Interaction with Other Rules

- `NO_PUBLIC_ROLE` (no role has `openToPublic=true`) → 400 if alone; still appears in `errors` when 422 triggered by missing necessary fields.
- Purpose length (`TOO_SHORT`) & `timeZone` presence are enforced only when `PUBLISH_STRICT_VALIDATION=true`; they yield 400 unless aggregated under a 422.
- Location schema requirement was relaxed (no longer schema-required) to enable draft flexibility; publish-time enforcement now guarantees correctness.

## Auto–Unpublish

The update route will _auto‑unpublish_ an event that loses any necessary field while published, setting `autoUnpublishedAt` & `autoUnpublishReason`. This ensures persistent integrity even after edits post‑publication.

## Testing Conventions

Integration tests now:

- Expect 422 + `MISSING_REQUIRED_FIELDS` whenever necessary publish fields are absent.
- Explicitly include all required virtual fields (`zoomLink`, `meetingId`, `passcode`, `timeZone`) for successful Online publish scenarios.

See:

- `public-events-publish-validation.integration.test.ts`
- `events-publish-necessary-fields.integration.test.ts`

## Migration Guidance

Existing clients expecting 400 for missing virtual fields must update logic to treat 422 as “supply publish requirements.” UI forms should highlight each missing field using the per-field `MISSING` errors and optionally the aggregate code for a summary alert.

## Future Extensions

Potential future additions (not yet enforced):

- Flyer presence for certain formats
- Minimum lead time before start
- Organizer contact object (structured) instead of flat string

Design keeps these extendable—add new fields into the matrix or append strict-mode checks without altering the 422 contract.

---

Last updated: ${new Date().toISOString()}
