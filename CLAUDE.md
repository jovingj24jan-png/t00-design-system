# CLAUDE.md

## PREMIUM PRODUCT DESIGN SYSTEM — BUILD INSTRUCTIONS

Build a premium, production-quality `design-system.html`.

IMPORTANT: This is NOT a documentation page.

It must look like a real, polished product interface whose purpose is to showcase the complete design system.

The design-system.html page is the MASTER VISUAL SOURCE for the entire product.

Every other screen should look like it was built directly from the components, spacing, typography, colors, states, and interaction patterns demonstrated here.

---

## 1. BEFORE CODING

First inspect the entire existing project.

Inspect:

- Existing HTML files
- styles.css
- JavaScript files
- Existing components
- Existing T00 Design System
- Existing assets
- Existing typography
- Existing color variables
- Existing spacing
- Existing responsive rules

DO NOT invent a completely new design language.

Reuse the existing T00 Design System.

DO NOT redesign unrelated screens.

DO NOT delete existing functionality.

DO NOT introduce unnecessary dependencies.

---

# 2. DESIGN DIRECTION

The design-system.html must feel:

- Premium
- Elegant
- Modern
- Aesthetic
- Editorial
- Sophisticated
- Minimal
- Highly intentional
- Product-design focused

Think:

Figma Design System + premium SaaS dashboard + editorial product showcase.

It must NOT look like:

- A generic admin dashboard
- Bootstrap
- A developer documentation page
- A boring style guide
- A spreadsheet
- A collection of random cards

The page itself should feel like a premium product.

---

# 3. MASTER VISUAL LANGUAGE

Use ONE consistent visual language.

Use:

- Strong typography
- Generous whitespace
- Elegant spacing
- Soft surfaces
- Subtle borders
- Controlled shadows
- Consistent rounded corners
- Premium orange/yellow accent
- Dark navigation
- Warm neutral background
- Refined micro-interactions
- Strong hierarchy

Do not overuse:

- Glassmorphism
- Neon colors
- Huge gradients
- Heavy shadows
- Excessive pill shapes
- Random decorative elements

---

# 4. CREATE DESIGN-SYSTEM.HTML

Create:

design-system.html

The main/default screen must be created first.

The page should contain:

1. Header
2. Hero
3. Sidebar
4. Section navigation
5. Colors
6. Typography
7. Buttons
8. Inputs
9. Selects
10. Tabs
11. Chips
12. Cards
13. Tables
14. Filters
15. Modals
16. Drawers
17. Notifications
18. Empty states
19. Loading states
20. Error states
21. Success states
22. Locked states
23. Icons
24. Responsive examples

---

# 5. HEADER

Create a premium product header.

Include:

- Product/logo
- Design System label
- Search
- Notification
- User/profile
- Small status/action area

The header must feel like a real SaaS product.

---

# 6. SIDEBAR

Desktop >=1024px:

Show a permanent dark sidebar.

Navigation:

- Overview
- Design System
- Components
- Colors
- Typography
- Icons
- Forms
- Tables
- Notifications
- Modals & Drawers
- Charts
- Empty States
- Error States
- Responsive

Design System must have the active state.

The sidebar should look like part of the actual product.

---

# 7. TABLET

At 768px–1023px:

Hide the sidebar.

Show:

- Hamburger
- Overlay drawer
- Dimmed backdrop

Drawer must:

- Open smoothly
- Close with Escape
- Close when backdrop is clicked
- Be keyboard accessible
- Have visible focus states

---

# 8. MOBILE

Below 768px:

Create an intentionally designed mobile navigation.

Do NOT simply shrink desktop.

Use:

- Compact header
- Logo
- Menu button
- Search/action where useful

---

# 9. COLORS

Show the complete color system.

Include:

- Primary
- Secondary
- Accent
- Success
- Warning
- Error
- Info
- Background
- Surface
- Elevated surface
- Border
- Primary text
- Secondary text
- Muted text

Every color needs:

- Visual swatch
- Name
- Token name
- Semantic purpose
- Value

CRITICAL:

ALL COLORS MUST COME FROM CSS VARIABLES.

There must be NO hard-coded hex colors inside HTML.

Do not write:

style="color:#FF6417"

Do not create random colors inside page files.

Use existing T00 Design System variables whenever possible.

If variables do not exist, create them in styles.css.

---

# 10. TYPOGRAPHY

Show:

- Display
- H1
- H2
- H3
- H4
- H5
- Body Large
- Body Regular
- Body Small
- Caption
- Label
- Button
- Link
- Error
- Success

Show:

- Font
- Size
- Weight
- Line height
- Letter spacing

Reuse the existing product typography.

---

# 11. BUTTONS

Show all states.

Primary:

- Default
- Hover
- Focus
- Active
- Disabled
- Loading
- Success

Secondary:

- Default
- Hover
- Focus
- Disabled

Tertiary:

- Default
- Hover
- Focus
- Disabled

Icon button:

- Default
- Hover
- Focus
- Disabled

Buttons must actually work.

Loading must visibly change the button.

---

# 12. INPUTS

Show:

- Default
- Focus
- Filled
- Error
- Success
- Disabled
- Read-only
- Required

Include:

- Label
- Placeholder
- Helper text
- Error text
- Success text

---

# 13. SELECT / DROPDOWN

Show:

- Closed
- Focus
- Open
- Selected
- Disabled
- Error

It must actually open.

Click outside must close it.

Escape must close it.

---

# 14. TABS

Show:

- Active
- Inactive
- Hover
- Focus
- Disabled

Tabs must actually switch content.

---

# 15. CHIPS

Show:

- Default
- Active
- Selected
- Disabled
- Removable
- Filter chip

Keep the design elegant.

---

# 16. CARDS

Show:

- Basic card
- Image card
- Information card
- Interactive card
- Status card
- Locked card
- Empty card
- Loading card
- Error card

All cards must use the same:

- Radius
- Spacing
- Border
- Shadow
- Typography

---

# 17. TABLE

Create a realistic product table.

Include:

- Header
- Rows
- Checkbox
- Status
- Actions
- Sorting
- Pagination
- Selected row
- Empty state
- Loading state

Desktop:

Normal table.

Mobile:

Convert every row into a stacked card.

Example:

Customer
Name       Joving
Status     Active
Created    07 Oct 2026
Actions    View

NO horizontal scrolling.

---

# 18. FILTERS

Create a realistic filter system.

Include:

- Search
- Dropdown
- Date/filter
- Active filters
- Clear filters
- Apply

Make the interactions work.

---

# 19. MODALS

Create working modals.

States:

- Default
- Confirmation
- Error
- Success
- Destructive confirmation

Desktop:

Centered modal.

Mobile:

Full-screen sheet sliding upward.

Escape closes it.

Backdrop closes it.

Focus must be handled properly.

---

# 20. DRAWERS

Create working:

- Right drawer
- Left drawer where appropriate

States:

- Closed
- Open
- Backdrop

Include:

- Animation
- Close button
- Escape
- Backdrop close

---

# 21. NOTIFICATIONS

Show:

- Success
- Warning
- Error
- Info

Include:

- Icon
- Title
- Description
- Close

If toast is included, make it actually appear.

---

# 22. EMPTY STATES

Create a premium empty state.

Include:

- Icon/illustration
- Heading
- Description
- Primary CTA
- Optional secondary action

It must look intentional and polished.

---

# 23. LOADING

Show:

- Spinner
- Skeleton
- Button loading
- Card loading
- Table loading

Use subtle animation.

Respect:

prefers-reduced-motion

---

# 24. ERROR

Show:

- Inline error
- Card error
- Page error
- Retry action

---

# 25. SUCCESS

Show:

- Success message
- Success card
- Confirmation
- Completed state

---

# 26. LOCKED

Show a locked component.

Include:

- Lock icon
- Explanation
- Optional action

Do not simply reduce opacity.

Explain why it is locked.

---

# 27. RESPONSIVE BREAKPOINTS

Use exactly:

Desktop >=1024px
Tablet 768px–1023px
Mobile <768px

Test:

360px
768px
1024px
1440px

---

# 28. MOBILE REQUIREMENTS

At 360px:

- NO horizontal scrolling
- Tables become stacked cards
- Sidebar becomes hamburger drawer
- Modals become full-screen sheets
- Primary page action becomes floating button
- Floating button = 56px
- Comfortable touch targets
- Readable typography
- Proper spacing

Mobile must feel designed specifically for mobile.

---

# 29. FLOATING ACTION BUTTON

Mobile only.

Size:

56px x 56px

Position:

bottom-right

Include:

- Default
- Hover
- Focus
- Pressed

Give it an accessible label.

---

# 30. ACCESSIBILITY

Every interactive element must be reachable with Tab.

Required:

- Visible focus ring
- Logical tab order
- Keyboard controls
- Accessible labels
- Semantic HTML
- aria-label for icon-only controls
- Labels for form controls
- Accessible modal controls

NEVER remove focus outlines without replacing them with an accessible focus style.

---

# 31. INTERACTIONS

The page must be an actual interactive design-system playground.

Implement:

- Tabs
- Dropdown
- Modal
- Drawer
- Toast
- Filters
- Button loading
- Button success
- Form error
- Mobile menu

Do not create fake static examples.

---

# 32. ANIMATION

Use premium restrained motion.

Use approximately:

150–250ms for micro-interactions.

Use smooth transitions for:

- Drawer
- Modal
- Dropdown
- Button states
- Card hover
- Skeleton

Avoid:

- Bouncy animation
- Excessive scaling
- Long animations
- Distracting movement

Respect reduced motion.

---

# 33. SPACING

Use a consistent spacing system.

Reuse existing T00 spacing variables.

If necessary create:

--space-1
--space-2
--space-3
--space-4
--space-5
--space-6
--space-8
--space-10
--space-12

Do NOT randomly assign spacing.

---

# 34. PREMIUM VISUAL DETAILS

Use subtle:

- Section numbers
- Token labels
- Semantic labels
- Fine dividers
- Status indicators
- Small icons
- Accent surfaces
- Editorial typography
- Micro-interactions

Everything should have a purpose.

---

# 35. THREE WIREFRAME DIRECTIONS

The final implementation must support these three visual modes.

## WIREFRAME 1 — DESKTOP 1440px

- Full sidebar
- Large content canvas
- Multi-column cards
- Full navigation
- Spacious layout
- Complete component showcase

## WIREFRAME 2 — TABLET 768px

- Sidebar hidden
- Hamburger
- Overlay drawer
- Two-column layout
- Touch-friendly controls

## WIREFRAME 3 — MOBILE 360px

- Compact header
- Stacked cards
- Full-width components
- Table-to-card conversion
- Full-screen modal sheets
- Floating 56px action button
- Zero horizontal overflow

---

# 36. IMPORTANT VISUAL RULE

The final result must look like a BEAUTIFUL PRODUCT DESIGN SYSTEM.

NOT:

"documentation"

NOT:

"component inventory"

NOT:

"developer reference"

Instead:

A premium interactive product-design workspace.

Use visual hierarchy and whitespace to make the system feel luxurious and intentional.

---

# 37. DO NOT BREAK EXISTING PROJECT

Before modifying anything:

Inspect first.

Do not:

- Delete unrelated files
- Rewrite the whole project
- Replace the framework
- Add unnecessary dependencies
- Change unrelated routes
- Change unrelated pages
- Remove existing assets

Reuse existing code whenever possible.

---

# 38. FINAL TEST

Test:

360px
768px
1024px
1440px

Verify:

- No horizontal overflow
- No broken layout
- No overlapping
- No clipped content
- Keyboard navigation
- Focus states
- Mobile menu
- Drawer
- Modal
- Dropdown
- Tabs
- Buttons
- Floating action
- Table conversion
- Loading
- Error
- Empty
- Success
- Locked states

---

# 39. DEFINITION OF DONE

Do NOT say complete just because the page loads.

It is complete only when:

- design-system.html exists
- It is the master visual reference
- All colors are represented
- All typography is represented
- All required components are represented
- All states are represented
- Components actually work
- Desktop is polished
- Tablet is polished
- Mobile is intentionally designed
- 360px works
- 768px works
- 1024px works
- 1440px works
- No horizontal scrolling
- Keyboard navigation works
- Focus indicators are visible
- All colors use CSS variables
- T00 Design System is reused
- Existing pages remain intact
- The final result looks premium, elegant and production-ready

After implementation, perform a final visual refinement pass.

Do not stop at functional.

Make it beautiful.
