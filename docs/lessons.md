# Lesson Planning & Class Timetable — `app.html?page=lessons` (`lessons.js`)

`?cls=<class>`, `?week=<any date in the week>`, `?tab=weekly|themes|timetable|library`, `?day=mon` (phones).
Sidebar: **Lesson Planning**. Teachers plan their own classes; leaders can plan any class.

## Data

| Record | Key | Notes |
| --- | --- | --- |
| Activities | `nexora-activities:<school>` | `{ id, title, area, ages, objectives, materials[], prep, notes, outcomeIds[], status }`. Seeded with 15 demo Montessori presentations (`demo: true`, labelled in the library). Areas are the existing `LEARNING_AREAS`. |
| Weekly plans | `nexora-lesson-plans:<school>` | One per class + week (Monday): `{ id, classId, weekStart, status, revision, entries[{ id, activityId, day, blockId, order, note, flag }], approved{ revision, entries, by, at } }`. |
| Reviews | `nexora-plan-reviews:<school>` | One per submission: `{ planId, revision, submittedBy/At, reviewerId, decision, comment, decidedBy/At, entries }`. Never overwritten. |
| Themes | `nexora-themes:<school>` | `{ classId, start, end, name, description, focusAreas[], vocabulary[], activityIds[], notes }`. |
| Reviewer | `nexora-plan-settings:<school>` | `{ reviewerId }` — defaults to the Director; leaders change it from the page. |
| Timetable | `nexora-class-routines:<school>` | The existing class routine (also shown on the class page). Blocks now have stable ids and optional `days`. |

## Rules (enforced in the store)

- **Weekly plan**: rows = the class's timetable blocks, columns = school days (Mon–Fri by default). Every change
  (drag in, move, reorder, remove, add from details, notes) saves the whole grid at once; a failed save redraws the
  saved plan. An activity can't be in the same slot twice, or in a block that doesn't run that day.
- **Copy last week**: always confirms (warns when it replaces existing activities). New entry ids; source week
  untouched; approval history not copied; the copy is a draft. Activities or blocks that no longer exist are kept
  and flagged "Check" — they must be resolved before submitting.
- **Status**: Draft → Submitted → Approved / Changes requested.
  - Submit needs at least one activity, no flagged entries and a reviewer who isn't the submitter. It records the
    revision, submitter and time, locks the plan and notifies the reviewer in Nexora.
  - Only the configured reviewer can decide, and never on their own submission. "Request changes" needs a comment.
    The submitter is notified in Nexora.
  - Changes requested: the comment shows on the page; the teacher edits and resubmits (new revision, history kept).
  - Approved: locked. "Edit plan" starts a new draft revision; the approved version is kept in `approved`.
- **Timetable**: end after start; exact duplicates refused; overlaps need "Save anyway". Deleting a block that plans
  use asks first, and those activities stay (shown under "Routine removed") rather than moving.
- **Themes**: name and dates required (≤ 6 weeks); focus areas from the learning areas; linked activities by id.

## S24 framework outcomes — not available yet

There is no S24 learning-framework module or outcome data in this project. `store.frameworkOutcomes()` is the
single integration point: it reads `nexora-framework-outcomes:<school>` (`{ id, code, title, description }`) and
returns nothing today, so activity details say the framework isn't set up instead of showing invented codes.
`saveActivity` only accepts outcome ids that exist there. When S24 is built, populate that adapter and add the
link/unlink controls to the activity form.

## S04

The dashboard widget **Today's plan** (`store.todayPlan`) lists today's entries for the user's classes with the
block time, area and plan status, from the same saved plans. Nothing planned → "Plan today".

## Not available in this prototype

- No server: plans, reviews and themes live in this browser's localStorage. Permissions are enforced in the store,
  but a backend must repeat them.
- Notifications are in-app only; no email or push.

Test hook: `?fail=1` shows the error state with Retry.
