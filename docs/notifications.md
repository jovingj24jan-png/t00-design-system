# Notifications — centre, bell and S63 settings

Status: **prototype**. Records live in `localStorage` key `nexora-notifications`; nothing is sent
by email or push.

## Files

| File | Role |
| --- | --- |
| `notifications.js` | Centre (`app.html?page=notifications`) and S63 settings (`app.html?page=notification-settings`) |
| `bell.js` | Shared bell: unread badge (`99+` cap) + 10 latest; used in the mobile bar, the desktop top bar and the dashboard header |
| `store.js` | Records, per-user reads/writes, recipients, events from the daily workflows |

## Record

`{ id, toUserId, toRole, module, kind, title, body, createdAt, read, readAt, deletedAt, mentions[], recordType, recordId, severity, dedupeKey, actorId }`

Older records addressed only to a role (`toRole`) are copied once to each user with that role.
`module` is a catalogue key, or `system` for access requests, upgrade requests and emergency broadcasts.

## Rules

- A user sees a notification only if it's theirs, not deleted, and their role can open its module on the current plan (`system` is always visible).
- Recipients: the roles in the module's catalogue entry, minus the person who did it, minus users who muted that module in S63. Critical ones (ratio breaches, high-severity incidents, emergency broadcasts) ignore muting.
- Mentions: assigning an enquiry follow-up, posting an announcement to a class (its educators), and someone else saving your class's register.
- `dedupeKey` stops one business event notifying the same person twice.
- Delete sets `deletedAt` on the notification only; the enquiry, payment or incident is untouched.
- Dates use the browser's local time zone; the school settings don't store a time zone yet.

## Store methods

`listNotifications(user, { tab, modules, from, to })`, `unreadCount(user)`, `setNotificationsRead(user, ids, read)`,
`markAllRead(user)`, `deleteNotifications(user, ids)`, `notificationTarget(user, n)`, `notificationModules(user)`,
`getNotificationSettings(user)`, `saveNotificationSettings(user, settings)`.
Writes resolve `{ ok, updated: [ids], failed: [ids] }` so partial failures can be reported.

## Backend integration

Replace the bodies above with API calls keeping the same result shapes, create notifications on
the server from the same events (`events.*` in `store.js`), and call `emit()` when new ones
arrive (e.g. from a websocket) so the centre and every bell update. Ownership, role, plan and
mute checks must be repeated on the server.
