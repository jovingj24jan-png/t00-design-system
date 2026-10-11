# Daily Diary & Care Log — `app.html?page=diary` (`diary.js`)

Record meals, naps, toileting, mood, activities, notes and photos for one class, one child or many at once.
`?cls=<class>`, `?date=YYYY-MM-DD` (past days: view and correct only), `?view=timeline&child=<id>`.
Sidebar: **Daily Diary**. Roles: Teacher (own classes), Director, Admin, Super Admin.

## One diary store

Entries live in the existing `nexora-diary:<school>` — the records the S13 *Daily Diary* tab already shows —
with typed fields added:

`{ id, childId, classId, cls, date, type, at (event time), status, data, title/meals/rest/notes, author, byId,
createdAt, updatedAt, updatedBy, publishedAt, publishedBy, bulkId, requestId, allergyCheck, history[] }`

| Status | Who sees it |
| --- | --- |
| `draft` | Staff only, not yet shared |
| `published` | Shared with that child's family |
| `internal` | Staff only, never shared (notes only; can't be changed to shared) |

Older profile entries (no `type`) are read as published notes. `title/meals/rest/notes` are filled for every
typed entry so S13, the child summary and the class detail diary-completion figures keep working.
`store.familyDiary(childId)` is what a family would see: published entries only; a photo also needs every
pictured child's photo consent.

## Roster, selection, bulk

The roster is today's S19 expected children (past days: the class's active children). Absent children can't
be selected or given entries. Every bulk action writes **one record per child** in a single write (all or
nothing); children who can't take the entry (absent, not in the class) are skipped and named in the toast.
A repeated `requestId` returns the first result — no duplicate records on retries or double taps.

## Meals and allergy safety

- Menu: `nexora-menus:<school>` by weekday (demo menu, Mon–Fri). Items carry structured allergen IDs; an item
  with `allergens: null` has no ingredient record and is **never** treated as safe. Weekends, holidays and days
  without a menu show "No menu" and the food must be described (that can't be checked automatically).
- Child rules come from current alerts: allergy text is mapped to allergen IDs (peanut, tree nuts, dairy, egg,
  gluten, soy, sesame, fish, shellfish, gelatine; a structured `allergen` field wins if present). Dietary needs
  (vegetarian, vegan, Jain, "no egg/milk…", no root vegetables) become foods to avoid; Halal flags meat for a
  manual check. Allergies that name no known food (e.g. "kiwi") are "check by hand"; non-food allergies (bee
  stings) are ignored.
- `store.mealCheck` compares every selected child with every selected item and lists child + allergen + item.
  Any match, unknown ingredient or unmatched allergy requires **Checked and safe**. The acknowledgement is tied
  to the exact children and items (a signature); changing either unticks it, and `saveDiaryEntries` re-runs the
  check against current records at save time and refuses a missing or stale acknowledgement. The entry records
  who checked and when. It never marks food as safe.

## Naps

Start creates one running session per child (no second running nap for the same child). The clock shows time
since the saved start (recomputed every 15 s and when the tab returns; nothing is written while it runs).
Stop saves the end time and duration. Past naps can be entered with start/end; edits are validated (end after
start, not in the future, no overlap with another nap) and kept in the entry's history. A running nap can't be
shared until it ends.

## Photos

Resized on the device (longest side 1280 px, JPEG) and stored once in `nexora-diary-photos:<school>`; each
selected child gets an entry pointing at it. Several children need "This photo shows all N selected children".
Sharing needs every pictured child's *Photos in the parent gallery* consent (S13 Consents); otherwise it can only
be a staff draft. Only staff who can see a pictured child's diary can load the photo.

## Not available in this prototype (needed for production)

- **No server or object storage.** Records and photos are in this browser's localStorage (a few MB in total);
  a full device gives an honest "out of space" error. Real deployments need private storage, signed URLs and
  server-side validation of every rule above.
- **No family app.** "Shared with family" sets what `familyDiary` returns; nothing is delivered or notified.
- **Menus and ingredients** are a demo weekly menu; there is no menu editor or ingredient database yet.
- Times use this device's clock as the school's local time.

Test hook: `?fail=1` shows the error state with Retry.
