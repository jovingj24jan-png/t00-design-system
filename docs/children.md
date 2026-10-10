# S12 Children — data, screens and integration seams

Status: **prototype**. Records live in this browser's `localStorage`, seeded on first read by
`store.js`. Nothing is sent to a server; messages to families are saved, not delivered.

## Screens

| Screen | URL | File |
| --- | --- | --- |
| S12 Children (grid / list) | `app.html?page=children` | `children.js` |
| S13 Child record | `record.html?id=<childId>` | `record.js` |
| S14 Enrol child / edit | `app.html?page=enrol` · `app.html?page=enrol&id=<childId>` | `children.js` |
| S31 Message families | `app.html?page=compose&children=<id>,<id>` | `children.js` |

Test hook: `app.html?page=children&fail=1` makes the first load fail, to show the error state and Retry.

## Data (`store.js`)

`nexora-children:<schoolId>` holds one record per child:
`{ id, firstName, lastName, dob, cls, status, startDate, photo, guardian{name, relation, phone, email}, alerts[{type, detail}], withdrawal, history[] }`.

- Status: `active` · `starting` (start date in the future) · `withdrawn` · `graduated`.
- Alert types: `allergy` · `medical` · `custody` · `dietary`.
- `store.roster` is now **every active child**, so attendance, fees, ratios and the dashboard
  follow enrolments, class moves and withdrawals. Seeds keep the original roster IDs.
- Writes (`saveChild`, `moveChildren`, `withdrawChild`, `saveFamilyMessage`) check the role and
  resolve `{ ok }` or `{ ok: false, reason, errors }`. A bulk move is all-or-nothing.
  Withdrawal never deletes a record; it sets the status and keeps reason, date and history.
- Grid/List preference: `nexora-children-prefs:<userId>` (per user).

## Permissions

| Role | Children | Enrol / edit / move / withdraw | Message families |
| --- | --- | --- | --- |
| Director, Admin, Super Admin | All classes | Yes | Yes |
| Teacher | Own class only | No | Yes (own class) |
| Accountant | All classes, view only | No | No |

## Behaviour notes

- The header count is current children (active + starting soon). Withdrawn and graduated
  children appear only when chosen in the Status filter.
- Filters: options within a group are OR, groups are AND, search applies on top.
  "All alerts" means children with any alert.
- Ages are calculated from the date of birth each time the page renders.
- CSV export is UTF-8 with a BOM; the header button exports the filtered list, the bulk
  action exports only the selected children.
- List view priority columns: Start date hides below 1280px and Age below 1024px (both remain
  on S13 and in the CSV). Below 768px each row is a stacked card.

## Replacing the prototype

Swap the store functions for API calls and keep their result shapes; the pages need no change.

# S13 Child profile — `record.html?id=<childId>#tab=<section>` (`profile.js`)

Header card (photo or initials, name, preferred name, age from DOB, DOB, class, key teacher, status,
start date) → **persistent safety banner** → 11 tabs → one section panel. The banner is a page-level
element outside the tab panel, so no tab can hide it; on phones it is sticky under the top bar and the
tabs become a dropdown. `#tab=` deep-links a section.

## Data added to `store.js`

| Record | Key | Notes |
| --- | --- | --- |
| Child profile fields | on `nexora-children:<school>` | `preferredName`, `keyTeacher`, `photo`, `guardianLinks`, `emergency`, `pickup{authorised, verification, passcode}`, `medications`, `careNotes`, `emergencyInstructions`. Seeded records are normalised on read; new S14 enrolments get only what was entered (one guardian, no passcode). |
| Shared guardians | `nexora-guardians:<school>` | Siblings share a record; removing a link never deletes it. `child.guardian` mirrors the primary for S12/S31. |
| Safety alerts | `child.alerts` | Single source for S12 icons, the S13 banner and the editors. Allergy/medical add `severity`, `instructions`; custody adds `restrictedPerson`. |
| Diary, learning, documents, consents | `nexora-diary`, `nexora-learning`, `nexora-child-docs`, `nexora-consents` | Keyed by child ID. Consents with no response are **Pending**, never Granted. Documents: PDF/JPEG/PNG ≤ 1 MB, stored as data URLs. |
| Audit log | `nexora-audit:<school>` | Actor, role, child, action, time. Every edit and every passcode reveal; the passcode value is never logged. |

Attendance shows only registers saved on this device. Incidents and billing read the existing
safeguarding and fee ledgers.

## Permissions (`PROFILE_ACCESS` in `store.js`)

| Section | View | Edit |
| --- | --- | --- |
| Overview, identity, family | All roles with Children access | Director, Admin, Super Admin |
| Emergency & pickup, custody, passcode, medical | Teacher + leaders | Leaders |
| Diary, learning | Teacher + leaders | Teacher + leaders |
| Documents, consents | Teacher + leaders | Leaders |
| Incidents | Safeguarding roles (Director, Super Admin) | — |
| Billing | Fees roles (Director, Accountant, Admin, Super Admin) | — |

Teachers only see children in their own classes; other records show a no-access state. Checks run
before a section renders and again inside every store write. Unauthorised roles see "on file" notices
in the banner instead of medical or custody details.

## Plan-locked tabs

Tabs tied to a module (`attendance`, `classroom-tracker`, `safeguarding`, `fees`) read
`store.isEntitled()`. On Starter, Incidents (Premium) and Billing (Growth) show a locked mini-state
with a link to compare plans; after an upgrade the real data appears.

## Print summary

Builds a white A4 summary (identity, contacts, emergency contacts, authorised pickup, and medical and
custody details only for permitted roles) and calls `window.print()`. The passcode is never printed.
