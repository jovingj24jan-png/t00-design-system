# School Tours — `app.html?page=tours` (`tours.js`)

`?week=YYYY-MM-DD` (desktop week) · `?day=YYYY-MM-DD` (mobile day) · `?tour=<bookingId>` (opens its drawer).
Sidebar: **School Tours** — Director, Admin, Super Admin; on the **Growth** plan (like Admissions).

> Prototype: everything is in this browser's localStorage and every rule runs in `store.js`. Families have no app and
> there's no email/SMS service, so no message is ever sent to a family; staff get in-app Nexora notifications.

## Data

| Record | Key | Notes |
| --- | --- | --- |
| Patterns | `nexora-tour-patterns:<school>` | `{ name, days[], start, end, duration (15/30/45/60), capacity (1–20), guideId, from, to, status }` |
| Slots | `nexora-tour-slots:<school>` | `{ patternId, date, start, end, capacity, guideId, status active/cancelled }` — generated only inside the pattern's dates; with no end date, for the next eight weeks. Closed school days are skipped. |
| Bookings | `nexora-tours:<school>` | `{ slotId, enquiryId, date, start, end, guideId, status booked/attended/no_show/cancelled, moves[], followTaskId, clientId, created/attended/noShow/cancelled by + at }` |

Guides are the admissions team (`admissionsOwners()`). A demo pattern (Tue/Thu mornings, 3 families per slot) with
three bookings is seeded; one links to enquiry ae3.

Slot state is derived, never stored: **open / partly booked / full** while it's ahead, **completed** once it has
ended, **cancelled** if withdrawn. Only bookings with status *booked* use a place — cancelled ones never do, and
finished or withdrawn slots are never offered.

## Rules (store)

- **Manage slots** (`previewTourPattern` / `saveTourPattern`): the live preview and the save use the same generator.
  Existing identical slots are skipped (no duplicates); slots that overlap the same guide's other slots are reported
  with date, time and guide and block saving unless the user ticks "Skip the conflicting times". Nothing existing is
  overwritten.
- **Remove pattern** (`tourPatternImpact` / `removeTourPattern`): future empty slots are withdrawn; if any future slot
  has bookings the user must choose **keep** (they stay) or **cancel those tours** (each cancelled and noted on its
  enquiry). Past slots and attendance are untouched.
- **Book** (`bookTour`): one synchronous step re-checks the slot (active, not started), capacity ("This tour slot is
  full."), the guide's other booked tours at that time, and the enquiry (not enrolled, not lost, no other upcoming
  tour). Then it saves the booking, links it (`enquiry.tourId`, `tourAt`), moves the enquiry from Enquiry to **Tour
  booked** (later stages are never moved back), adds a timeline entry and notifies the guide and owner. A repeated
  `clientId` returns the first booking. Quick-create uses the admissions `createEnquiry` (same duplicate rules), then
  books with the new enquiry's ID.
- **Mark attended** (`markTourAttended`): from the tour day; records who/when; timeline entry. Never enrols.
- **No-show** (`markTourNoShow`): from the tour day; needs a due date and assignee; creates **one** task "Follow up
  after missed school tour" on the enquiry (re-running returns the existing one), timeline entries, and a Nexora
  notification to the assignee. Never marks the enquiry Lost.
- **Reschedule** (`rescheduleTour`): the new slot is checked and taken in the same step that releases the old one; if
  the check fails (full, clash, withdrawn) nothing changes. The original time is kept in `moves`.
- **Cancel** (`cancelTour`): the booking stays as Cancelled, the place is freed, `tourAt` is cleared; the enquiry's
  stage doesn't change. Timeline entry + staff notification.

The pipeline's "Tours booked" KPI (tour stage with a future `tourAt`) stays consistent with these bookings.

## Backend gaps

| Needed | Why |
| --- | --- |
| Server-side transaction / lock for capacity and guide clashes | Two staff on different devices could take the last place at once. |
| Family communications (email/SMS/app) | Families aren't told about bookings, changes or cancellations. |
| Background scheduler | Overdue follow-up notifications only fire while Nexora is open. |

Test hook: `?fail=1` (load error with **Try again**).
