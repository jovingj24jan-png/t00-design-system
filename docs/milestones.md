# Developmental Milestones (S27)

**Route:** `app.html?page=milestones`. It appears in the sidebar and on the homepage page map ("Developmental
Milestones"), and child profiles link to it.

URL options (each is optional):
- `&view=child` with `&child=<id>` — open one child.
- `&cls=<class>` — choose the class.
- `&area=<areaId>` — filter to one area.
- `&ms=<milestoneId>` — open that milestone's details for the child.

**Who:**
- **View:** class staff (Teacher, Director, Admin, Super Admin), on every plan.
- **Assess:** only children in the user's own classes. Leaders' classes include every class.
- **Edit the review rule:** Director and Super Admin.

**Code:** `milestones.js`, the "Developmental milestones" section of `store.js`, the `.ms-*` styles in `styles.css`, and
the child profile's Learning & Portfolio tab.

## Data

- **Milestones** are the active Learning Framework's `milestone` items (visible ones only), with their area, sub-area,
  age band and description. There's no separate list.
- **Assessments** — `nexora-milestone-assessments:<school>`. One per child + milestone:
  `{ status: emerging|developing|secure, date, assessorId/Name, note, evidenceIds[], frameworkId/Version }`.
  **No record means Not assessed.** Nothing is created for unassessed milestones.
- **History** — `nexora-milestone-assessment-events:<school>`, append-only. Each event has a kind:
  - `status` — a change of status;
  - `reassessed` — the same status with a new date or note;
  - `evidence` — links added or removed.

  Every event records who and when, and keeps the note and evidence changes.
- **Evidence:**
  - Observations explicitly linked to the assessment, plus published observations tagged with that milestone in S25.
  - Links point to the observation's ID; its text and photos are never copied.
  - Removing a link asks for confirmation and doesn't touch the observation.
- **Earlier records:** "Record milestone" records (`nexora-child-milestones`) are converted once into Secure
  assessments, so there's one canonical record. `getChildMilestones` and `recordChildMilestone` now read and write
  assessments.
- **Saving:**
  - Assessments are saved only after validation: a status, a date that isn't in the future or before birth, and
    evidence that is a published observation of the child.
  - A stale edit (the assessment changed since it was opened) is refused.
  - A failed save keeps what you entered.

## Calculations (one function each, used everywhere)

- **Area status:** from the assessed milestones in the area. Not assessed ones are excluded.

  | Rule | Area status |
  | --- | --- |
  | Every assessed milestone is Secure | **Secure** |
  | More than half are Emerging | **Emerging** |
  | Anything else | **Developing** |
  | Nothing assessed | **Not assessed** |

  Milestones count equally, because the framework has no milestone weights.
- **Secure %** = Secure ÷ assessed milestones × 100. If nothing is assessed it shows "—", never 0%.
- **Coverage** (for example 2/4) is shown separately from achievement in the table, the chart and the child view.
- **Assessed period filter:** limits which assessments count to those dated in the period. The rest count as Not
  assessed for that view.

## Review flag (`milestoneFlag`)

A prompt for educator review, never a diagnosis. The calculation, for one child and one area:

1. Age comes from the child's date of birth.
2. Age bands are read only when written like "3–4 years" or "2½–3 years". Anything else is never guessed.
3. Milestones **expected by now** are those whose age band has ended at or before the child's current age.
4. **Review recommended** (⚑) when all of these hold — default rule, version 1:

   | Condition | Default |
   | --- | --- |
   | Milestones expected by now that are assessed | at least `minExpected` (2) |
   | Of those, Emerging | at least `minEmerging` (2) |
   | Share of those that are Emerging | at least `emergingShare` (50%) |

5. **Not enough information** when fewer than `minExpected` expected milestones are assessed. It shows as "?" only
   where the area has some assessments.
6. **No flag** when there's no date of birth, no readable age bands, or nothing expected by now yet.
7. Unassessed milestones and missing evidence never cause a flag. Developing never counts toward a flag.

Each result carries the rule version and calculation time. Directors can change the rule in **Review rule**, which
bumps the version. Flags are recalculated every time a view draws, so they follow:
- assessment changes;
- date-of-birth changes;
- framework or age-band changes;
- rule changes;
- the period filter.

The flag explanation shows:
- the child's age and age band;
- the milestones expected by now, with their statuses;
- coverage, the reason and the rule version;
- the last assessment date;
- "Review evidence" and "Create learning plan" actions.

## Bulk assess

The steps are: one milestone → children of the class (search, select all, clear) → status, date, optional shared note
and evidence → review → apply.

- **Shared evidence** is offered only when an observation includes every selected child.
- **One child at a time.** Saves are made child by child, so one failure doesn't undo the others.
- **Unchanged children.** Children already at that status are reported as unchanged, and no event is written.
- **Shared notes** go on each new history event. A child's own assessment note is never overwritten.
- **Results** show saved, unchanged and failed. **Retry** only reruns the failed children; a stable request ID stops
  repeats from duplicating.

## Other modules

- **S25 Observations:** evidence opens the original observation (`?page=observations&obs=<id>`). Assessing never
  creates or edits an observation.
- **Progress Tracker:** the milestone drawer shows the child's state on the sub-area's materials as context.
  Mastering a material **never** sets a milestone.
- **S28 portfolio:** the child profile shows every assessment — status, date, assessor, note and evidence count — read
  from the same store, with "Open in Developmental Milestones". "Record milestone" became "Assess milestones" and opens
  this module, so there's one assessment workflow.
- **S29 learning plans — not part of this project.** `store.learningPlans` is the adapter: `available: false`, and
  `forChild()` returns no plans. `context()` builds what a plan would start with: child, class, area, assessed
  milestones and statuses, observation IDs, the flag and coverage. "Create learning plan" shows that context and offers
  to copy it. Nothing is created, and the UI says so.
- **Learning Framework:** an assessed milestone can't be deleted (it offers Hide instead). The demo templates now
  include 16 milestones as demo content (template schema 3; a demo-only library is refreshed). Frameworks imported
  earlier get them by merging the template.

## Responsive

| Width | Behaviour |
| --- | --- |
| ≥1600px | Class table with the chart and review list beside it. |
| 1024–1599px | The chart and review list move below the table. |
| 768–1023px | The table scrolls sideways with the child column fixed. |
| <768px | Child view only, with area accordions. Milestone details are a full-width sheet. Bulk assess stays available. |

## Test hooks

- `?fail=1` — load error.
- `?msfail=save` — the next save fails once.
- `?msfail=bulk` — the second child of the next bulk save fails.

## Limits

- **Storage:** all data is in this browser only. There's no cross-device or multi-user sync and no server-side
  permission checks; the stale check protects against conflicting edits within one browser only.
- **No dashboard widget or notifications.** None exist for learning data.
- **Breadcrumbs:** none, matching the app's other module pages.
