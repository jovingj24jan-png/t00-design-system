# S23 Rooms & Resources — `app.html?page=resources` (`resources.js`)

`?tab=rooms|materials|library|inventory`, `?date=YYYY-MM-DD` (rooms), `?focus=<itemId>` (inventory),
`?repairs=1` (materials, repair list open). Sidebar: **Rooms & Resources**. The class page's Room tab reads the
same records (the class's room, today's bookings and its materials).

## Data

| Record | Key | Notes |
| --- | --- | --- |
| Rooms | `nexora-rooms:<school>` | `{ id, name, type, capacity, classId, notes, status }`. Seeded from each class's room plus Activity hall and Garden (demo capacities). Room capacity ≠ class enrolment capacity. |
| Bookings | `nexora-room-bookings:<school>` | `{ id, roomId, date, start, end, title, classId, group, staffId, participants, notes, status booked/cancelled }`. Two demo bookings tomorrow. |
| Materials | `nexora-materials:<school>` | `{ id, name, area, classId, roomId, condition good/repair/missing, lastChecked, notes }`. Areas are the existing learning areas. |
| Repairs | `nexora-repairs:<school>` | `{ id, materialId, status open/progress/resolved, reportedAt, reportedBy, notes, history }`. |
| Books / loans | `nexora-books:<school>`, `nexora-loans:<school>` | Books have `copies` and an optional device-local cover. Loans are kept after return (`status: returned`). Availability = copies − active loans. |
| Inventory / movements | `nexora-inventory:<school>`, `nexora-stock-movements:<school>` | Items keep `qty`, `reorder`, `alert`. Every quantity change has a movement `{ before, change, after, direction, reason, notes, at, by }`. |

## Rules (in the store, at save time)

- **Bookings**: required fields; end after start; within school hours (Settings, default 07:00–18:00); not in the
  past or on a closed day/holiday; participants ≤ room capacity. **Clash** = overlapping times in the same room on
  the same date, checked against every saved booking (adjacent times are fine; the booking being edited is
  excluded). A clash returns the other booking's time and class/group — "Room booked 10:00–11:00 by Montessori A" —
  and nothing is saved. Cancel keeps the record.
- **Materials**: leaders add; leaders and the class's teachers update. "Needs repair" saves the material and opens a
  repair (or reuses the open one — never two open tickets) in one write, then notifies the other school leaders in
  Nexora. Back to Good doesn't close the repair; leaders set Open / In progress / Resolved with notes. "Missing
  pieces" needs a note.
- **Library**: lend only when a copy is free; the lowest free copy number is used, so one copy is never lent twice;
  a borrower can't hold two copies of a title; due date ≤ 28 days. Teachers lend to staff and children in their
  classes. Return records who and when. Overdue = due date before today and not returned.
- **Inventory**: quantity changes only through **Adjust stock** (add/remove, whole number ≥ 1, reason required,
  "Other" needs a note, can't remove more than on hand) or the opening quantity. Status OK / Low (≤ reorder) /
  Out (0) comes from the saved quantity. Leaders get one notification when an item becomes low and another (critical)
  if it runs out; nothing more while it stays low/out; the alert clears when stock goes back above the reorder level,
  and the next drop is a new alert.

## Not available in this prototype

- No server: everything is in this browser's localStorage. The checks run in the store layer, but concurrent users
  on different devices need server-side constraints and transactions (especially booking clashes and stock).
- Notifications are in-app only (no email/push). Book covers are device-local images.
- Times use the device clock as the school's local time.

Test hook: `?fail=1` shows the error state with Retry.
