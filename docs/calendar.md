# Calendar & Events — `app.html?page=calendar` (`calendar.js`)

`?view=month|week|day|agenda`, `?date=YYYY-MM-DD`, `?type=trip,meeting`, `?cls=<class>`, `?event=<occurrenceId>`
(opens its details). Weeks start on Monday. Phones default to Agenda unless the user picked a view
(`nexora-calendar-prefs:<userId>`). Sidebar: **Calendar & Events**.

## Data (one source for the calendar, S04 dashboard, class detail, child profile, attendance/diary closures)

| Record | Key | Notes |
| --- | --- | --- |
| Event series | `nexora-events:<school>` | `{ id, schoolId, title, type, allDay, start, end, repeat, until, location, description, classIds, staffIds, rsvp, consent, attachments, status, exceptions, createdBy/At, updatedBy/At, history }`. Timed: `YYYY-MM-DDTHH:MM`; all-day: `YYYY-MM-DD` (end inclusive). `classIds: []` = whole school. |
| Occurrences | derived | id `seriesId@originalDate`. Weekly = same weekday; monthly = same day of month, **months without that day are skipped** (a series on the 31st has no Feb/Apr/Jun/Sep/Nov date). `exceptions[date]` is either `{ cancelled }` (never regenerated) or `{ override }` (a one-off change). |
| RSVP | `nexora-event-rsvps:<school>` | `{ occurrenceId, childId, response yes/no, guardianId?, recordedBy, at }` — a family's reply recorded by staff. |
| Consent | `nexora-event-consents:<school>` | `{ occurrenceId, childId, status granted/declined, guardianId (required), recordedBy, at }` — separate from RSVP; an RSVP "yes" is never consent. |
| Notices | `nexora-event-notices:<school>` | One row per guardian per reminder/move notice, with the result. |
| Files | `nexora-event-files:<school>` | PDF/JPEG/PNG ≤ 1 MB as data URLs on this device. |

Types: Event (strong neutral), Trip (yellow), Meeting (grey, staff), Holiday / Closure (striped), Parent
conference (outlined); every chip/badge also says its type in text. RSVP is allowed for events, trips and
conferences; consent for trips and events. A **school-wide Holiday / Closure closes the school** in
`schoolDay()` (attendance, diary, ratios). Class-only closures show on the calendar but don't close attendance.

## Rules (all in the store)

- Leaders (Director, Admin, Super Admin) create, edit, move and delete. Teachers see school-wide events,
  their classes' events and events they staff, and record RSVP/consent for children in their classes.
- Validation: title, type, dates; times unless all-day; end after start; repeats need an end date (≤ 2 years)
  and must end before the next occurrence; classes/staff/files must exist.
- **Edit scopes** for repeating events: *This event only* (override on that date), *This and future events*
  (the series ends the day before; a new series starts there — `splitFrom` links them), *Entire series*
  (series updated; fields you changed also apply to dates that had one-off changes). If dates shift, RSVP and
  consent records move with their occurrence. The form shows how many replies are linked before saving.
- **Delete scopes**: this event (cancelled exception), this and future (series ends the day before), entire
  series (series marked cancelled; history kept).
- **Reschedule**: drag (mouse, Month/Week/Day) or *Reschedule* in the details (keyboard/touch). Nothing is
  saved until the user confirms *Move and notify* or *Move without notification* (meetings: *Move*). Duration
  and all-day status are kept. Notices are recorded only after the move is saved; a failed save leaves the
  event where it was.
- **Remind non-responders**: guardians of children with no RSVP; one notice per guardian; repeats within 30
  minutes are skipped.

## Notification boundary

`deliver()` in `store.js` is the only place a message would leave the app. In this prototype it records
"queued (demo — not delivered)" for guardians with an active parent-app account and "skipped" for everyone else.
Nothing is sent by email, push or SMS. Replace `deliver()` with a real service and keep the records.

## Not available in this prototype (needed for production)

- **No server**: events, replies and files live in this browser's localStorage. Permissions and validation are
  enforced in the store layer, but a real backend must repeat them (and tenant isolation) server-side.
- **No family app**: RSVP and consent are recorded by staff on a family's behalf.
- Attachments are device-local data URLs, not secure storage.
- Times use the device clock as the school's local time.

Test hook: `?fail=1` shows the error state with Retry.
