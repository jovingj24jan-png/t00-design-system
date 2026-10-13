# Learning Framework (S24)

**Route:** `app.html?page=framework` (optional `&fw=<frameworkId>` to view a specific framework, `&item=<itemId>` to
select an item). **Who:** school leaders (Director, Admin, Super Admin) can edit; teachers can view. The module is on
every plan. **Code:** `framework.js` (page and shared picker), the "Learning framework" section of `store.js`, and the
`.fw-*` styles in `styles.css`.

## Data model — one framework model for the whole app

- **Frameworks** — `nexora-frameworks:<school>`. Each holds `{ id, name, version, type, description, ageBands[],
  source, rev, created/updated, items[] }`.
- **Items** — `{ id, type, parentId, order, name, code, description, ageBand, hidden, materialId, sourceId, created/updated }`.
  - `type` is `area`, `subarea`, `outcome`, `milestone` or `material`.
  - Allowed structure: area → sub-area → outcome | milestone | material. The store enforces this on add, move and
    import.
  - Materials are links to records in Rooms & Resources (`nexora-materials`, through `materialId`). They are never
    outcomes. A template material that isn't in the school's inventory is kept with `materialId: null` and shown as
    "Not in inventory".
- **Active framework** — `nexora-framework-active:<school>`.
- **IDs are stable.** Renaming, editing, reordering, moving and hiding never change an ID, so every reference survives.
  Relationships use IDs only, never names or positions.
- **Age bands** belong to each framework (`ageBands`). Items can only use their own framework's bands. Nothing is
  converted between frameworks. A merge adds any missing template bands and says so.
- **Codes** are unique within a framework and stay the same when an item is renamed.
- **Prerequisites** (`prerequisiteIds`, materials only) list materials to master first. Only other materials can be
  chosen, and loops are refused. The Progress Tracker uses them for "Ready for next presentation".

## Visibility and deletion

- **An item is unavailable for new tagging if it, or any parent, is hidden.** A parent never rewrites its children's own
  `hidden` flag, so showing the parent again restores them exactly as they were.
- **Hidden items stay in every existing record.** That covers observations, child milestones, lesson activities and
  edits to those records.
- **Delete is refused (by the store, not just the UI) while the item or anything inside it is referenced.** The dialog
  says *"This item is linked to existing observations and cannot be deleted."* (or the matching text for milestones or
  activities) and offers **Hide instead**.
- **Unreferenced items are deleted with their contents** after a confirmation.

## Where the framework is used

| Consumer | How |
| --- | --- |
| **S25 Learning Observations** (`docs/observations.md`) | Observations link outcomes and milestones by ID, with their framework and version. Published ones are milestone evidence, and they block deletion of the items they use. |
| Presentation records — child profile → Learning & Portfolio → *Record presentation* | `NexoraFramework.picker({ type: 'outcome' })`. Saves `outcomeRefs: [{ itemId, frameworkId, frameworkVersion, name, code }]` on the learning entry. Only visible outcomes of the active framework are offered. Tags already on an entry are kept when it's edited. |
| **S27 milestones** — the same tab → *Record milestone* | `nexora-child-milestones:<school>` `{ itemId, frameworkId, frameworkVersion, name, code, achievedOn, note, recordedBy }`. Only visible milestones of the active framework; one record per child and milestone. |
| **Lesson Planning** activities | `store.frameworkOutcomes()` (the existing S24 adapter), with the same picker. |

Displays always resolve the live item (`frameworkRef`), so a rename shows the new name. The saved `name`/`code` is used
only as a fallback label if an item is ever removed. Records from a framework that is no longer active show that
framework's name and version.

## Changing the active framework

- *Change framework* lists the installed frameworks. Choosing a different one shows its impact before you confirm:
  - which outcomes and milestones will be offered from now on;
  - how many existing records stay linked to the old framework;
  - whether the age bands differ.
- Nothing is remapped or deleted, and you can switch back.
- With only one framework installed, the dialog explains this instead of showing an empty list.

## P15 template library — **not part of this project**

There is no platform template library (P15) here. `store.platformTemplates()` is the integration point. It reads
`nexora-platform-templates` (platform scope, not per school), which this prototype seeds with **three clearly labelled
demo templates written for testing** (Montessori Early Childhood 2.1 and 2.2, and an outcomes-based sample). They are
not official or published frameworks, and the UI says so. Replace the adapter with the real P15 API when it exists.

- **Import as new** validates the template and adds it as a new framework.
  - Every item gets a new school ID; the template IDs are kept as `sourceId`, along with the template version.
  - The new framework is not activated, unless the school had no framework at all.
  - Importing the same template twice needs confirmation.
- **Merge into the current framework** previews every item before anything is written.
  - **Matching rules, in order:**
    1. the template ID recorded on an item (`sourceId`);
    2. same type and same code;
    3. for materials only, the same name under the same sub-area.
  - **Never matched on name alone:**
    - a same-named item with a different code is a "possible duplicate" — you choose to add it separately or skip it;
    - a code already used by a different item is a "code clash" — you choose to add it with a new code
      (e.g. `PL.3.2-2`) or skip it.
  - **Your differences are kept by default** (*Keep mine*); you can choose *Use the template's* per item.
  - **Applying:** it can't be applied until every conflict is decided. It is checked against the framework revision you
    reviewed and written in one step; a failure leaves the framework unchanged. The result shows how many items were
    added, updated, unchanged and skipped.

## Change history

Every successful change goes into the shared audit log (`logAudit`, action `framework:<kind>`), with:

- the actor and their role, and the time;
- the item ID and name;
- before and after values, the old and new parent, and the import source/version.

The *Change history* drawer lists them newest first, filtered by type, with times in the browser's timezone.

## Responsive

| Width | Behaviour |
| --- | --- |
| ≥1024px | Tree plus a details panel on the right; all editing. |
| 768–1023px | Same editing; details open in a side drawer. |
| <768px | Read-only tree with search, details in a drawer, and the *Edit on a larger screen* banner. No edit controls are shown. |

## Keyboard

In the tree:

- **Up / Down** move between items; **Right / Left** expand, collapse or go to the parent.
- **F2** renames; **Enter** saves and **Escape** cancels.
- Every row has buttons for add, rename and hide, plus a ⋯ menu with Move up, Move down, Move to… and Delete. These are
  the keyboard alternatives to dragging.

## Test hooks

- `?fail=1` — load error.
- `?fwfail=save|move|hide|delete|activate|library|import|merge|history` — the next operation of that kind fails once.

## Limits (prototype)

- **Storage:** all data is in this browser's localStorage. There's no server-side validation, no tenant enforcement
  beyond per-school keys, and no protection against two people editing at once beyond the revision check in this tab.
- **History length:** the shared audit log keeps the latest 500 entries across the whole school, so very old framework
  history can roll off.
- **Reports:** no learning reports are generated in this project yet. Records keep `frameworkId` and
  `frameworkVersion`, so future reports can use the right context.
- **Milestones:** assessed in Developmental Milestones (S27, `docs/milestones.md`). Child milestone records live
  there, not in a separate store.
