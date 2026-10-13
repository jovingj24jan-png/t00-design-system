# Progress Tracker

**Route:** `app.html?page=classroom-tracker` — the existing sidebar module, renamed from "Classroom Tracker" to
**Progress Tracker** and now built.

URL options (each is optional):
- `&cls=<class name>`
- `&area=<framework area id>`
- `&view=child`, with `&child=<id>`
- `&gaps=1`

**Who:**
- Class staff (Teacher, Director, Admin, Super Admin) can view, on every plan.
- Changes are allowed only for children in the user's own classes.

**Code:** `tracker.js`, the "Progress tracker" section of `store.js`, the `.pt-*` styles in `styles.css`, and the child
profile's Learning & Portfolio tab.

## What it reads

- **Materials:** the active Learning Framework's material items for the chosen area, in framework order (sub-area
  order, then material order). Hidden materials aren't shown. There is no second material catalogue: framework
  materials already link to the Rooms & Resources inventory.
- **Prerequisites:** `prerequisiteIds` on a framework material, edited in Learning Framework → material → Prerequisites.
  - Only other materials can be prerequisites, and loops are refused.
  - The demo templates set four as demo content (Number rods → Spindle box → Golden beads, Sandpaper letters →
    Movable alphabet, Knobbed cylinders → Colour box 2). They're mapped on import and merge.
  - Demo template libraries saved before this change are refreshed automatically. A real library is never replaced.
- **Children:** the class's active and starting children.

## Data

| Store | Shape |
| --- | --- |
| `nexora-progress:<school>` | One record per child + material: `{ id, childId, materialId, frameworkId, state, stateDate, updatedAt/By, lastEventId }` |
| `nexora-progress-events:<school>` | Append-only: `{ id, progressId, childId, materialId, frameworkId, frameworkVersion, materialName, from, to, date, at, by, byId, note, observationId, clientId, edits[] }` |

- **States:** `not_introduced` → `presented` → `practising` → `mastered` → `not_introduced`, shown as —, P, Pr and M.
  The letter is always visible.
- **How a change is saved:**
  - The record and its event are written together (`commit`).
  - The screen updates only after that save succeeds; a failed save keeps the previous state and says so.
  - A change made against a state that has since changed is refused as stale.
  - A repeated click while one is saving is ignored.
- **Event dates:** today by default. They can be set in the details dialog, but never in the future and never before
  the previous change.
- **Editing a change:** a note, date or observation link can be corrected only on the latest change. The earlier values
  are kept in that event's `edits`.
- **Observation links:** must point to a published observation of the same child (S25). Nothing is created
  automatically.

## Interactions

- **Grid:** rows are children (the name column stays put while scrolling); columns are materials, grouped by sub-area.
  - **Click** a cell to move it to the next state.
  - **Right-click**, **long-press** (550 ms; moving more than 8 px cancels it, and the tap that follows is ignored) or
    the keyboard context-menu key opens the **details**. Details show state, date, note, observation link and full
    history.
  - **Hover or focus** a cell for a dated history tooltip.
  - **Arrow keys** move between cells; the grid is one tab stop.
  - **Click a column header** for the material drawer: sequence, age band, purpose, prerequisites, outcomes in the
    sub-area, inventory, and class counts. Anything not recorded says "Not configured".
- **Ready for next presentation:**
  - A child is listed for a material they haven't been introduced to when all of its configured prerequisites exist,
    are visible and are mastered.
  - Each entry shows the latest prerequisite mastered and its date, plus evidence when that change has an observation.
  - With no prerequisites configured for the area, the panel says so instead of guessing.
  - Being listed never records anything.
- **Show only gaps:** hides materials every child in the grid has mastered (order kept, rows kept). In the Child view it
  hides that child's mastered materials.
- **Child view:**
  - A searchable child picker. Choosing a child from another class switches the class and says so.
  - Materials are grouped by sub-area, each with a state chip that cycles, its latest date, an observation indicator,
    an expandable history, and a details button.
  - It uses the same records as the grid.
- **Responsive:**
  - From 1024px: grid plus the readiness side panel.
  - 768–1023px: the grid scrolls sideways with the name column fixed, and the readiness panel moves below it.
  - Below 768px: always the Child view.

## Other modules

- **S28 portfolio:** the child profile's Learning & Portfolio tab has a **Progress** timeline. Each entry shows
  material, from → to, date, teacher, note and observation link. It reads the event store directly, so there is no
  copy.
- **S27 milestone evidence:** materials the child has been presented, is practising or has mastered count as evidence
  for milestones in the same framework sub-area.
  - Mastery never records a milestone.
  - Records stay tied to their framework, so changing the active framework doesn't break history; earlier entries show
    their framework name.
- **Learning Framework:** an item can't be deleted while a progress record uses it, or while another material lists it
  as a prerequisite. "Hide instead" is offered.
- **Presentation records:** *Record presentation* on the profile is the older free-text log (material typed as text).
  It isn't migrated, because free text can't be matched to material IDs reliably.
- **Notifications:** none are sent, and no dashboard widget exists for this.

## Not included

- **Breadcrumbs:** the app's module pages don't use them, so none were added.
- **Storage:** everything is stored in this browser only. There's no cross-device or multi-user sync. The stale check
  protects against conflicting changes within one browser only.

## Test hooks

- `?fail=1` — load error.
- `?ptfail=save` — the next save fails once.
