# S19 Attendance — `app.html?page=attendance` (`attendance.js`)

Live check-in, check-out and absence for one class. `?cls=<class>`, `?date=YYYY-MM-DD` (past days are
read-only history), `?status=not-arrived|in|out|absent` (dashboard links; `not-taken` maps to Not arrived).
`?view=staff` and `?view=ratio` still open the older staff-on-duty and ratio lists in `modules.js`.

## One source of truth

| Record | Key | Notes |
| --- | --- | --- |
| Attendance events (append-only) | `nexora-attendance-events:<school>:<date>` | `check-in`, `check-out`, `absent`, `undo`, `register`, `release-refused`, `passcode-failed`. Each has child, class, date, time, acting user (`by`), and where relevant late/start time, dropped-by, collector, verification method, reason/note, `bulkId`, `reverts`, `corrects`, `requestId`. |
| Day register (projection) | `nexora-register:<school>:<date>` | `marks` (present/late/absent, for older readers) + `live[childId]` (`in`/`out`/`absent` with times, collector, reason). Saved in the same commit as the event. |
| Unknown-absence reminders | `nexora-attendance-reminders:<school>` | `{ childId, cls, date, dueAt 10:00, status pending/due/resolved }`. |
| School holidays | `nexora-holidays:<school>` | `{ date, name }` (demo: Deepavali holiday, Christmas Day). Weekly closed days come from Settings → school days. |

`store.attendanceView(cls, date)` derives every child's status and the counts. The S04 dashboard
(`store.attendanceSummary`), the Classes cards, the class detail page and `classRatio` all read it, so the
numbers can't drift apart.

- **Expected** = active, started by the date, booked for that weekday (no booked days = every school day).
  Closed days and holidays expect nobody and show their own state; an empty roster is never called a holiday.
- **In** = checked in and not collected. **Out** = collected. **Absent** = confirmed absent with a reason.
  **Not arrived** is never counted as absent. Each child is in exactly one state.
- **Ratio** children = In only (collected children no longer count). Closed days → "School closed today".
- **Late** = check-in after the class's first routine block that weekday. No routine that day → no lateness
  is recorded (never guessed). Times are this device's clock, which stands in for the school's local time.

## Rules (enforced in the store, not just the screen)

- Class staff for their classes and school leaders only; today only; the school must be open.
- Every write takes a `requestId`; a repeat returns the first result (no duplicate events). State is
  re-read before each write, so a stale screen gets `conflict` and repaints.
- **Check-in**: from Not arrived (or Absent, as a correction). Optional *Dropped off by* from linked guardians
  and pickup contacts — dropping off grants no permission to collect.
- **Check-out**: the collector must be on the child's *current* pickup list (contacts have stable IDs; a
  changed name/phone is a new ID, so a stale selection is refused), have status Authorised, and not be named
  in an active custody restriction ("Do not release"). Pending and Suspended contacts are refused. Every
  refusal is logged as `release-refused`. If the child has a pickup passcode it must match; it is compared in
  the store and never returned to the page, logged or stored in events. 5 wrong codes in 15 minutes lock
  check-out for that child. No authorised contacts → nobody can be selected.
- **Someone else** shows *Not on authorised list — contact a guardian first*, hides Confirm, and offers only
  "Close — child stays in", which records a `release-refused` event and changes nothing. There is no override.
- **Absence**: reason Sick / Holiday / Unknown / Other (required) + optional note. Only Not arrived (or an
  existing absence, to change the reason). Unknown schedules one reminder per child per day for 10:00; any
  other reason or a check-in resolves it.
- **Mark all present**: only Not arrived children, one event each, one commit. Undo (5-second toast; the store
  allows 15 s for slow clicks) is limited to the same user and reverts only children whose latest event is
  still that check-in — anything changed since is left and reported. Undo writes `undo` events; nothing is
  erased.
- **Mark selected absent**: Select mode → tick Not arrived children → reason flow. Children already in/out are
  skipped and reported.
- The older *Mark attendance* register form now keeps S19 details, logs a `register` event per change and
  can't mark a collected child absent.

## Not available in this prototype (needed for production)

- **No server.** All checks run in the browser store and data lives in localStorage. A real deployment must
  enforce the same pickup, passcode, permission and idempotency rules server-side; the child record (with its
  passcode) is still readable in browser storage here, so client checks alone are not real safeguarding.
- **No background jobs.** Reminders become due (and notify Directors/Admins and the class's teachers once) only
  while the attendance page or dashboard is open (`store.processDueReminders`). No SMS/call is sent.
- **Live updates** are same-device: other tabs update through the storage event; other devices need a backend.
- **School timezone** isn't stored; the device clock is used.

Test hook: `?fail=1` shows the error state with Retry.
