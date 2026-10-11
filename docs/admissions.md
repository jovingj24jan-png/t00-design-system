# Admissions Pipeline — `app.html?page=admissions` (`admissions.js`)

Pipeline: `?view=kanban|list`, plus `?stage=<stage>` (mobile stage). **S07 applicant details:**
`?page=admissions&applicant=<enquiryId>`. **S14 enrolment from an enquiry:** `?page=enrol&enquiry=<enquiryId>`.

The module needs the **Growth** plan; on Starter the existing plan lock is shown. It replaces the old Admissions list in
`modules.js` and keeps the same data and the dashboard widgets.

> There was no S07 page in the project before this module, so S07 is now this applicant view inside Admissions. All
> data is in this browser's localStorage and every rule runs in `store.js`. A production backend would need to enforce
> duplicate checks and stage changes atomically (see below).

## Data — `nexora-admission-enquiries:<school>` (the existing key, extended)

```
{ id, child, dob, parent, phone, phoneNorm, email, emailNorm, programme (class level), preferredStart, source, notes,
  ownerId, stage: enquiry|tour|applied|offer|enrolled|lost, stageAt, tourAt, followUp,
  lost: { reason, detail, at, by }, familyId, childId, createdAt, createdBy, createdById, updatedAt, clientId,
  history: [{ id, at, by, byId, type, from, to, detail }],   // append-only timeline
  status }                                                    // legacy mirror for the dashboard widgets
```

Older status-based records migrate once: new or contacted → Enquiry, visit → Tour booked, enrolled → Enrolled,
closed → Lost (reason Other). Eleven demo samples are seeded across every stage, including older ones so the
conversion rate has history.

## Rules (store)

- **Add enquiry** (`createEnquiry`):
  - **Required:** guardian, phone (7–15 digits, optional `+`, no country-specific format), child, programme, and a
    preferred start (not in the past, at most two years ahead).
  - **Checked:** email format, date of birth (not in the future, under 10 years ago), owner (must have admissions
    access).
  - **Retries:** a repeated `clientId` returns the first record instead of creating another.
- **Duplicates:** phones (digits only, last 10) and emails (trimmed, lower case) are normalised and compared with other
  enquiries **and** existing family guardians.
  - **Same child name at the same contact:** always blocked; the form links to *Open existing enquiry* (or the family).
  - **A different child at a known contact** (a sibling): needs the "This is a different child" confirmation. The new
    enquiry is then linked to the existing family.
- **Owner notification:** in-app, "New enquiry: [child] — [programme]", sent to the owner with the reference; opening it
  goes to S07. No email or SMS is sent.
- **Stage moves** (`moveEnquiry`): each move resets `stageAt` and appends a timeline event with from, to, time and user.
  - **Stale moves:** a move carries the stage the user saw; if the record has changed since, it's refused rather than
    overwritten.
  - **Lost:** needs a reason (Chose another school / Fees / Location / No response / Other, plus text for Other).
    Reopening keeps the Lost event.
  - **Tour booked:** asks for an optional tour time.
  - **Enrolled:** can't be set by moving — see below.
- **S14:** "Continue to enrolment" first checks that there is a date of birth and a first and last name. It records
  "Enrolment started" without changing the stage, then opens the real S14 wizard prefilled with names, date of birth,
  guardian contact, a class matching the programme, and the start date.
  - **Becoming Enrolled:** only when S14 saves the child does `completeEnquiryEnrolment` mark the enquiry Enrolled and
    link `childId` and `familyId`. This is safe to call twice.
  - **No duplicate records:** S14 keeps its own duplicate-child check, and staff link an existing family in its step 2.
- **Follow-ups:** set or clear them from S07, the pipeline or the List view. Each change is in the timeline, and overdue
  ones are flagged. No automatic reminders are sent (there's no reminder service).
- **Days in stage:** days since `stageAt`. 7–13 days shows amber "check in"; 14 or more shows red "overdue" (text as
  well as colour). Enrolled and Lost stay neutral.
- **Age at preferred start:** from the date of birth to the preferred start date (not today), e.g. `2y 8m`. Shows
  "Age unknown" without a date of birth.

## KPIs (`admissionsKpis`) — all from stored records

| KPI | Definition |
| --- | --- |
| New this week | Created Monday–Sunday this week (device local time). |
| Tours booked | In Tour booked with a tour date/time still to come (undated tours shown separately). |
| Applications / Offers out | Currently in Applied / Offer sent. |
| Conversion rate | Of enquiries created 30–365 days ago (a mature cohort), the share now Enrolled. Shows "—" until the cohort has 5. |
| Expected starts | Offer sent or Enrolled with a start date from today to the same day three months ahead. |

They're recalculated on every change through the store's change events.

## Backend gaps

| Needed | Why |
| --- | --- |
| Server-side duplicate check + unique constraints on normalised contact | Two staff on different devices could create the same family at once. |
| Versioned/conditional stage updates | The `from`/`updatedAt` checks here only protect one browser. |
| Email/SMS reminders, web enquiry form | Not connected; follow-ups are in-app only. |
| Server-side permissions and tenant isolation | Enforced in the browser today. |

Test hook: `?fail=1` (load error with **Try again**).

## S07 Applicant details — `?page=admissions&applicant=<id>[&tab=timeline|details|documents|tasks]`

Same enquiry record as the pipeline (no separate store). Layout: header (age at preferred start, programme, start,
owner, stage) · stage tracker (Enquiry → Tour booked → Applied → Offer sent → Enrolled, plus Lost) · 60:40 grid with the
timeline on the left and Family / Child / Documents / Siblings / Follow-up cards on the right. Tablet stacks the
timeline above a two-column card grid; mobile uses four tabs (Timeline · Details · Documents · Tasks).

| Feature | Store function | Notes |
| --- | --- | --- |
| Note / call / email | `logEnquiryNote`, `logEnquiryCall`, `logEnquiryEmail` | A call with a follow-up date creates a linked task and notifies the assignee. Emails are **recorded as "not sent"** — no email service is connected. |
| Follow-up tasks | `addEnquiryTask`, `updateEnquiryTask` | Overdue = open and past its due date/time (date only = end of day). Completion, reassignment and due-date changes are logged. `processAdmissions()` (shell ticker) sends one overdue notification per task and due date. The pipeline's "next follow-up" is the earliest of the follow-up date and open tasks. |
| Documents | `uploadApplicantDocument`, `removeApplicantDocument`, `applicantFile` | Birth certificate, immunisation record, previous school report: PDF/JPEG/PNG; child photo: JPEG/PNG; ≤ 1 MB, checked by content. A row turns Uploaded only after the write succeeds. Files are device-local data URLs — not secure storage. |
| Siblings | `enquirySiblings`, `linkSibling`, `unlinkSibling` | Search existing children (debounced) and confirm. Linking connects the applicant to that child's family; a child from a different family than the one already linked is refused; never matched by name. |
| Send offer | `offerValues`, `renderOffer`, `saveOfferDraft`, `sendOffer` | Edit the starter template → preview with `{{child_name}}`, `{{start_date}}`, `{{fees}}` resolved from the record and the fee table (missing values are marked and block sending; nothing is invented) → send. With no email service the send is a **labelled demo**; only then does the stage move to Offer sent (never backwards). Drafts and failed sends don't move the stage. Moving to Offer sent from the pipeline or Move stage always goes through this workflow. |
| Convert to enrolled | `startEnquiryEnrolment` → S14 → `completeEnquiryEnrolment` | S14 opens prefilled (child, DOB, guardian contact, class, start; the linked family's households and guardians as linked records). Only when S14 saves the child does the applicant become Enrolled, linked to the child (S12) and family (S15); uploaded documents are copied to the child's Documents once. Opening S14 for an already-converted applicant shows "already enrolled" instead of a second wizard. |
| Lost | `moveEnquiry(…, 'lost', { reason, detail })` | Reason required; Other needs an explanation. Record and history are kept. |

Every action appends to the applicant's `history`; actions carry a `clientId`, so a retried save is recorded once.
Test hook: `?sendfail=1` (the first offer send fails, to check the stage doesn't change).
