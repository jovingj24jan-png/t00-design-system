# Parent–Teacher Meetings — `app.html?page=meetings` (`meetings.js`)

Tabs: `?tab=availability|bookings|records`. Other parameters: `?week=` (desktop week), `?day=` (mobile day),
`?teacher=`, `?booking=<id>` and `?record=<id>` (open the drawers). Sidebar: **Parent–Teacher Meetings** (Teacher,
Director, Admin, Super Admin). The child profile has a **Conferences** tab (`record.html?id=<child>#tab=conferences`).

> **Prototype.** Data lives in this browser's localStorage and is checked in the store layer only. Families have no app
> or portal, so booking, cancellation and sharing notices are recorded per family as `queued (demo — not delivered)` or
> `skipped: no parent-app account`. Nothing is delivered. There is no video provider, so no meeting link is ever made
> up; staff can paste a real `https://` link.

## Data

| Record | Key | Notes |
| --- | --- | --- |
| Slots | `nexora-ptm-slots:<school>` | `{ teacherId, date, start, end, mode both/in_person/video, status active/removed }`. Open, booked and past are **worked out from bookings**, never stored, so a booked slot can't show as open. |
| Bookings | `nexora-ptm-bookings:<school>` | `{ slotId, teacherId, date, start, end, familyId, childId, mode, topic, internalNote, location, videoLink, status upcoming/completed/cancelled/no_show, clientId, notifications[] }`. Cancelled bookings are kept for history. |
| Records | `nexora-ptm-records:<school>` | One per meeting: `{ bookingId, childId, familyId, teacherId, date, topic, notes, strengths, concerns, familySummary, shareStrengths, followUpDate, actions[], shared, sharedAt, shareHistory[] }`. |
| Actions | inside the record | `{ text, owner {kind staff/family, id}, due, done, doneAt, learningRef, share }`. Status is Completed if done, Overdue if past due, otherwise Pending. |

Teachers are the S17 educators; working hours come from the staff rota (`shiftOf`) and school closures from
`schoolDay`. Demo samples are seeded and labelled: open slots, three upcoming bookings, one completed meeting with a
record, and one cancelled booking.

## Rules (store)

- **Who:**
  - **Leaders** manage every teacher's slots, bookings and records.
  - **A teacher** generates slots for themselves, books their own slots for families in their classes, and edits their
    own records.
  - **Class staff** can view records for children in their classes.
- **Generate slots:** `planSlots()` builds both the preview and the result (`createSlots()` runs it again on the latest
  data before saving), so the preview count always matches what's created.
  - **Settings:** teachers, a date range (31 days at most, not in the past), weekdays, start and end time, 10/15/20-minute
    slots, and a 0–60-minute break.
  - **Skipped:** past times, school-closed days, anything overlapping an existing slot (so bookings are never
    overwritten), and times outside the teacher's rota hours unless "Only within working hours" is unchecked.
- **Booking:** checked and written in **one synchronous store operation** against the latest saved data.
  - **Refused:** removed, booked or past slots ("This slot has just been booked. Please choose another time."), a
    child outside the family, other-class children for teachers, a mode the slot doesn't offer, a second same-day
    meeting with the same teacher for the same child, and invalid video links.
  - **Retries:** a repeated `clientId` returns the first booking instead of making a new one.
  - **Concurrency:** this prevents double booking within one browser, including two calls at almost the same moment.
    **Real multi-user safety needs a server-side atomic write** (unique active booking per slot); see below.
- **Cancel:** only upcoming bookings. The slot reopens only if it's still in the future and "Reopen the slot" is ticked;
  otherwise it becomes unavailable (or stays past). The cancellation notice is recorded once — cancelling again
  returns "already cancelled" with no second notice.
- **Outcome:** after the start time a meeting can be marked Completed or No-show. Saving a record also marks it
  Completed.
- **Records:** can only be created once the meeting has started (not for cancelled ones). Saving again updates the same
  record. An action can reference one of the child's Learning & Portfolio entries for context only — progress is never
  changed.
- **Sharing:** `familyConferenceView()` is the only family-facing projection. It contains the family summary, the
  strengths (only if "Include strengths" is ticked), and actions marked *share*. Discussion notes and concerns are
  never included.
  - **Share on:** shows that exact preview, asks for confirmation, then records `sharedAt` and the notice result.
    Repeating it changes nothing. If nothing is marked to share, sharing is refused.
  - **Share off:** hides it without touching the internal record.
- **Follow-up reminders:** `processMeetings()` (shell ticker) sends one Nexora notification per overdue staff-owned
  action to that teacher, deduplicated by action and due date.

## Integrations

- **Child profile → Conferences:** upcoming meetings and the child's records, each opening the same record.
- **S13:** the record and the booking link to the child's Daily Diary at `record.html?id=<child>#tab=diary`.
- **S29 planning:** links to the class's Lesson Planning page (`?page=lessons&cls=<class>`) and the child's
  Learning & Portfolio tab.

## Backend gaps

| Needed | Why |
| --- | --- |
| Server-side atomic booking (unique active booking per slot, conditional insert) | Browser storage can't stop two staff on different devices booking the same slot. |
| Family portal + notification delivery | Families can't receive confirmations, cancellations or shared records yet. |
| Video-conferencing integration | No links are generated; staff paste them manually. |
| Server-side permissions, tenant isolation, audit | All checks run in the browser today. |

Test hook: `?fail=1` (load error with **Try again**).
