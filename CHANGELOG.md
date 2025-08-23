# Changelog

## Unreleased

- Backend: emit distinct `guest_moved` socket event (in addition to `guest_updated`) when admins move a guest between roles.
- Frontend: handle `guest_moved` in EventDetail with a concise notification and data refresh.
- Tests:
  - Backend unit test asserts both `guest_updated` and `guest_moved` are emitted.
  - Frontend adds a realtime test for the `guest_moved` notification.
