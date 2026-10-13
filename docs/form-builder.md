# Form Builder — `app.html?page=form-builder[&edit=<id>]` · public form `form.html?f=<id>`

Code: `formbuilder.js` (list and builder), `formkit.js` (shared form renderer and signature pad), `formpublic.js` and
`form.html` (public page), plus the Form Builder section of `store.js`.

- **Who:** Director, Admin and Super Admin, on the Growth plan or above (like Admissions).
- **Not the same as family forms:** permission slips, surveys and acknowledgements for enrolled families stay in
  **Forms & Permissions** (`forms.js`). The two are linked from each other's pages.

> **Prototype.** Forms, submissions, uploads and signatures are stored in this browser's localStorage.
> - A published link only opens in the browser where the form was created. On any other device it shows "This form
>   isn't available". Nothing is sent to a server.
> - Signatures are drawn or typed images with a timestamp. They are **not** verified or legally certified e-signatures.

## Data

| Record | Key | Notes |
| --- | --- | --- |
| Forms | `nexora-builder-forms:<school>` | `{ id, name, description, type application/consent/custom, submitLabel, status draft/live, fields[] (working copy), version, published { version, name, description, type, submitLabel, fields, at, by }, createdAt, createdBy, updatedAt, publishedAt }` |
| Field | inside the form | `{ id, type, label, help, placeholder, required, defaultValue, mapTo, options[{id,label}], minSelect, maxLength, dateRule any/past/future, minDate, maxDate, accept, maxKB, statement, requireAccept }` |
| Submissions | `nexora-builder-submissions:<school>` | `{ id, formId, formName, formType, version, answers{fieldId: value}, snapshot[{id,type,label,value,statement,mapTo}], mapped{mapKey: value}, consents[{fieldId, statement, version, accepted, at}], clientId, submittedAt, enquiryId, outcome }` |
| Files | `nexora-builder-files:<school>` | Uploads and signature PNGs, 1 MB or less, checked by content. Linked to their submission once it's saved. |

- **Field ids** are stable: `newId('bf')`, never the position. A duplicate gets a new id; moving or renaming keeps it.
- **Option ids** work the same way.
- **Section headers** are layout only and never store an answer.
- **The working copy and the published version are separate.**
  - Staff edit `fields`; respondents only ever load `published` (`publicBuilderForm`).
  - Editing a live form shows **Unpublished changes** until **Publish changes** makes a new version.
  - Each submission keeps the version, labels and consent text the respondent saw.

## Field types and validation

`validateBuilderAnswers(fields, answers)` drives the builder preview, the public page and the store, so all three
apply the same rules.

| Type | Answer | Rules |
| --- | --- | --- |
| Section header | — | Layout only. |
| Text / Long text | string | Required; maximum length (default 200 / 2000). |
| Email | string | `name@example.com` format. |
| Phone | string, kept exactly as typed | Digits 7–15, with an optional `+`, spaces, brackets and dashes. |
| Date | `YYYY-MM-DD` | Any, today or earlier, or today or later; optional earliest and latest dates. Mapped start date: within 2 years. Mapped date of birth: within 10 years. |
| Dropdown | option id | Must be one of the options; at least two distinct, non-empty options to publish. |
| Multi-select | option ids | At least *n* chosen (`minSelect`) when required, or whenever answered. |
| Checkbox | `true` | Required means it must be ticked. |
| File upload | file ids | Images (JPEG, PNG, WebP) and/or PDF, 250 KB to 1 MB, checked by content. In preview, files aren't uploaded. |
| Signature | `{ fileId }` | Drawn or typed; saved as a PNG only when the form is submitted. |
| Consent statement | `true` | The statement, plus an "I agree" box when acceptance is required. The text and form version are stored with each response. |

## Profile mapping (`BF_MAP`, stable keys)

| Key | Fills (S06 enquiry → S14) | Allowed field types |
| --- | --- | --- |
| `child.name` | `child` | Text |
| `child.dob` | `dob` | Date |
| `child.gender` | `gender` → S14 child gender | Dropdown (options fixed to the school's gender list) |
| `child.programme` | `programme` | Dropdown (options fixed to the class levels) |
| `child.start` | `preferredStart` | Date |
| `child.previousSchool` | `previousSchool` | Text |
| `child.notes` | `childNotes` | Text, Long text |
| `guardian.name` | `parent` | Text |
| `guardian.email` | `email` | Email |
| `guardian.phone` | `phone` | Phone |
| `guardian.language` | `language` | Text, Dropdown |
| `family.address` | `address` | Text, Long text |

- **One field per destination**, and the destination must match the field type.
- **Application forms** must map child name, guardian name, guardian phone, programme and preferred start, and those
  fields must be required. This is what S06 needs to create an enquiry.
- **Consent and custom forms** can be mapped, but they never create enquiries.

## Publishing and links

- **Publish** checks the configuration with `builderFormIssues`: name, labels, options, statements, date ranges,
  mapping compatibility and application requirements.
  - Problems are shown per field and the form stays a Draft (or keeps its previous published version).
  - If all is well, a confirmation step follows. The form becomes **Live** only after the write succeeds.
  - The success step shows the link with **Copy link**, **Preview live form** and **Done**.
- **Link:** `form.html?f=<id>`, resolved against the current page, so it works under the GitHub Pages project path.
- **Copy link:** uses `navigator.clipboard.writeText`. The **"Link copied"** toast appears only after the copy
  succeeds. If the browser refuses, a dialog shows the link selected for manual copying.

## Public submission → S06 / S07 / S14

- **Saving a submission:** `submitBuilderForm(formId, answers, { clientId })`.
  - It loads only the published version and re-validates every answer.
  - Uploaded files must belong to this form and field.
  - A repeated `clientId` (double click or retry) is saved once.
- **Application forms → new enquiry (S06):** source **Website form** (`webform`), stage Enquiry, created by
  "Website form". It goes through the normal enquiry rules: owner, follow-up, notification, duplicate checks.
  - `e.formSubmissions[]` records the form, version, submission and time. A timeline event is added. Gender, when
    mapped, is stored for S14.
- **Same child already in S06:** no new enquiry, and **nothing is overwritten**. The submission is linked to the
  existing enquiry, the timeline lists which details differ, and the owner is notified. The respondent sees the same
  thank-you, so the form never reveals who is already known.
- **Same child already enrolled (family record):** no enquiry is created. The admissions team is notified to check the
  family.
- **Siblings:** a family phone or email matched with a new child creates an enquiry linked to that family.
- **S07:** the source shows "Website form · *form name*, *date*". A **Website form** card lists every submission with
  the original answers, consent text and mapped destinations, kept even if the form changes later.
- **S14:** the existing conversion prefills the child (name, date of birth, gender), guardian, class and start date.
  - If the enquiry is linked to an existing family whose record differs (email, phone or guardian name), the family
    record is kept and a warning asks staff to resolve it in step 2.
  - No duplicate child or family is created; S14's own checks still apply.

## Responsive

- **Desktop (1024px and wider):** three panels (Add fields · Form content · Field settings).
- **Tablet (768–1023px):** palette and canvas, with Field settings as a drawer (Escape closes it).
- **Mobile (under 768px):** the forms list, Preview and Copy link only, with the message *"Form editing is available
  on tablet and desktop. You can still preview and share your forms here."* The public form is mobile-first.

## States and test hooks

- **States covered:** loading, error (`?fail=1`), empty list, no results, empty canvas, no field selected, saving,
  saved, unsaved changes, save failure with Retry (`?savefail=1`), invalid configuration, unpublished changes,
  publish confirmation, success and failure (`?pubfail=1`), copy success and clipboard failure (`?clipfail=1`).
- **Preview:** empty, errors, success (nothing saved).
- **Public page:** submitting, success, failure with retry (`form.html?…&fail=1`), unavailable or unpublished form.

## Backend gaps

| Needed | Why |
| --- | --- |
| Public form endpoint + server-side validation | Submissions are validated in this browser only. Client-side checks are not a security boundary. |
| Tenant isolation and permissions on the server | Only published forms should be readable without sign-in; drafts and other schools' forms must never be returned. |
| Spam protection, rate limiting and idempotency keys on the server | `clientId` deduplication works only within one browser. |
| Access-controlled file storage | Uploads and signatures are data URLs in localStorage. |
| Identity verification and audit trail for signatures and consent | Needed before relying on them legally. |
| Email confirmation to respondents | Not connected. |
