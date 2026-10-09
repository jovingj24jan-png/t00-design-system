# Subscription restriction — backend integration plan

Status: **proposal**. Nothing in this document is implemented. The site is static HTML/CSS/JS
on GitHub Pages with no server, no build step and no database. Every endpoint below is a
proposed contract, not an existing API.

## 1. What the frontend does today (prototype only)

All of this lives in `store.js` and is stored in the visitor's own `localStorage`. Anyone can
edit it from the browser console, so none of it may be treated as authoritative.

| Concern | Prototype source | localStorage key |
| --- | --- | --- |
| Signed-in state | `session` | `nexora-session` |
| Current user (name, email, role) | `users[]` picked by demo role | `nexora-demo-role` |
| School | `school` constant (`sch-northvale`) | — |
| Plans and module catalogue | `plans[]`, `pages{}` | — |
| School's current plan | `currentPlan()` / `setSchoolPlan()` | `nexora-school-plan` |
| Entitlement check | `isEntitled()` (plan rank ≥ module's plan rank) | — |
| Upgrade requests + Admin notification | `requestUpgrade()` | `nexora-upgrade-requests`, `nexora-notifications` |
| "Talk to us" enquiries | `submitEnquiry()` | `nexora-enquiries` |

`requestUpgrade()` and `submitEnquiry()` already return promises and report `{ ok: false }`
on failure, and the UI only shows success after `ok: true`. These two functions and
`setSchoolPlan()` are the seams where real API calls replace the local writes.

## 2. Backend requirements

1. **Subscriptions** — one active subscription per school (plan, status, period end).
   Plan changes come only from the billing provider's verified webhook, never from the
   browser. Downgrades take effect at period end unless product decides otherwise.
2. **Billing** — hosted checkout and customer portal from a payment provider (choice not yet
   made). No card data touches this site or its API. Webhooks verified by signature and
   processed idempotently (store the provider event ID).
3. **Entitlements** — the server decides access for every module request and every module
   API call. The sidebar locks and the plan-restricted page are presentation only.
4. **Upgrade requests** — stored server-side, delivered to the school's admins (in-app and
   optionally email), one *pending* request per school + user + module, resolved
   automatically when the school's plan comes to include the module.
5. **Enquiries** — stored, then emailed to the sales/support team through a transactional
   email provider via a queue or outbox with retries. Rate limited per user.
6. **Identity** — real authentication; user name, email, role and school ID come from the
   session, never from the request body.
7. **Authorization and audit** — role checks per school membership; an append-only audit
   log of plan changes, upgrade requests, enquiries and denied access attempts.

## 3. Smallest suitable integration

GitHub Pages cannot run server code, so a small separate API is required. Which platform
should host it (and the database, email provider and payment provider) is not decided:
**confirm the existing infrastructure before choosing**.

Frontend changes at integration time:

- Replace the bodies of the `store.js` functions above with `fetch` calls; keep their
  return shapes (`{ ok, created, request }`, `{ ok, enquiry }`) so `plan.js` and `plans.js`
  stay unchanged.
- `currentUser()`, `currentPlan()` and `isEntitled()` are synchronous today and are called by
  `shell.js`, `app.js` and `plans.js` during first render. They need one async bootstrap
  (`GET /api/session`, below) before the shell renders, with a loading state, and an error
  state when it fails. This is the largest frontend change.
- Remove the demo role switcher and the local plan switch from production builds.
- Keep the catalogue copy (names, descriptions, features) client-side or serve it from
  `GET /api/plans`; the server stays the source of truth for *which* plan includes *which*
  module.

## 4. Proposed API contract

All endpoints require an authenticated session (HTTP-only, Secure, SameSite cookie) and
CSRF protection on writes. The school is the one in the session; a `schoolId` in the body is
ignored. Errors use one shape:

```json
{ "error": { "code": "PLAN_REQUIRED", "message": "Human-readable text", "details": {} } }
```

Codes: `UNAUTHENTICATED` (401), `ROLE_FORBIDDEN` (403), `PLAN_REQUIRED` (403, details
`{ moduleId, currentPlan, requiredPlan }`), `NOT_FOUND` (404), `VALIDATION_FAILED` (422,
details `{ field: message }`), `RATE_LIMITED` (429), `INTERNAL` (500).

### `GET /api/session`

```json
{
  "user": { "id": "usr_…", "name": "Mrs. Rao", "email": "rao@…", "role": "Director" },
  "school": { "id": "sch_…", "name": "Northvale Academy" },
  "subscription": { "planId": "starter", "status": "active", "currentPeriodEnd": "2026-11-01T00:00:00Z" },
  "entitledModules": ["attendance", "classroom-tracker", "observations", "communication", "gallery"],
  "canManagePlan": true,
  "unreadNotifications": 2
}
```

### `GET /api/plans`

Plans with rank and included module IDs. Public within the session; no prices are hard-coded
in the frontend.

### Module data endpoints (existing modules, future)

Every module endpoint checks, in order: authenticated → role allowed for module →
school entitled to module. Same order as the frontend guard in `app.js`, so an unentitled
module returns `PLAN_REQUIRED` and a forbidden role returns `ROLE_FORBIDDEN`.

### `POST /api/upgrade-requests`

Request `{ "moduleId": "payroll" }`.

- Validation: `moduleId` is a known module; the school is **not** already entitled
  (otherwise 409 `ALREADY_ENTITLED`); caller is not a plan manager (they upgrade directly).
- Idempotent: if a pending request exists for school + user + module, return it with
  `200 { "created": false, "request": … }`; otherwise `201 { "created": true, "request": … }`.
- Request record and admin notifications are written in one transaction.

```json
{ "created": true, "request": { "id": "upr_…", "moduleId": "payroll", "currentPlan": "starter", "requiredPlan": "premium", "status": "pending", "createdAt": "…" } }
```

### `GET /api/notifications`, `POST /api/notifications/read`

Notifications for the session user, newest first. Read marks the given IDs (or all) as read.

### `POST /api/enquiries`

Request `{ "moduleId", "name", "email", "message", "preferredTime" }`.

- Validation: name 1–120 chars; valid email ≤ 254 chars; message 1–600 chars;
  `preferredTime` ∈ `morning | afternoon | no-preference`; `moduleId` known.
- Rate limit, e.g. 5 per user per hour → 429.
- Response `202 { "id": "enq_…", "status": "queued" }`. The toast may only say "sent" once
  the API exists; until email delivery is confirmed it should say the enquiry was received.

### `POST /api/billing/checkout` and `POST /api/billing/webhook`

- Checkout: plan managers only; request `{ "planId" }`; returns the provider's hosted
  checkout URL. The plan does **not** change here.
- Webhook: no session; verify the provider signature; ignore already-processed event IDs;
  update the subscription; resolve pending upgrade requests the new plan covers; notify
  requesters; write audit entries.

## 5. Proposed records

| Table | Key fields |
| --- | --- |
| `schools` | id, name |
| `users` | id, name, email (unique), auth provider ID |
| `memberships` | user_id, school_id, role — unique (user_id, school_id) |
| `plans` | id, name, rank |
| `plan_modules` | plan_id, module_id |
| `subscriptions` | school_id (unique), plan_id, status, current_period_end, provider_customer_id, provider_subscription_id |
| `billing_events` | provider_event_id (unique), type, received_at, processed_at |
| `upgrade_requests` | id, school_id, user_id, module_id, current_plan, required_plan, status (`pending`/`resolved`/`dismissed`), created_at, resolved_at — unique (school_id, user_id, module_id) where status = `pending` |
| `notifications` | id, school_id, recipient_user_id, kind, payload (JSON), created_at, read_at |
| `enquiries` | id, school_id, user_id, module_id, name, email, message, preferred_time, delivery_status, attempts, created_at |
| `audit_log` | id, school_id, actor_user_id, action, target, before (JSON), after (JSON), ip, user_agent, created_at — append-only |

## 6. Steps before production

1. Confirm hosting, database, auth, email and payment providers.
2. Build the API and records above; enforce entitlements on the server.
3. Add the session bootstrap and loading/error states to the shell; switch `store.js` to the API.
4. Remove the demo role switcher, demo users and the local plan switch.
5. Update toasts to reflect real delivery status.
6. Test: role × plan matrix server-side, webhook replay, duplicate requests, rate limits,
   email failure and retry, and the existing frontend suites.
