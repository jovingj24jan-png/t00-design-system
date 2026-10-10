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

# S14 Enrol / edit child — `app.html?page=enrol[&id=<childId>][&draft=<draftId>]` (`enrol.js`)

Five steps: **Child details → Guardians & households → Emergency & pickup → Health → Class & schedule**.
Desktop shows a step list (tick = all required fields valid; never ticked just for visiting), tablet a
compact row, phones a "Step n of 5" header with a progress bar. Sticky footer: Back · Save draft ·
Next (Save child / Save changes on the last step). Same wizard in edit mode (S12 row menu → Edit,
S13 ⋮ → Edit all details).

## Rules enforced by `store.enrolChild()` (re-checked on save, not just in the form)

- **Required:** first/last name, DOB (not future); ≥1 guardian with name, relationship, phone, exactly
  one primary contact; ≥1 emergency contact; ≥1 *authorised* pickup person; an explicit answer to
  restrictions, allergies, conditions and medications (Recorded / None — confirmed / Not yet
  collected). Severe allergies need a reaction; medications need a dose and a consent status.
- **Not assumed:** guardians are not automatically pickup-authorised; parental responsibility is only
  recorded when ticked; "not yet collected" is never shown as "none"; no immunisation record means
  nothing either way.
- **Conflict:** an authorised pickup person who is also an active restricted person blocks the save.
- **Duplicates:** same normalised first + last name and DOB. Shown live on step 1 with links to the
  matching S13 profiles; on save, a leader must tick a confirmation to enrol a different child.
- **Capacity:** occupancy is counted from active + starting-soon children (the edited child excluded).
  A full class can't be saved — "Add to waitlist" creates an S09 entry instead (not enrolled).
- **Atomic save:** guardians, households, documents, the child record and draft removal are written as
  one unit with rollback; a double click creates one child. The class teacher gets a notification
  naming the child and class only.

## Data

| Record | Key | Notes |
| --- | --- | --- |
| Class capacity | S17 class record, else `nexora-class-config:<school>` | Demo config: Nursery is full. |
| Households | `nexora-households:<school>` | Seeded from existing guardian links; `guardianLinks[].householdId`, `livesWith`, `responsibility`. |
| Waitlist (S09) | `nexora-waitlist:<school>` | One open entry per child + class. |
| Drafts | `nexora-enrol-drafts:<school>` | Never counted as children; listed on S12 with a Draft badge, Resume and Discard. |
| Child fields added | on the child record | `gender`, `languages`, `nationality`, `schedule{days, session}`, `healthDeclared`, `restrictionsDeclared`, `liftedRestrictions`, `immunisations`, `doctor`, `dietaryNotes`; allergies add `reaction`, `planDocId`; custody adds `relation`, `effective`, `docId`; pickup adds `idRef`, `status`; medications add `schedule`, `consent`, `docId`. |

Related pages: **S09 Waitlist** `app.html?page=waitlist`, **S15 Families** `app.html?page=families`,
**S18 Class rosters** `app.html?page=roster[&cls=<class>]`.

# S15 Families — `app.html?page=families` · S16 Family detail — `app.html?page=family&id=<familyId>` (`families.js`)

A **family** groups one or more **households** (two homes = two households, one family). Guardians and
children are never copied: a family's guardians are its households' guardians, and its children are the
children linked to those households. Families are reconciled on read, so every household (including ones
S14 creates) belongs to exactly one active family; households joined by a shared child join one family.

| Record | Key | Notes |
| --- | --- | --- |
| Families | `nexora-families:<school>` | `{ id, name, householdIds, primaryGuardianId, notes, status: 'active'|'merged', mergedInto, mergedFrom, history }` |
| Parent-app accounts | `nexora-parent-app:<school>` | Per guardian `{ status: 'invited'|'active', invitedAt, activatedAt, history }` plus an `invitations` log (family IDs, recipients, per-guardian result, skipped). |

- **Parent-app status** is derived: Active if any guardian activated, Invited if an invite was issued and
  nobody activated, otherwise Not invited. Inviting never downgrades Active. Demo seeds give each status;
  **prototype invites are recorded, not delivered** (results say "issued (demo — not delivered)").
- **Invites** (row menu, S16, bulk bar) always confirm first, list each guardian once even when linked to
  several selected families, skip active accounts and guardians with no phone or email, and toast the
  number of families actually invited.
- **Balance** column and filter appear only when Fees is in the plan and the role can open Fees; amounts
  come from the fee ledger of the family's children.
- **Add family** links existing guardians and children by ID and blocks a new guardian whose phone already
  belongs to someone on record.
- **Merge** (exactly two selected): side-by-side comparison, "Keep details from A/B" plus field choices
  (surviving family, name, primary contact), a review step, then commit. Households move to the survivor
  by ID — guardians and children combine without duplicates, two homes stay separate, invoices and
  invitation history are untouched. The other family becomes `merged` (`mergedInto` the survivor; its
  S16 link points there). One write: a failed merge changes nothing. Audited.
- Teachers see families with a child in their classes; only leaders add, edit, invite or merge.

Test hook: `app.html?page=families&fail=1` shows the error state with Retry.

# S16 Family details — `app.html?page=family&id=<familyId>` (`families.js`)

Header (name, household addresses, primary contact + phone, parent-app status) with **Message**
(S31 pre-filled with the family's guardians), **Call** (`tel:` from the primary contact's real number;
disabled with an explanation when there is none) and **Statement** (Billing plan + finance role only).
Sections are collapsible `<details>`: Guardians, Households, Children, Custody & Legal Notes
(restricted), Account summary, Messages, Parent app & history.

- **Guardians:** add (new, or link an existing record — no duplicates), edit, star to set the primary
  contact (confirmed; updates the header and S15). Each guardian has a preferred `language` and
  `channels` (App, Email, SMS, WhatsApp). Preferred ≠ available: only an active parent-app account can
  receive anything in this prototype; other channels show "Not connected in this prototype".
- **Households:** label, address, invoice recipient and report recipient (must live in that household),
  add household, link children (each household guardian's relationship is required), unlink a guardian
  (blocked if a child would be left without a guardian, or if they are the primary contact).
- **Custody & Legal Notes:** only for roles with Safeguarding access (Director, Super Admin). For anyone
  else the section isn't rendered at all and `store.getLegalNotes` / `saveLegalNote` refuse. Shows the
  children's custody restrictions plus legal notes (`nexora-legal-notes:<school>`); audit entries record
  that a note changed, never its content.
- **Messages:** the five most recent S31 messages that reached this family's guardians, newest first;
  `?page=messages&family=` lists all, `&msg=` opens one with each recipient's version.
- **Account summary / Statement** (`?page=statement&family=`): balance, last payment and a running-balance
  statement from the fee ledger and payments. Hidden without the Fees plan or a finance role; the direct
  URL is refused.

## Language-aware templates (S31)

`store.TEMPLATES` holds each template per language; `renderTemplate` falls back to the school language,
then English, and reports the fallback. S31 renders one version per guardian in their saved language,
shows every version for review before saving, and stores the rendered text per recipient. Changing a
guardian's language never sends anything; it affects the next template message.
