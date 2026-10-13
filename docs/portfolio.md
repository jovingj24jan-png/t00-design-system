# Child Learning Portfolio (S28)

**Route:** `app.html?page=portfolio`. It appears in the sidebar and on the homepage page map, and the child profile's
Learning & Portfolio tab has "Open learning portfolio".

URL options (each is optional):
- `&child=<id>` — open that child's portfolio.
- `&term=year` — the academic year only.
- `&area=<area name>` — one area.

**Who:**
- **View:** class staff (Teacher, Director, Admin, Super Admin), for children in their own classes only, on every plan.
- **Curate** (add evidence, pin, set visibility): staff who can edit the child's learning section.
- **Observation sharing:** follows S25 — the author or the Director.

**Code:** `portfolio.js`, the "Child Learning Portfolio" section of `store.js`, the `.pf-*` and `.pfp-*` styles in
`styles.css`.

## Where items come from

`store.portfolioItems(user, childId)` is a read-only adapter over the canonical records. Item keys are source IDs, so
nothing is generated per render and nothing is copied.

| Key | Source | Date used | Area |
| --- | --- | --- | --- |
| `obs:<id>` | S25 published observation that tags the child (the same record for every tagged child) | published date | areas of its linked outcomes; Uncategorised if none |
| `pge:<id>` | S26 progress event (each state change) | event date | the material's framework area |
| `mse:<id>` | S27 assessment event (status changes and re-assessments; evidence-link events are left out) | assessment date | the milestone's framework area |
| `ln:<id>` | Presentation record (child profile) | entry date | its learning area |
| `ev:<id>` | Portfolio work sample (below) | date of the work | chosen area, or Uncategorised |

- **Order:** newest first by event date, then source time, then key. The export runs oldest first.
- **Live updates:** edits in any source module show here at once (the page listens to the store's change events), so
  there are no duplicates.
- **Assessment labels:** items read "Assessed Secure (was Developing)" and so on. "Milestone recorded as achieved" is
  used only for records the earlier Record-milestone workflow explicitly marked as achieved.
- **Counting:** each item counts once, under its **first** area (an observation's first linked outcome). Its other areas
  still show as chips, and the area filter matches any of them.
- **Terms:** the school only defines an academic year (Settings → Academic year). That is the one term offered. Without
  it, the Term filter offers "All dates" and says why.

## Work samples (Add evidence)

`nexora-portfolio-evidence:<school>` holds one record per sample:
`{ caption, description, fileIds[], area, date, linkObservationId, linkMaterialId, linkMilestoneId, familyVisible,
createdBy/At, updatedAt, clientId, history }`.

- **Files:** JPEG, PNG, WebP or PDF, up to 1 MB each and up to 4 per sample.
  - Images are resized on the device (longest side 1600px, JPEG). PDFs are kept as they are.
  - Files are stored in `nexora-portfolio-files:<school>` as soon as they're chosen, so a failed save can be retried
    without choosing them again. Unused files are tidied after a day.
- **Validation:** a caption, at least one file, and a date that isn't in the future or before birth. Links are checked
  too: the observation must be one of this child's published observations, and the material or milestone must be in
  the framework.
- **Saving:** the record is written only after all of that passes, and a repeated submit returns the first save. A
  failed save keeps the files and fields.
- **Storage:** files live only in this browser (device storage). There's no upload to a server and no sharing across
  devices.

## Pins

- **Scope:** `nexora-portfolio-prefs:<school>[childId].pins`, shared per child — they aren't private to one user.
- **Display:** pinned items show in **Pinned moments**, in date order, and leave the timeline so nothing appears twice.
- **Effect:** pinning never changes a source record or its date.

## Family visibility (most restrictive wins)

| Item | Where visibility lives |
| --- | --- |
| Observation | The S25 record's own per-child sharing. The toggle calls `shareObservation`; only the author or Director can change it, and other staff see it disabled with the reason. For a group observation the toggle asks first: the family sees the note and outcomes, never the other children's names, and photos only when every child in it has photo consent. |
| Progress, assessment, presentation | `prefs[childId].visible[key]` (who and when), because those modules have no sharing of their own. |
| Work sample | Its own `familyVisible`. Images also need the child's photo consent. |

- **Saving:** the toggle shows "Saving…", changes only after the save succeeds, and shows a message if it fails.
- **Family data:** `store.familyPortfolio(childId)` is the family data layer. It returns only effective-visible items,
  strips other children and withheld photos, and is what the "Family view" lens and the family export use.
- **No parent app.** There's no parent app or family sign-in in this project, so no family can open the portfolio
  yet. The UI says so.

## Summary, last updated

- **Counts** come from the displayed items: per area (by primary area, plus Uncategorised), with totals for items,
  visible-to-family and pinned. Clicking a bar applies that area filter.
- **Last updated** is the latest saved time among the items plus pin and visibility changes. With none, it reads "No
  updates recorded".

## Export / Print

- **Two modes:**
  - **For the family** (default) — only effective-visible items, as `familyPortfolio` would show them.
  - **Staff copy** — everything the user can see, marked "Staff only — not for families".
- **Content:** a cover (child photo — initials if there's no photo consent in family mode — name, class, term, "My
  Learning Journey", export date), then the items oldest first. Each item shows date, area, type, caption, text, image
  or PDF note, and the progress or assessment detail. The current term and area filters apply.
- **How it prints:** the print layout is a separate container shown with `body.is-printing-portfolio` and `@media
  print`, so the shell, sidebar, toolbar, buttons and dialogs are hidden. Pages break after the cover and items aren't
  split across pages. "Save as PDF" in the browser's print dialog produces the PDF; no PDF library is used.

## Responsive

| Width | Behaviour |
| --- | --- |
| ≥1024px | Card grid plus the side summary. |
| 768–1023px | The summary moves above the grid. |
| <768px | One column with full-width images. Add evidence is a full-screen sheet. |

## Test hooks

- `?fail=1` — load error.
- `?pffail=file|save|pin|visibility` — that operation fails once.

## Limits

- **Storage:** all data, files included, is in this browser's storage. There's no server, no cross-device sync, and no
  server-side enforcement — permissions and privacy are enforced in `store.js` only.
- **No family-facing route.** The family data layer exists, but nothing serves it to families yet.
- **Terms:** only the academic year exists; there are no per-term dates.
