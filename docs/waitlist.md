# Waitlist (S09) — `app.html?page=waitlist[&cls=<classId>][&focus=<entryId>]`

Code: `waitlist.js` (page) and the waitlist section of `store.js`. Roles: Director, Admin, Super Admin.

## What the page does

- **Classes:** one tab per active class (a dropdown below 768px). Each shows seats free and children waiting.
- **Seat strip:** capacity, enrolled, moving in, seats free, held by offers and waiting, with a banner that says whether
  a place can be offered.
- **Ordered list** with position, child, age at the requested start, requested start, date added, priority flags,
  notes and actions. It's a table on tablet and desktop, and one card per child on mobile.
- **Filters:** search (child or parent), requested start period, priority flag, and whether the child has an
  admissions record. Clearing the filters restores the full list.

## Data — `nexora-waitlist:<school>` (the existing key, extended)

`{ id, firstName, lastName, dob, cls, startDate, guardianName, guardianPhone, notes, status, position, enquiryId,
addedBy, createdAt, updatedAt, offeredAt, removed, history[] }`

- **`status`:** `waiting`, `offered`, `enrolled` or `removed`. Records are never deleted.
- **`position`:** numbered 1…n within each class's *waiting* entries. Entries saved before ordering existed are
  numbered once, by the date they were added.
- **`history`:** one event per change. Types: added, reorder (from, to, reason), notes, applicant, offer, removed,
  enrolled. Each event records who made the change and when.
- **Audit log:** reorders and removals are also written to the shared log (`nexora-audit`). An entry holds the entry
  ID, class ID, applicant ID, the old and new positions, the reason, who did it and when.

## Rules

- **Seats** follow S17's `seatsLeft`: capacity − enrolled (active and starting) − moves already scheduled into the
  class. A waitlist offer holds its seat while the applicant is in Offer sent. So places to offer = seats free −
  offers outstanding, and never less than 0.
- **The order is managed by staff.** Priority flags (Sibling, Staff child, Returning) are only shown, never used to
  reorder. Each flag comes from the records, with its reason:
  - **Sibling:** the guardian's phone belongs to the guardian of an enrolled child, or the applicant has linked
    siblings.
  - **Staff child:** the guardian's phone is a staff member's.
  - **Returning:** a withdrawn or graduated child with the same name and date of birth.
- **Reordering** works by drag and drop on tablet and desktop, or with Move up, Move down or Move to number from the
  row menu on any screen.
  - The proposed order shows right away. Nothing is saved until a reason is chosen, and "Other" needs details.
  - Cancel, or a failed save, puts the saved order back.
  - If the list changed since you loaded it (`order` check), nothing is saved and the latest order is shown.
- **Offer place** reuses the S07 offer letter: `NexoraAdmissions.actions().offerDialog`, with class, family and
  seat details shown above the letter.
  - An entry without an admissions record gets an enquiry first. If the same child already has one, it's linked
    instead. A former pupil (Returning) can apply again.
  - `sendOffer` rechecks places to offer at the moment of sending (`no-seat`). Only after the offer is recorded does
    it move the applicant to Offer sent and the entry to `offered`, in the same save.
  - A failed send changes nothing, and Retry works. An offer never creates a child record: the entry becomes
    `enrolled` only when S14 completes the enrolment (`completeEnquiryEnrolment`).
- **Remove from waitlist** needs a reason ("Other" needs details). It keeps the record, records who removed the child,
  when and from which position, and moves the children below up one place.
- **Vacancy suggestions** (`processWaitlist`, run by the app's background ticker every second):
  - When a class has a place to offer and children waiting, the Directors and the first child's admissions owner get
    one notification: "A place is available in [class]. Review the next waitlisted child: [name] (number N…)". It
    opens the waitlist at that child. Nothing is sent to the family automatically.
  - Each vacancy is remembered in `nexora-waitlist-vacancies:<school>` until it closes, so refreshing never repeats
    it.
  - If the first child changes, the old suggestion is marked resolved and a new one is sent.
  - Withdrawals, transfers and capacity changes are picked up on the next tick.

## States

Loading (skeleton) · load error with Try again (`?fail=1`) · no classes · empty waitlist · no results · no places to
offer · places to offer · capacity not set · over capacity · reorder confirmation, reason errors and failure
(`?wlfail=reorder`) · removal confirmation, success and failure (`?wlfail=remove`) · offer edit, preview, sending,
success and failure (`?sendfail=1`) · access denied for other roles (Teacher, Accountant).

## Backend gaps

| Needed | Why |
| --- | --- |
| Server-side transaction for reorder, remove and offer, with a version or `order` check | The stale-order and seat checks protect one browser only. Two staff on different devices could still both act on the same seat. |
| Seat reservation enforced on the server when an offer is committed | `no-seat` is checked in the browser at send time. A server must recheck capacity atomically. |
| Immutable audit storage | The audit log and entry history are kept in localStorage, so they can be edited or cleared. This is not a tamper-proof audit trail. |
| Email delivery for offers | Offers are recorded as demo sends, "not delivered", as in S07. |
| Server-side vacancy job | Suggestions run in the open browser tab. With no tab open, nobody is notified. |
| Server-side permissions | Roles are checked in the browser. |

## Language

Like the other app modules, this page is in English only. Approved Tamil and Arabic strings exist only for sign-in and
the homepage (`i18n.js`). The waitlist wasn't machine-translated, so Tamil and Arabic for it still need approved
translations.
