# Forms, Permissions & Acknowledgements — `app.html?page=forms` (`forms.js`)

Views: list (default) · `?edit=<id>` or `?edit=new` (builder, 768px and wider) · `?results=<id>&tab=overview|questions|responses`
· `?respond=<id>&family=<familyId>` (demo parent view). Sidebar: **Forms & Permissions** (Teacher, Director, Admin,
Super Admin).

> **Prototype.** Forms, responses, uploads and signature images live in this browser's localStorage and are checked in
> the store layer only. Families have no login, so responses are entered in the labelled **demo parent view**.
> Signatures are drawn or typed images with the guardian's name and a timestamp. They are **not** a verified or legally
> certified e-signature. Don't use this to collect real consent.

## Data

| Record | Key | Notes |
| --- | --- | --- |
| Forms | `nexora-forms:<school>` | `{ title, description, intro, type, questions[], status draft/open/closed, version, audienceSpec, audience, respondent any/primary, requireSignature, dueAt, recipients[], reminders[], publishedAt, closedAt, reopenedAt, createdBy… }` |
| Questions | inside the form | `{ id, type, label, help, required, options[{id,label}], scale{low,high}, accept['image','pdf'], maxKB, statement, logic{ join all/any, rules[{q, op, value}] } }` |
| Recipients | inside the form | one per family: `{ familyId, name, children, classes, guardianIds, delivery, reminders[], removed }`. Eligibility and reminders are tracked separately from responses. |
| Responses | `nexora-form-responses:<school>` | one per family: `{ formId, version, familyId, guardianId, guardianName, children, answers{qid: value}, signatures{qid:{fileId,name,at}}, submittedAt, demo }` |
| Files | `nexora-form-files:<school>` | uploads and signature PNGs, 1 MB or less, checked by content. Visible only to people who can see that response. |

Three demo samples are seeded and labelled **Demo sample**: an open permission slip with some signed responses, a
closed survey with results, and a draft acknowledgement.

## Rules (store)

- **Who:**
  - **Leaders** can create, publish and manage any form, and address all families.
  - **Teachers** can build forms for their own classes; they manage forms they created.
  - **Class staff** see published forms that reach their classes, read-only and limited to their families.
  - **Drafts** are visible only to leaders and the creator.
- **Builder:** autosaves 600 ms after each change and shows *Saving… / Saved / Save failed (Retry)*. "Saved" appears only
  after the store write succeeds. Only drafts can be edited, deleted or saved; published questions are locked (version 1).
  Duplicate a form to change it.
- **Conditional logic ("Show if"):**
  - **Sources:** a rule may only use a question above it, so self-reference and cycles are impossible.
  - **Operators by source type:**
    - Yes/No and single choice: is / is not.
    - Multiple choice: includes / doesn't include.
    - Rating: is / at least / at most.
    - Other types: answered / not answered.
  - **Matching:** all (AND) or any (OR).
  - **Hidden sources:** a rule whose source question is hidden counts as false.
  - **Same code everywhere:** `visibleFormQuestions()` drives the preview, the parent view and the store's validation.
- **Hidden questions:** never block submission. Their answers stay in the in-progress draft but are **dropped on submit**,
  so only what the family was shown is stored.
- **Publish:** the title, every question label, at least two distinct options per choice question, valid rules, an
  audience with at least one eligible family, and a due date at least an hour away are all required.
  - **Audience:** all families (leaders only), classes, or individual families. One recipient per family, so a family
    with children in two selected classes counts once. Families with no guardian on record are left out and the UI says
    so.
  - **Who responds:** any guardian, or the primary guardian only.
  - **Signature:** *Require a guardian signature* adds a required signature question if the form has none.
  - **Delivery:** recorded per family as `queued (demo — not delivered)` or `skipped: no parent-app account`.
- **Submit (store):** the form must be open and not past due. The family must be eligible and not removed, the guardian
  must be one of the allowed guardians, and there must be no earlier response from that family (duplicates are
  refused). Visible required questions are checked, as is each type: dates, 1–5 ratings, option ids, and files and
  signatures uploaded for this form and question. The form creator gets a notification.
- **Response rate** = unique submitted responses from current recipients ÷ current recipients, rounded; 0 when there
  are none. Signature completion is worked out the same way.
- **Remind non-responders:** only open, not-past-due forms. It targets eligible families without a response; anyone
  reminded in the last 10 minutes is skipped.
- **Close:** stops new responses; responses, files, signatures, results and export are kept.
- **Reopen / Extend due date:** for closed or past-due forms. It needs a new due date and re-checks the audience:
  families no longer eligible are marked removed (their responses are kept but not counted) and newly eligible ones are
  added. A past due date is enforced in the store, not only by hiding buttons.

## CSV export

One row per submitted response the user may see.

- **Columns:** Form, Version, Family, Guardian, Children, Submitted at, one column per question (`Q1. label`), then
  Signature status and Signed at.
- **Values:** multiple choice is joined with `; `. Files are listed by name and signatures by status only, never as
  binary data.
- **Escaping:** cells are quoted, and text starting with `= + - @`, a tab or a CR gets a leading `'` so spreadsheets
  can't run it as a formula.
- **File:** `<type>-form-responses-YYYY-MM-DD.csv`, UTF-8 with BOM.

## Backend gaps

| Needed | Why |
| --- | --- |
| Parent app / guardian login, notifications | Families can't receive or answer forms yet; the demo parent view stands in. |
| Server-side access control, tenant isolation, due-date enforcement | Everything is enforced in the browser today. |
| Access-controlled file storage | Uploads and signatures are device-local data URLs. |
| Identity verification + audit trail for signatures | Needed before a signature can be relied on as consent. |

Test hooks: `?fail=1` (list load error), `?savefail=1` (first builder save fails).
