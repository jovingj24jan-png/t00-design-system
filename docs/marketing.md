# Marketing & Referrals

**Route:** `app.html?page=marketing` (optional `&period=30|90|365|all`, `&referral=<id>` to highlight a referral).
**Who:** Director, Admin, Super Admin, on the Growth plan or higher (the same guard as every module: sign-in →
role → plan). **Code:** `marketing.js` (page), the "Marketing & Referrals" section of `store.js`, `.mk-*` in `styles.css`.

## What the page answers

| Section | Source of truth |
| --- | --- |
| Enquiries by source (bar chart) | S06 enquiry records, `source` field |
| Conversion by source (table) | S06 enquiries + tour bookings + completed S14 enrolments |
| Campaigns | `nexora-campaigns:<school>` + `campaignId` on each enquiry |
| Family Referrals | `nexora-referrals:<school>`, linked to families (S15) and enquiries (S06/S07) |

Nothing is cached: every number is recomputed from the stored records whenever the page draws, and the page redraws
when enquiries, tours, families, campaigns or referrals change (in this tab or another).

## Metric definitions

- **Period** — enquiries *received* in the period (by created date, school's local day). It applies to the source
  analytics only; campaigns and referral rewards are always shown in full.
- **Enquiries** — those enquiries, by the source on the enquiry. Unknown sources count as Other.
- **Tours** — of those, enquiries that booked a tour at any point (reached the *Tour booked* stage, or have a tour
  booking that wasn't cancelled). Counted once per enquiry.
- **Enrolled** — of those, enquiries whose stage is *Enrolled*. Only `completeEnquiryEnrolment()` (called by S14
  after the child is saved) sets that; *Offer sent* is not an enrolment.
- **Conversion** — enrolled ÷ enquiries × 100. Shows "—" when there are no enquiries (never NaN).

Clicking a bar selects it and shows its tours and enrolments, with a link to S06 filtered by that source
(`admissions&view=list&source=<key>`). Bars are buttons, so this works with a keyboard and on touch.

## Campaigns and attribution

- A campaign has a stable ID (`cmp-…`), name, start/end dates, a unique **source tag** and notes. Status
  (Scheduled / Active / Completed) is derived from the saved dates. There's no draft state and nothing is sent to
  families — no email or ad integration exists.
- An enquiry belongs to a campaign only through its `campaignId`. It is set:
  - in the S06 *Add enquiry* form or S07 *Edit family details* (Campaign select), or
  - from a tagged link: `index.html?campaign=<tag>#visit` (homepage visit form) or `form.html?f=<id>&campaign=<tag>`
    (published application form). An unknown tag attributes nothing.
- **First touch:** a repeat submission matched to an existing enquiry doesn't change its campaign. Dates never
  attribute anything on their own, and the enquiry's original `source` (e.g. *Website form*) is never overwritten.
- Tags are unique, so one enquiry can't count towards two campaigns. Editing a tag doesn't move enquiries already
  attributed (they're linked by ID). Campaign changes on an enquiry are written to its S07 timeline.
- S06 accepts `&campaign=<id>` to list a campaign's enquiries (shown as a chip; *Reset filters* clears it).

## Referrals and rewards

Record: `{ id, familyId, enquiryId, reward, notes, status: pending|earned|given, createdAt/By, earnedAt,
earnedTrigger: { enquiryId, childId, eventId }, givenAt/By, creditNoteId, notify, history[] }`.

- **Add referral** links an existing family to an existing enquiry. Nothing else is created. Blocked: a family
  referring its own child, and the same family + enquiry twice. A second family referring the same child needs an
  explicit confirmation (each would earn a reward).
- The reward is a free-text description. No amount is calculated.
- **Pending → Earned** happens inside `completeEnquiryEnrolment()`, in the same `commit()` as the Enrolled stage.
  If that write fails, neither changes. Repeating the call is a no-op, and Earned/Given never go back to Pending.
  A referral recorded after its child had already enrolled is earned from that recorded enrolment, and its history
  says so.
- **Retry path:** if a referral is Pending while its child is Enrolled, a banner offers *Update rewards*
  (`reconcileReferrals`).
- **Notification:** one per Director/Admin/Super Admin who can open the module (respecting muted modules), with
  dedupe key `referral-earned:<id>`, linking to the referral. If creating it fails, the row says so and offers
  *Retry notification*. The reward itself is already recorded. No email or push is sent.
- **Mark as given:** only from Earned, after a confirmation. Records the time and the administrator, writes the
  history and the audit log. A Pending reward can't be marked Given.
- S14 shows "Referral reward earned: …" in its success message when an enrolment earns one.

## S38 Billing / credit notes — not available

The project has fee invoices and payments (`fees`, family statements) but **no credit-note service**, so no credit
note is created. The *Mark as given* dialog says so. `creditNoteId` stays `null` and `referralBilling()` reports
`available: false`. When a real S38 service exists, add an optional, permission-checked step after *Mark as given*.
Key it on the referral ID (to prevent duplicates), and store the returned ID in `creditNoteId`.

## Audit actions

`create:campaign`, `edit:campaign`, `create:referral`, `earn:referral`, `give:referral` (in `nexora-audit:<school>`).

## Test hooks

`?fail=1` (load error) · `?mkfail=campaign|referral|given|notify|reconcile` (the next such save fails once).

## Limits (prototype)

All data is in this browser's localStorage. Single-tab writes are atomic through `commit()`, but nothing protects
two staff saving at once. A server must:

- do the enrolment and reward update in one transaction;
- enforce tag uniqueness and duplicate referrals;
- make notifications idempotent on `referral-earned:<id>`.
