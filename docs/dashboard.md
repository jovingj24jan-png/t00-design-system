# S04 Dashboard — data sources and integration seams

Status: **prototype**. Every record below lives in this browser's `localStorage`, seeded on
first read by `store.js`. Nothing is sent to a server.

## Files

| File | Role |
| --- | --- |
| `dashboard.html` / `dashboard.js` | The dashboard (landing page after sign-in, `routes.dashboard`) |
| `workflows.js` | The five quick-action modals + emergency broadcast, shared with the module pages |
| `modules.js` | Attendance, Admissions, Fees, Incidents and Parent Communication pages in `app.html` |
| `store.js` | All records, permission-checked writes, `subscribe()` change events |

## Widgets

| Widget | Module (role + plan gate) | Store source | Opens |
| --- | --- | --- | --- |
| Children on site, Absent today, Registers taken | attendance | `getRegister()` scoped by `classScope(user)` | `app.html?page=attendance[&status=absent\|not-taken]` |
| Staff on duty | attendance, Director/Admin/Super Admin | `getStaffAttendance()` | `…attendance&view=staff` |
| Class ratios (always shown) + critical strip + bell dot | attendance | `ratioStatus(user)` from register, staff on duty and `getRatioRules()` | `…attendance&view=ratio&cls=…` |
| Attendance by class (chart) | attendance | `getRegister()` | `…attendance&cls=…` |
| Open enquiries, Enquiry follow-ups | admissions | `getAdmissionEnquiries()` | `…admissions&status=open` |
| Fees outstanding, Fee collection (chart) | fees | `feeLedger()` (invoices − payments) | `…fees&status=outstanding[&cls=…]` |
| Open incidents, Incidents needing attention | safeguarding | `getIncidents()` | `…safeguarding&status=open` |
| Latest announcements | communication | `getAnnouncements()` | `…communication` |
| Emergency broadcast banner | every role | `unacknowledgedFor(user)` | Acknowledge (per user) |

A widget is hidden when the role can't open its module, and replaced by one locked card per
module when the plan doesn't include it (no figures are computed for locked modules). Ratios
show "Unavailable" with the reason when the register, staff attendance or limit is missing.

## Rules worth knowing

- Teachers see only the classes they are assigned to (`educators[].userId`).
- Ratio: children present + late ÷ educators on duty; a breach is `children > educators × limit`.
- Preferences: `nexora-dashboard:<userId>` stores hidden widget IDs. Ratios and broadcasts can't be hidden.
- Broadcast acknowledgements are stored per user in `ackBy`; the sender starts acknowledged.
- `dashboard.html?fail=<widgetId>` makes one widget fail once, to see the error + retry state.

## Integration

Replace the bodies of the write functions (`saveRegister`, `setStaffAttendance`,
`addAdmissionEnquiry`, `recordPayment`, `logIncident`, `resolveIncident`, `postAnnouncement`,
`sendBroadcast`, `endBroadcast`, `acknowledgeBroadcast`, `saveDashboardPrefs`) with API calls
that keep the `{ ok, reason, … }` result shape, and call `emit()` when server data changes
(e.g. from a push channel) so subscribed pages re-render. The server must repeat every role,
plan and class-scope check; the browser checks are presentation only.
