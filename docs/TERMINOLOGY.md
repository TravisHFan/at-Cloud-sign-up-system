# Terminology: System Roles vs @Cloud Status

Purpose: avoid confusion between the System Authorization role "Leader" and the @Cloud involvement status.

- System Authorization Levels (authorization/permissions)

  - "Super Admin", "Administrator", "Leader", "Participant".
  - These appear in auth, gating, menus, analytics role counts, etc.
  - Keep the word "Leader" here as-is.

- @Cloud Status (profile field; identifiers remain unchanged for compatibility)

  - Identifier: `isAtCloudLeader` (boolean) and `roleInAtCloud` (string).
  - User-facing label: "@Cloud Co-worker".
  - Examples where user-facing copy uses "@Cloud Co-worker":
    - Sign-up/Profile forms: “Are you an @Cloud Co-worker?”
    - Validation/error text and middleware messages
    - XLSX/CSV export headers for the status field
    - Email/system messages about @Cloud status changes

- Event Roles (per-event participation options)
  - Example: “Group A Leader” in Workshop role sets. Top-level examples now include “Opening Keynote Speaker” and “Evaluators.”
  - This “Leader” is part of event role names, not the @Cloud status nor the system authorization role.

Guidelines

- Do not rename code identifiers (e.g., `isAtCloudLeader`), API routes, or existing test file names in this phase.
- Prefer “@Cloud Co-worker” in all user-facing text referring to the @Cloud status.
- Preserve "Leader" where it refers to:
  - System Authorization role, or
  - Event roles like “Group Leader”.

Notes

- Some test files and routes still use names like `new-leader-signup`; these refer to the @Cloud status flows and remain for backward compatibility.
