# S12 Children — data, screens and integration seams

Status: **prototype**. Records live in this browser's `localStorage`, seeded on first read by
`store.js`. Nothing is sent to a server; messages to families are saved, not delivered.

## Screens

| Screen | URL | File |
| --- | --- | --- |
| S12 Children (grid / list) | `app.html?page=children` | `children.js` |
| S13 Child record | `record.html?id=<childId>` | `record.js` |
| S14 Enrol child / edit | `app.html?page=enrol` · `app.html?page=enrol&id=<childId>` | `children.js` |
| S31 Message families | `app.html?page=compose&children=<id>,<id>` | `children.js` |

Test hook: `app.html?page=children&fail=1` makes the first load fail, to show the error state and Retry.

## Data (`store.js`)

`nexora-children:<schoolId>` holds one record per child:
`{ id, firstName, lastName, dob, cls, status, startDate, photo, guardian{name, relation, phone, email}, alerts[{type, detail}], withdrawal, history[] }`.

- Status: `active` · `starting` (start date in the future) · `withdrawn` · `graduated`.
- Alert types: `allergy` · `medical` · `custody` · `dietary`.
- `store.roster` is now **every active child**, so attendance, fees, ratios and the dashboard
  follow enrolments, class moves and withdrawals. Seeds keep the original roster IDs.
- Writes (`saveChild`, `moveChildren`, `withdrawChild`, `saveFamilyMessage`) check the role and
  resolve `{ ok }` or `{ ok: false, reason, errors }`. A bulk move is all-or-nothing.
  Withdrawal never deletes a record; it sets the status and keeps reason, date and history.
- Grid/List preference: `nexora-children-prefs:<userId>` (per user).

## Permissions

| Role | Children | Enrol / edit / move / withdraw | Message families |
| --- | --- | --- | --- |
| Director, Admin, Super Admin | All classes | Yes | Yes |
| Teacher | Own class only | No | Yes (own class) |
| Accountant | All classes, view only | No | No |

## Behaviour notes

- The header count is current children (active + starting soon). Withdrawn and graduated
  children appear only when chosen in the Status filter.
- Filters: options within a group are OR, groups are AND, search applies on top.
  "All alerts" means children with any alert.
- Ages are calculated from the date of birth each time the page renders.
- CSV export is UTF-8 with a BOM; the header button exports the filtered list, the bulk
  action exports only the selected children.
- List view priority columns: Start date hides below 1280px and Age below 1024px (both remain
  on S13 and in the CSV). Below 768px each row is a stacked card.

## Replacing the prototype

Swap the store functions for API calls and keep their result shapes; the pages need no change.
