# Messages & Communications — `app.html?page=messages` (`inbox.js`)

`?c=<conversationId>` opens a thread; `?filter=unread|families|staff|groups`. The S16 family message log is
unchanged at `?page=messages&family=<id>[&msg=<id>]` (families.js). Sidebar: **Messages** (with an unread count).

> **Prototype, not secure messaging.** Everything is stored in this browser's localStorage and checked in the store
> layer only. There is no server, no authentication beyond the demo session, no encryption and no delivery to real
> families. Do not use it for real family communication.

## Data

| Record | Key | Notes |
| --- | --- | --- |
| Conversations | `nexora-conversations:<school>` | `{ type family/staff/class, familyId, childIds, guardianIds, staffUserIds (members), classId, broadcast, demo, lastMessageAt }`. Two demo threads are seeded (flagged `demo`). |
| Messages | `nexora-chat-messages:<school>` | `{ conversationId, senderType staff/guardian, senderId, body, attachments, status sent/scheduled/cancelled/failed, scheduledFor, clientId, demo, private, lang, translations }`. |
| Reads | `nexora-chat-reads:<school>` | `{ messageId, readerType user/guardian, readerId, at, demo }` — per recipient. |
| Files | `nexora-chat-files:<school>` | Images (resized) and PDFs ≤ 1 MB, checked by file content; device-local. |
| Quick replies | `nexora-quick-replies:<school>` | Leaders edit them from the composer. |
| Demo switch / queue | `nexora-messaging-demo:<school>`, `nexora-chat-demo-queue:<school>` | Leaders can turn demo replies off. |

## Rules (store)

- Only members (`staffUserIds`) can list, open, send, read files or see context. Teachers start family threads only
  with families who have a child in their classes; class threads only for their classes.
- Starting a thread reuses an existing matching one (family + you, the same colleague pair, the same class).
- Class threads are broadcasts: messages go to every guardian of the class's children; a family's reply would be
  private to staff (never shown to other families). Context for a class thread lists no individual families.
- Send: text ≤ 4,000 or attachments; a repeated `clientId` returns the first message (no duplicates). The page shows
  *Sending…*, then the saved message, or *Not sent* with **Retry** / **Discard** — the text is never lost.
- Read receipts: grey ✓✓ = saved; yellow ✓✓ = every recipient has read it; groups show "Read by n of N". Staff ↔ staff
  receipts are real (open the thread as the other demo role). Family receipts only come from demo replies and are
  labelled "demo".
- Unread = messages from others you haven't read. Opening a thread marks them read and marks its message
  notifications read. The conversation rows, Unread tab, page total and sidebar badge all use the same count.
- Each incoming message creates one Nexora notification for the other members (sender and thread only, no text).

## Demo adapters (clearly labelled in the UI)

- **Family replies**: guardians have no app login, so in demo mode a reply is queued ~3 s after you message a family
  and delivered by `processMessaging()`, which the shell runs every second on every page. It's flagged `demo`, shown
  with a *Demo* tag, notifies members and shows a toast if you're elsewhere. Staff and class threads never get
  simulated replies.
- **Translation**: `translateMessage()` is the integration point. No translation service is connected; only demo
  replies carry a built-in translation (labelled "demo translation"). Any other message shows an error and the
  original stays unchanged.
- **Scheduling**: scheduled messages are stored and sent by `processMessaging()` when Nexora is open on a device at that
  time (recipient membership re-checked). There's no server scheduler — the UI says so.

## School hours

The composer reads Settings → school hours and days. Outside them it shows "Family will see this now; consider
scheduling." If hours aren't set, no note is shown (nothing is assumed).

Test hooks: `?fail=1` (load error), `?sendfail=1` (first send fails, to see Retry).
