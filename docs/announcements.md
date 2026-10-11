# Announcements & Emergency Broadcast — `app.html?page=communication` (`announcements.js`)

`?tab=sent|scheduled|drafts`, `?focus=<announcementId>` (opens the details drawer — used by notifications and class pages),
`?compose=1` (opens the composer). Sidebar: **Announcements** (page key `communication`, unchanged).

> **Prototype, not a delivery system.** Everything is stored in this browser's localStorage and checked in the store
> layer only. No message reaches a family: there is no parent app, email or SMS provider. The UI says so wherever a
> send or reminder is recorded.

## Data — `nexora-announcements:<school>`

```
{ id, title, body, category, type: 'normal'|'emergency', emergencyType,
  status: 'draft'|'scheduled'|'sending'|'sent'|'failed'|'cancelled',
  audienceSpec: { mode: 'all'|'classes'|'families'|'staff', classIds, familyIds, staffIds }, audience (label),
  channels, requireAck, scheduledAt, sentAt, cancelledAt, attachments (chat file ids),
  recipients: [{ id: 'fam:<familyId>'|'staff:<userId>', kind, name, children, classes,
                 delivery: { app }, readAt, readDemo, ackAt, ackDemo, reminders: [{ at, by, result }] }],
  reminders: [{ at, by, targeted, queued, skipped }], createdBy, createdById, createdAt, updatedAt }
```

Older records (title/body/audience string only) are read once as **sent** announcements to the audience they named
(flagged `legacy`) and saved back.

## Rules (store)

- **Who:** anyone with the `communication` module can announce. Leaders (Director/Admin) can address all families,
  any class, any family and staff; teachers only their own classes and those classes' families. Emergency
  broadcasts: plan-manager roles only (`canEmergency`).
- **Audience count:** one recipient per family (a family with children in two selected classes is counted once) or
  per staff member. The composer's count and the saved recipient list come from the same `resolveAudience()`.
  The audience is resolved again at send time.
- **Draft:** can be incomplete; saving again updates the same record. Duplicate creates a new draft. Only drafts can
  be deleted.
- **Schedule:** needs a complete announcement and a time at least a minute ahead. Editing keeps the same record.
  **Send now** and **Cancel** work only while it is scheduled; a cancelled one stays listed and can be duplicated.
  `processAnnouncements()` (run every second by the shell on every page) sends due items as their author. There is no
  server scheduler: it only happens while Nexora is open on some device.
- **Send:** title, message, an audience with at least one person and an available channel. Sending an already-sent
  record returns it unchanged (`repeated`). The composer also blocks double clicks.
- **Channels:** only In-app exists. Email and SMS are shown as *Not set up* and refused by the store.
- **Delivery recorded honestly:** staff get a real Nexora notification (`notified`). A family with an active
  parent-app account is `queued (demo — not delivered)`; others are `skipped: no parent-app account`.
- **Read %** = unique recipients with `readAt` ÷ total recipients, rounded; 0 when there are no recipients.
  **Acknowledged** is separate (`ackAt`). An acknowledgement implies a read, but a read is never an acknowledgement.
- **Staff reads are real:** opening the drawer as a staff recipient marks it read; *I've read and understood* records
  the acknowledgement.
- **Family reads are demo only:** leaders in demo mode (Messages → demo replies on) can press *Simulate recipient
  reads* / *Simulate acknowledgements*. These marks are flagged `readDemo`/`ackDemo` and shown with a **Demo** tag.
- **Remind unread:** confirms first, then targets unread recipients only. Anyone reminded in the last 10 minutes is
  skipped, so repeated presses never double-remind. Each recipient keeps their reminder history.

## Emergency broadcast

A separate composer (red), with:

- **Fields:** type, title, message, who to alert (all families / selected classes / all staff), channels, a live count
  and a preview.
- **Confirmation:** **Send** stays disabled until `SEND EMERGENCY BROADCAST` is typed exactly. The store checks the
  phrase and role again.
- **Timing:** it is always immediate and is saved with *acknowledgement required*.
- **Staff banner:** it also creates the S32 staff banner in the same write. The banner shows until each person
  acknowledges it, and a leader can **End broadcast** from the page.
- **No duplicates:** a repeat with the same sender, title and message within 30 seconds returns the first broadcast
  instead of creating a second.

## Backend gaps

| Needed | Why |
| --- | --- |
| Parent app / push, email and SMS providers | Families currently receive nothing; delivery is only recorded. |
| Server-side scheduler | Scheduled sends need a device with Nexora open. |
| Real read/ack receipts from families | Family tracking is simulated. |
| Server-side permission + audience checks, audit log | All checks run in the browser today. |
| File storage | Attachments are device-local (≤ 1 MB, image/PDF, via `uploadChatFile`). |

Test hook: `?fail=1` (load error with **Try again**).
