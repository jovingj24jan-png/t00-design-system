# Site map — one website, one deployment

**Main URL:** https://jovingj24jan-png.github.io/t00-design-system/

**Deployment:** GitHub Pages, classic ("legacy") build from branch `main`, folder `/`, in repository
`jovingj24jan-png/t00-design-system`. There's no build step and no workflow file: every push to `main` publishes the
whole repository as one static site. All internal links are relative, so the site works under the `/t00-design-system/`
project path. `404.html` sets its base path automatically.

| Path | Page |
| --- | --- |
| `/` (`index.html`) | **Homepage** — Sign in / Open dashboard, and links to every page |
| `/signin.html` | Sign in (S01) — English, தமிழ், العربية; `?next=` returns you to the page you asked for |
| `/forgot-password.html` | Password help (S02) |
| `/first-login.html` | First login (S03) |
| `/setup.html` | School setup wizard (S05) |
| `/dashboard.html` | Dashboard (S04) — the app's home and logo target |
| `/plans.html` | Plans & upgrade (S61) |
| `/support.html?topic=help` · `?topic=privacy` | Help · Privacy |
| `/design-system.html` | T00 Design System |
| `/record.html?id=<childId>[#tab=…]` | Child profile (S13) |
| `/access-denied.html?page=<key>` | Shown when a role can't open a page |
| `/maintenance.html` | Maintenance page (switch in `config.js`) |
| `/404.html` | Not found |

App pages all share one shell (sidebar, header, notifications) at `app.html?page=<key>`:

| `?page=` | Page | | `?page=` | Page |
| --- | --- | --- | --- | --- |
| `attendance` | Attendance | | `messages` | Messages (`&family=` family log) |
| `diary` | Daily Diary | | `communication` | Announcements |
| `lessons` | Lesson Planning | | `forms` | Forms & Permissions |
| `calendar` | Calendar & Events | | `meetings` | Parent–Teacher Meetings |
| `classes` · `class&id=` | Classes · one class | | `notifications` · `notification-settings` | Notifications |
| `roster` | Class rosters | | `admissions` | Admissions pipeline (S06) |
| `classroom-tracker` · `observations` · `gallery` | Classroom modules | | `admissions&applicant=<id>` | Applicant details (S07) |
| `children` | Children (S12) | | `tours` | School Tours |
| `enrol` (`&id=`, `&enquiry=`) | Enrol / edit child (S14) | | `fees` · `statement&family=` | Fees · family statement |
| `waitlist` | Waitlist | | `reports` · `payroll` · `safeguarding` | Management modules |
| `families` · `family&id=` | Families (S15) · one family | | `resources` | Rooms & Resources |
| `compose` | Message families | | `settings` | Settings |

Signed-out visitors who open an app page go to sign-in and come back afterwards. Pages a role can't use go to
`access-denied.html`; modules outside the school's plan show the plan page at the same URL.

## Notes

- **Theme:** Terracotta + Sand, set centrally in the `:root` tokens of `styles.css`:
  - **Brand:** terracotta `#BD7257`, deep clay `#873F2D`, sand `#E5C6A6`, sage `#668575`.
  - **Neutrals:** warm ivory `#F6EFE5`, cream `#FFFDF9`, dark text `#29312D`.
  - **Contrast:** buttons with small labels use `--color-primary-strong` (`#A35C43`, 5:1 with cream), and text drawn in
    the brand colour uses deep clay. The large homepage CTA uses brand terracotta.
  - **Status colours** (success, warning, error, info) stay distinct.
- **Homepage hero:** `assets/images/hero-classroom.svg`, a local illustration (no remote images). To use a real
  classroom photo, add it to `assets/images/` and change the `url(...)` in the `.hm-hero` rule in `styles.css`.
- One URL doesn't mean one database: all data is still demo data kept in each browser's localStorage, as before.
