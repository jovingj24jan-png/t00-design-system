# Learning Observations (S25)

**Route:** `app.html?page=observations`, the existing Observations module, now built.
- `&obs=<id>` highlights one observation.
- `&new=1` opens the composer.

**Who:** Teacher, Director, Admin and Super Admin, on every plan.

**Code:** `observations.js`, the "Learning observations" section of `store.js`, the `.ob-*` styles in `styles.css`, and
the Learning & Portfolio tab in `profile.js`.

## One canonical record

`nexora-observations:<school>` holds one record per observation:

| Field | What it holds |
| --- | --- |
| `id`, `schoolId` | Stable observation ID and the school. |
| `authorId`, `authorName` | Who wrote it. |
| `createdAt`, `updatedAt`, `publishedAt` | Timestamps. |
| `status` | `draft` or `published`. |
| `note` | The text, with line breaks kept. |
| `photoIds[]` | Attached photos. |
| `childIds[]` | Tagged children. |
| `frameworkId`, `frameworkVersion` | The framework it was written against. |
| `outcomeRefs[]` | Each `{ itemId, type: outcome or milestone, frameworkId, frameworkVersion, name, code }`. |
| `sharedChildIds[]`, `sharedAt`, `sharedBy` | Which tagged children's families it's shared with. |
| `clientId` | Makes a repeated save return the first one. |
| `deletedAt`, `deletedBy` | Soft delete. |
| `history[]` | Every change. |

- **One record, many children and outcomes.** A single observation lists several children and several outcomes. Every
  child's portfolio, and every milestone, reads this same record. Nothing is copied per child.
- **Stable IDs.** Editing keeps the ID. A repeated create or publish (double click, retry) returns the first save
  instead of making a duplicate.
- **Names are fallback labels only.** The `name`/`code` saved on each outcome link is used only if that framework item
  is ever removed. Displays use the live item, so renames show everywhere.
- **Photos** (`nexora-observation-photos:<school>`) are downscaled on the device to JPEG with the longest side at
  1280px, and must be under 1 MB — the same rules as the Daily Diary. They're stored as soon as they're picked, so a
  failed save can be retried without picking them again. Photos no observation uses are tidied after a day. This is
  device storage only; production needs private object storage.

## Rules

- **Who sees what:**
  - Staff see observations about children in their classes, and their own.
  - Drafts are visible only to their author and school leaders.
  - Drafts never appear in portfolios or as evidence.
- **Publishing needs:**
  - at least one child;
  - a note;
  - outcome links that are valid for new observations — visible items of the active framework. A draft started under
    another framework, or with a since-hidden outcome, is explained and blocked until you remove those links. Nothing
    is replaced automatically.
- **Links on published records are kept.** If an item is later hidden, or the framework changes, the link stays as
  history, shown with its original framework name and version.
- **Edit, delete and share:** the author, or the Director (and Super Admin) of this school. The store enforces this as
  well as the UI.
  - When a Director edits someone else's observation, the change is recorded in its history.
  - Admin can view only.
- **Delete is a soft delete.** The record and its history are kept. It leaves the feed, every portfolio, and milestone
  evidence. Families stop seeing it.
- **Framework deletion is blocked.** A framework item used by any observation (draft or published) can't be deleted —
  the Learning Framework offers "Hide instead".
- **Audit log:** `observation:create`, `observation:publish`, `observation:edit`, `observation:delete` and
  `observation:share`. Adding or removing outcome links is recorded in the observation's own history.
- **No notifications are sent.** No product rule needs one.

## S28 portfolio and S27 milestones

- **Portfolio:** the child profile's **Learning & Portfolio** tab lists the child's published observations. Each shows
  the note, photos, author and time, the outcome chips, and whether it's shared with **this** child's family.
- **Milestone evidence:** a published observation counts as evidence for a milestone when it links that milestone, or
  an outcome in the same sub-area of the same framework.
  - Recorded milestones show how many observations support them.
  - Milestones with evidence but no record appear under "Evidence, not yet recorded".
  - **Linking evidence never marks a milestone achieved.** The teacher still uses *Record milestone*.
- **Presentation records** (*Record presentation*: Introduced / Practising / Mastered) are a separate, older record of
  Montessori lessons. They keep their own outcome tags.

## Family sharing

- **Per child.** You share a published observation with the families of some or all of the tagged children.
- **What a family sees** (`familyObservations(childId)`):
  - the note, the outcomes and the time — and only for their own child;
  - never the other tagged children;
  - photos only when **every** tagged child has *Photos in the parent gallery* consent. Otherwise families see the note
    and outcomes only.
- **Multi-child warning.** The share dialog asks you to check that the note doesn't name another child, because the
  note is shown as written.
- **Recorded, not delivered.** Sharing is recorded and the card's indicator shows it, e.g. "Shared · 1/2". No parent
  app or delivery exists in this prototype, so no family receives or opens anything. The UI never claims they did.

## Phones (camera first)

- **Camera button.** Below 768px a 56px camera button sits bottom-right. It is a `<label>` for
  `<input type="file" accept="image/*" capture="environment">`, so one tap opens the device camera or photo picker
  directly.
- **After a photo:** the composer opens with it attached. *Add photos* inside the composer has no `capture`, so photos
  can also come from the gallery.
- **Cancel or failure:** if you cancel the picker, nothing happens. If the photo can't be read or stored, the composer
  opens with the reason and nothing attached.
- **Filters** move into a drawer. The feed has bottom padding so the button never covers the last card.

## AI suggestions — not available

No AI service is connected to this project. `store.observationAssist()` is the integration point and returns
`unavailable`. No UI suggests anything, and no data is sent anywhere.

A future integration must:
- show suggestions separately from the note;
- need explicit acceptance of each suggestion;
- never auto-save, auto-publish, tag children or replace the note;
- never send photos or identifiable child data without an authorised, privacy-reviewed service.

## Test hooks

- `?fail=1` — the feed fails to load.
- `?obfail=photo|draft|publish|delete|share` — the next operation of that kind fails once.
