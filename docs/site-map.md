# Site map — one website, one deployment

**Main URL:** https://jovingj24jan-png.github.io/t00-design-system/

**Deployment:** GitHub Pages, classic ("legacy") build from branch `main`, folder `/`, in repository
`jovingj24jan-png/t00-design-system`. There's no build step and no workflow file: every push to `main` publishes the
whole repository as one static site. All internal links are relative, so the site works under the `/t00-design-system/`
project path. `404.html` sets its base path automatically.

| Path | Page |
| --- | --- |
| `/` (`index.html`) | **Homepage** — school website (approach, programmes, admissions, visit request) and links to every page |
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
| `/form.html?f=<formId>` | Public Form Builder form (no sign-in) — see `docs/form-builder.md` |
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
| | | | `form-builder` (`&edit=`) | Form Builder |
| `enrol` (`&id=`, `&enquiry=`) | Enrol / edit child (S14) | | `fees` · `statement&family=` | Fees · family statement |
| `waitlist` (`&cls=`, `&focus=`) | Waitlist (S09) — see `docs/waitlist.md` | | `reports` · `payroll` · `safeguarding` | Management modules |
| `families` · `family&id=` | Families (S15) · one family | | `resources` | Rooms & Resources |
| `marketing` (`&period=`, `&referral=`) | Marketing & Referrals — see `docs/marketing.md` | | | |
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
- **Homepage hero:** `assets/images/hero-child.jpg`, a local classroom photo (no remote images). To change it,
  replace the file or the `url(...)` in the `.hm-hero` rules in `styles.css`.
- One URL doesn't mean one database: all data is still demo data kept in each browser's localStorage, as before.

## Homepage (`index.html` + `home.js`)

- **Navigation:** a floating ivory pill with Home, Approach, Programmes, Admissions, Visit and All pages. The link for the
  section on screen is marked current. It also has a language selector and a terracotta **Book a visit** button.
  Below 1024px, or whenever the links don't fit in the current language, they move into a menu (Escape or an outside
  click closes it). Staff sign-in sits in the hero and the menu.
- **Content comes only from existing school data:**
  - learning areas: `LEARNING_AREAS` and the activity library
  - programmes: the class registry (ages, mixed age, room)
  - contact: `school.email` and `school.phone`
  - admissions steps: the pipeline stages
- **Not shown, because no real content exists:** a gallery, team or staff bios, an address or map, testimonials,
  awards and statistics. Add real content before adding these sections.
- **Visit form:** creates a Website enquiry in the admissions pipeline (see `docs/admissions.md`).
- **Languages:**
  - English is the default. Tamil and Arabic come from the existing `NexoraI18n` keys (`h_*` in `i18n.js`) and are
    saved in `nexora-locale`, so the choice carries over to sign-in. Arabic switches the page to right-to-left.
  - The headline reuses the approved sign-in tagline. **The other Tamil and Arabic homepage strings are first drafts
    and need review by a native speaker before release.**
  - Class names, activity titles and app page names from the store are school content, so they stay as entered
    (marked `lang="en"`).
- **App modules are English-only.** No approved Tamil or Arabic strings exist for them, so they were not machine-translated.
