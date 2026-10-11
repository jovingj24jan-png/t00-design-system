/* Nexora store — the records shown in the design system, plus routes and a prototype session.
   Records mirror the student table (section 06) and lesson plans (section 07) in design-system.js. */
(() => {
  'use strict';

  const students = [
    { id: 's1', name: 'Aarav Sharma', cls: 'Montessori A', status: 'Present', attendance: 96, progress: 82, guardian: 'Neha Sharma', note: 'Built the pink tower on his own and counted every cube aloud.' },
    { id: 's2', name: 'Diya Patel', cls: 'UKG B', status: 'Present', attendance: 92, progress: 74, guardian: 'Rakesh Patel', note: 'Read three-letter words with sandpaper letters.' },
    { id: 's3', name: 'Rohan Kumar', cls: 'LKG A', status: 'Late', attendance: 85, progress: 61, guardian: 'Anitha Kumar', note: 'Enjoyed pouring work; needs help finishing the cycle.' },
    { id: 's4', name: 'Meera Singh', cls: 'Nursery', status: 'Absent', attendance: 78, progress: 55, guardian: 'Harpreet Singh', note: 'Absent today. Last session: sorted colours with confidence.' },
    { id: 's5', name: 'Kabir Khan', cls: 'UKG A', status: 'Present', attendance: 99, progress: 90, guardian: 'Sana Khan', note: 'Helped a friend with the number rods.' }
  ];

  const lessons = [
    { id: 'l1', title: 'Practical life: pouring water', cls: 'Montessori', status: 'Active', teacher: 'Ms. Lakshmi' },
    { id: 'l2', title: 'Phonics: letter sounds s, a, t', cls: 'UKG', status: 'Active', teacher: 'Mr. Arjun' },
    { id: 'l3', title: 'Number rods 1–10', cls: 'Montessori', status: 'Pending', teacher: 'Ms. Lakshmi' },
    { id: 'l4', title: 'உயிர் எழுத்துகள் · Tamil vowels', cls: 'Tamil', status: 'Active', teacher: 'Ms. Kavitha' },
    { id: 'l5', title: 'Shapes and colours walk', cls: 'Nursery', status: 'Archived', teacher: 'Ms. Priya' },
    { id: 'l6', title: 'Story circle: The Lion and the Mouse', cls: 'LKG', status: 'Pending', teacher: 'Mr. Arjun' },
    { id: 'l7', title: 'Sandpaper letters', cls: 'Montessori', status: 'Archived', teacher: 'Ms. Lakshmi' },
    { id: 'l8', title: 'நிலா நிலா · Tamil rhymes', cls: 'Tamil', status: 'Pending', teacher: 'Ms. Kavitha' },
    { id: 'l9', title: 'Counting beads to 20', cls: 'LKG', status: 'Active', teacher: 'Ms. Priya' },
    { id: 'l10', title: 'Sensory bins: textures', cls: 'Nursery', status: 'Active', teacher: 'Ms. Priya' }
  ];

  // One shape for search results and record pages, whatever the record type.
  const records = [
    ...students.map(s => ({ id: s.id, type: 'student', title: s.name, subtitle: `${s.cls} · ${s.status}`, keywords: `${s.name} ${s.cls} ${s.status} ${s.guardian}`, data: s })),
    ...lessons.map(l => ({ id: l.id, type: 'lesson', title: l.title, subtitle: `${l.cls} · ${l.teacher}`, keywords: `${l.title} ${l.cls} ${l.status} ${l.teacher}`, data: l }))
  ];

  const routes = {
    dashboard: 'dashboard.html', // S04 — role-based daily overview
    designSystem: 'design-system.html',
    record: id => `record.html?id=${encodeURIComponent(id)}`,
    // Extra query values (e.g. { id }) are appended after the page key.
    page: (key, extra = {}) => {
      const q = new URLSearchParams({ page: key });
      Object.entries(extra).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, v); });
      return `app.html?${q}`;
    },
    denied: key => `access-denied.html?page=${encodeURIComponent(key)}`,
    // S01 sign-in. `school` picks a demo school; `next` returns a signed-out visitor to the page they asked for.
    signIn: ({ school, next } = {}) => {
      const q = new URLSearchParams();
      if (school) q.set('school', school);
      if (next) q.set('next', next);
      const s = q.toString();
      return `signin.html${s ? `?${s}` : ''}`;
    },
    firstLogin: 'first-login.html', // S03 — placeholder until the first-login flow is specified
    setup: 'setup.html', // S05 — first-time school setup wizard
    landing: 'dashboard.html', // S04 — the normal landing page after sign-in
    // Placeholder pages until password recovery, privacy and help content exist.
    forgotPassword: 'forgot-password.html', // S02
    privacy: 'support.html?topic=privacy',
    help: 'support.html?topic=help',
    // S61 — plans & upgrade. Optional target plan and the module that sent the user there.
    plans: ({ plan, module } = {}) => {
      const q = new URLSearchParams();
      if (plan) q.set('plan', plan);
      if (module) q.set('module', module);
      const s = q.toString();
      return `plans.html${s ? `?${s}` : ''}`;
    }
  };

  // Prototype only: there is no real sign-in. A flag stands in for a session; it never holds a
  // password or token. "Remember me" keeps it in localStorage (survives closing the browser);
  // otherwise it lives in sessionStorage and ends with the browser session.
  const SESSION_KEY = 'nexora-session';
  const session = {
    isSignedIn() {
      try { return localStorage.getItem(SESSION_KEY) === 'signed-in' || sessionStorage.getItem(SESSION_KEY) === 'signed-in'; } catch { return false; }
    },
    set(signedIn, { remember = true } = {}) {
      try {
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        if (signedIn) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, 'signed-in');
      } catch { /* storage blocked: stay signed out */ }
    }
  };

  /* ---------------------------------------------------------------- Roles, pages, permissions */

  // Prototype only: one demo user per role. The signed-in role is chosen in the sidebar.
  const roles = ['Teacher', 'Director', 'Accountant', 'Admin', 'Super Admin'];
  // firstLogin: the account has never completed S03 (first-login setup).
  const users = [
    { id: 'u-teacher', name: 'Ms. Lakshmi', role: 'Teacher', email: 'lakshmi@northvale.school', phone: '+91 98400 11111', schoolId: 'sch-northvale', firstLogin: true },
    { id: 'u-director', name: 'Mrs. Rao', role: 'Director', email: 'rao@northvale.school', phone: '+91 98400 22222', schoolId: 'sch-northvale', firstLogin: false },
    { id: 'u-accountant', name: 'Mr. Iyer', role: 'Accountant', email: 'iyer@northvale.school', phone: '+91 98400 33333', schoolId: 'sch-northvale', firstLogin: false },
    { id: 'u-admin', name: 'Ms. Fernandes', role: 'Admin', email: 'fernandes@northvale.school', phone: '+91 98400 44444', schoolId: 'sch-northvale', firstLogin: false },
    { id: 'u-super', name: 'Joving', role: 'Super Admin', email: 'joving@northvale.school', phone: '+91 98400 55555', schoolId: 'sch-northvale', firstLogin: false }
  ];

  /* ---------------------------------------------------------------- Subscription (prototype)
     One school, three plans ranked by tier. A module is available when the school's plan rank
     is at least the rank of the module's minimum plan. */

  // Demo school configuration (prototype fixture). Northvale is the school this app runs as;
  // the others exist to demo sign-in states: Enterprise + SSO (Riverside) and paused (Meadowbrook).
  // status: 'active' | 'paused'. A school without a logo shows its initials.
  const schools = [
    { id: 'sch-northvale', name: 'Northvale Academy', logo: 'assets/logos/northvale-crest.png', status: 'active', enterprise: false, ssoEnabled: false, email: 'office@northvale.school', phone: '+91 44 2345 6789' },
    { id: 'sch-riverside', name: 'Riverside Montessori', logo: null, status: 'active', enterprise: true, ssoEnabled: true },
    { id: 'sch-meadowbrook', name: 'Meadowbrook Children’s House', logo: null, status: 'paused', enterprise: false, ssoEnabled: false }
  ];
  const school = schools[0];
  const schoolById = id => schools.find(s => s.id === id) || null;
  const plans = [
    { id: 'starter', name: 'Starter', rank: 1, summary: 'Daily classroom essentials for a single school.' },
    { id: 'growth', name: 'Growth', rank: 2, summary: 'Admissions, fees and reporting for a growing school.' },
    { id: 'premium', name: 'Premium', rank: 3, summary: 'Staff payroll and safeguarding, with every module in one place.' }
  ];
  const MANAGE_PLAN_ROLES = ['Director', 'Admin', 'Super Admin'];

  // Module catalogue — the single source of truth for every school page: who may open it
  // (roles), which plan includes it (requiredPlan) and what it offers (prototype content).
  // Pages without requiredPlan (Notifications) are available on every plan.
  const pages = {
    attendance: {
      name: 'Attendance', icon: 'calendar-check', requiredPlan: 'starter',
      roles: ['Teacher', 'Director', 'Admin', 'Super Admin'],
      summary: 'Daily registers, late arrivals and absence follow-ups.',
      description: 'Take the register in seconds and see who is in, late or away across every classroom.',
      features: ['One-tap daily registers for each classroom', 'Late arrivals and early pick-ups recorded with times', 'Absence reasons captured from parents', 'Weekly attendance summaries for each child', 'Alerts when a child is absent several days in a row']
    },
    'classroom-tracker': {
      name: 'Classroom Tracker', icon: 'grid', requiredPlan: 'starter',
      roles: ['Teacher', 'Director', 'Admin', 'Super Admin'],
      summary: 'Daily work cycles, presentations and observations for each classroom.',
      description: 'Follow each child through the work cycle, from first presentation to independent mastery.',
      features: ['Presentation log for every material', 'Work cycle notes by child and by day', 'Progress stages from introduced to mastered', 'Planning view for the week ahead', 'Shared classroom view for co-teachers']
    },
    observations: {
      name: 'Observations', icon: 'eye', requiredPlan: 'starter',
      roles: ['Teacher', 'Director', 'Admin', 'Super Admin'],
      summary: 'Short notes and photos of what each child explores.',
      description: 'Capture what each child explores with quick notes and photos, then share the highlights with families.',
      features: ['Quick notes from a phone or tablet', 'Photos attached to each observation', 'Tags for areas of the classroom', 'Termly observation history per child', 'Selected observations shared with parents']
    },
    communication: {
      name: 'Announcements', icon: 'message', requiredPlan: 'starter',
      roles: ['Teacher', 'Director', 'Admin', 'Super Admin'],
      summary: 'Announcements and messages between school and families.',
      description: 'Keep families informed with announcements and direct messages in English and Tamil.',
      features: ['School-wide and class announcements', 'Direct messages between teachers and parents', 'Messages in English and Tamil', 'Read receipts for important notices', 'Quiet hours so staff are not messaged late']
    },
    gallery: {
      name: 'Gallery', icon: 'image', requiredPlan: 'starter',
      roles: ['Teacher', 'Director', 'Admin', 'Super Admin'],
      summary: 'Class photo albums shared privately with families.',
      description: 'Share the moments of the school day in private albums that only each class’s families can see.',
      features: ['Private albums for each class', 'Bulk photo upload from a phone', 'Children’s faces hidden for families without consent', 'Event albums for school celebrations', 'Download permissions set by the school']
    },
    admissions: {
      name: 'Admissions', icon: 'user-plus', requiredPlan: 'growth',
      roles: ['Director', 'Admin', 'Super Admin'],
      summary: 'Enquiries, visits and enrolment in one pipeline.',
      description: 'Move every family from first enquiry to enrolment without losing track of a visit or a form.',
      features: ['Enquiry pipeline from first contact to enrolment', 'School visit scheduling', 'Online application forms', 'Document checklist for each child', 'Waiting list by class and start date']
    },
    fees: {
      name: 'Fees', icon: 'wallet', requiredPlan: 'growth',
      roles: ['Director', 'Accountant', 'Admin', 'Super Admin'],
      summary: 'Fee schedules, payments received and reminders.',
      description: 'Set fee schedules once, record every payment and send gentle reminders when fees are due.',
      features: ['Fee schedules by class and term', 'Payments recorded with receipts', 'Gentle reminders before due dates', 'Sibling and scholarship discounts', 'Outstanding balance report']
    },
    reports: {
      name: 'Reports', icon: 'chart', requiredPlan: 'growth',
      roles: ['Director', 'Admin', 'Super Admin'],
      summary: 'Term reports, attendance trends and enrolment numbers.',
      description: 'See how the school is doing this term, from attendance trends to enrolment and fee collection.',
      features: ['Termly progress reports for families', 'Attendance trends by class', 'Enrolment and capacity overview', 'Fee collection summary', 'Exports for governors and inspections']
    },
    payroll: {
      name: 'Payroll', icon: 'banknote', requiredPlan: 'premium',
      roles: ['Director', 'Accountant', 'Super Admin'],
      summary: 'Staff salaries, deductions and monthly payslips.',
      description: 'Run staff salaries each month with deductions, payslips and a clear record of every payment.',
      features: ['Monthly salary runs for all staff', 'Deductions and allowances per person', 'Payslips staff can download', 'Leave linked to salary calculations', 'Year-end payroll summary']
    },
    safeguarding: {
      name: 'Health, Safety & Safeguarding', icon: 'shield-check', requiredPlan: 'premium',
      roles: ['Director', 'Super Admin'],
      summary: 'Safety procedures, safeguarding records and follow-ups.',
      description: 'Give your school a more structured way to manage safety procedures, safeguarding records, and essential follow-ups in one place.',
      features: ['Centralised health and safety records', 'Incident reporting and follow-up tracking', 'Safeguarding concerns and case records', 'Safety checks and compliance documentation', 'Authorised staff access and audit history']
    },
    // School pages that every plan includes. S17 and S58 read the same records the S05 setup saves.
    children: { name: 'Children', icon: 'users', roles: ['Teacher', 'Director', 'Accountant', 'Admin', 'Super Admin'], summary: 'Every child in the school: find anyone in seconds and see safety alerts at a glance.' },
    enrol: { name: 'Enrol child', icon: 'user-plus', roles: ['Director', 'Admin', 'Super Admin'], summary: 'Add a child to the school, or edit an existing child’s details.' },
    waitlist: { name: 'Waitlist', icon: 'clock', roles: ['Director', 'Admin', 'Super Admin'], summary: 'Children waiting for a seat in a full class.' },
    families: { name: 'Families', icon: 'users', roles: ['Teacher', 'Director', 'Accountant', 'Admin', 'Super Admin'], summary: 'Families as a unit: households, guardians, children and parent-app access.' },
    statement: { name: 'Family statement', icon: 'wallet', roles: ['Director', 'Accountant', 'Admin', 'Super Admin'], summary: 'Invoices and payments for one family, with a running balance.' },
    tours: { name: 'School Tours', icon: 'calendar-check', requiredPlan: 'growth', roles: ['Director', 'Admin', 'Super Admin'], summary: 'Tour slots, bookings linked to enquiries, and attendance.', description: 'Schedule school tours, keep guides from double-booking, link every visit to an enquiry and record who attended.', features: ['Recurring tour slots with capacity', 'Bookings linked to admissions enquiries', 'Attendance and no-show follow-ups', 'Guide clash checks'] },
    meetings: { name: 'Parent–Teacher Meetings', icon: 'calendar-check', roles: ['Teacher', 'Director', 'Admin', 'Super Admin'], summary: 'Teacher availability, family bookings and conference records with agreed actions.' },
    forms: { name: 'Forms & Permissions', icon: 'list', roles: ['Teacher', 'Director', 'Admin', 'Super Admin'], summary: 'Surveys, permission slips and acknowledgements, with signatures, reminders and results.' },
    messages: { name: 'Messages', icon: 'message', roles: ['Teacher', 'Director', 'Admin', 'Super Admin'], summary: 'Conversations with families, colleagues and class groups. (?family= shows one family’s message log.)' },
    family: { name: 'Family', icon: 'users', roles: ['Teacher', 'Director', 'Accountant', 'Admin', 'Super Admin'], summary: 'One family: households, guardians, children, parent app and balance.' },
    roster: { name: 'Class rosters', icon: 'grid', roles: ['Teacher', 'Director', 'Admin', 'Super Admin'], summary: 'Who is in each class, with capacity and schedules.' },
    compose: { name: 'Message families', icon: 'message', roles: ['Teacher', 'Director', 'Admin', 'Super Admin'], summary: 'Write to selected families. Prototype: messages are saved, not delivered.' },
    classes: { name: 'Classes', icon: 'grid', roles: ['Teacher', 'Director', 'Admin', 'Super Admin'], summary: 'Manage classrooms, capacity and today’s staffing.' },
    resources: { name: 'Rooms & Resources', icon: 'door', roles: ['Teacher', 'Director', 'Admin', 'Super Admin'], summary: 'Rooms and bookings, Montessori materials and repairs, the library and classroom stock.' },
    lessons: { name: 'Lesson Planning', icon: 'book', roles: ['Teacher', 'Director', 'Admin', 'Super Admin'], summary: 'Weekly plans, monthly themes, class timetable and the activity library, with review and approval.' },
    calendar: { name: 'Calendar & Events', icon: 'calendar-check', roles: ['Teacher', 'Director', 'Admin', 'Super Admin'], summary: 'School events, trips, meetings, closures and parent conferences, with RSVP and consent.' },
    diary: { name: 'Daily Diary', icon: 'book', roles: ['Teacher', 'Director', 'Admin', 'Super Admin'], summary: 'Meals, naps, toileting, mood, activities, notes and photos for each child, shared with families.' },
    class: { name: 'Class', icon: 'grid', roles: ['Teacher', 'Director', 'Admin', 'Super Admin'], summary: 'One class: roster, staff, today, routine and room.' },
    settings: { name: 'Settings', icon: 'grid', roles: ['Director', 'Admin', 'Super Admin'], summary: 'School details, academic year, school hours and preferences.' },
    notifications: { name: 'Notifications', icon: 'bell', roles: roles.slice(), summary: 'Updates and requests sent to you.' },
    'notification-settings': { name: 'Notification settings', icon: 'bell', roles: roles.slice(), summary: 'Choose which modules send you notifications.' }
  };

  const ROLE_KEY = 'nexora-demo-role';
  const FIRST_LOGIN_KEY = 'nexora-first-login-done';
  const REQUESTS_KEY = 'nexora-access-requests';
  const NOTIFICATIONS_KEY = 'nexora-notifications';
  const PLAN_KEY = 'nexora-school-plan';
  const UPGRADE_KEY = 'nexora-upgrade-requests';
  const ENQUIRY_KEY = 'nexora-enquiries';

  const read = (key, fallback) => {
    try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
  };
  /* Change events: every successful write tells subscribers which key changed, in this tab
     and (through the storage event) in other tabs. subscribe(fn) returns an unsubscribe function. */
  const listeners = new Set();
  function emit(key) {
    listeners.forEach(fn => { try { fn({ key }); } catch (err) { console.error(err); } });
  }
  const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  addEventListener('storage', e => { if (e.key === null || e.key.startsWith('nexora-')) emit(e.key); });

  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { return false; }
    emit(key);
    return true;
  };

  function currentUser() {
    let role = null;
    try { role = localStorage.getItem(ROLE_KEY); } catch { /* storage blocked */ }
    return users.find(u => u.role === role) || users[0];
  }
  function setRole(role) {
    if (!roles.includes(role)) return;
    try { localStorage.setItem(ROLE_KEY, role); } catch { /* storage blocked */ }
    emit(ROLE_KEY);
  }
  // First-login status comes from the user record, until S03 is completed on this device.
  const isFirstLogin = user => Boolean(user.firstLogin) && !read(FIRST_LOGIN_KEY, []).includes(user.id);
  const completeFirstLogin = user => write(FIRST_LOGIN_KEY, [...new Set([...read(FIRST_LOGIN_KEY, []), user.id])]);
  const pageByKey = key => (Object.prototype.hasOwnProperty.call(pages, key) ? { key, ...pages[key] } : null);
  const canAccess = (user, key) => { const p = pageByKey(key); return Boolean(p && p.roles.includes(user.role)); };

  /* ---------------------------------------------------------------- Access requests + notifications */

  const requests = () => read(REQUESTS_KEY, []);
  const findRequest = (user, key) => requests().find(r => r.userId === user.id && r.page === key) || null;


  // One request per user + page; repeat calls return the existing request.
  function requestAccess(user, key, reason = '') {
    const page = pageByKey(key);
    if (!page) return { ok: false };
    const existing = findRequest(user, key);
    if (existing) return { ok: true, created: false, request: existing };
    const request = {
      id: `r-${Date.now().toString(36)}`,
      userId: user.id, userName: user.name, role: user.role,
      page: key, pageName: page.name,
      reason: String(reason).trim().slice(0, 300),
      createdAt: new Date().toISOString()
    };
    if (!write(REQUESTS_KEY, [...requests(), request])) return { ok: false };
    notify('Director', {
      kind: 'access-request',
      title: `${request.role} requested access to ${request.pageName}.`,
      body: `${request.userName} (${request.role}) asked for access to ${request.pageName}.`,
      reason: request.reason,
      requestId: request.id,
      page: key
    });
    return { ok: true, created: true, request };
  }

  /* ---------------------------------------------------------------- Plans and entitlements */

  const planById = id => plans.find(p => p.id === id) || null;
  const moduleKeys = Object.keys(pages).filter(k => pages[k].requiredPlan);

  // Read fresh on every call so a plan change is picked up on the next page load (no cache).
  function currentPlan() {
    let id = null;
    try { id = localStorage.getItem(PLAN_KEY); } catch { /* storage blocked */ }
    return planById(id) || planById('starter');
  }
  const requiredPlanFor = key => { const p = pageByKey(key); return p && p.requiredPlan ? planById(p.requiredPlan) : null; };
  const isEntitled = (key, plan = currentPlan()) => {
    const required = requiredPlanFor(key);
    return !required || (plan && plan.rank >= required.rank);
  };
  const modulesInPlan = planId => { const plan = planById(planId); return moduleKeys.filter(k => isEntitled(k, plan)); };
  const canManagePlan = user => MANAGE_PLAN_ROLES.includes(user.role);

  function setSchoolPlan(user, planId) {
    if (!canManagePlan(user) || !planById(planId)) return { ok: false };
    try { localStorage.setItem(PLAN_KEY, planId); } catch { return { ok: false }; }
    emit(PLAN_KEY);
    return { ok: true, plan: planById(planId) };
  }

  /* ---------------------------------------------------------------- Upgrade requests + enquiries
     Prototype integration points: both resolve only after the record is actually saved, and
     report failure when it is not. Swap the bodies for real API calls later. */

  const upgradeRequests = () => read(UPGRADE_KEY, []);
  const findUpgradeRequest = (user, key) => upgradeRequests().find(r => r.userId === user.id && r.module === key) || null;
  const settle = value => new Promise(resolve => setTimeout(() => resolve(value), 350));

  function requestUpgrade(user, key) {
    const page = pageByKey(key);
    const required = requiredPlanFor(key);
    if (!page || !required) return settle({ ok: false });
    const existing = findUpgradeRequest(user, key);
    if (existing) return settle({ ok: true, created: false, request: existing });
    const request = {
      id: `u-${Date.now().toString(36)}`,
      schoolId: school.id, userId: user.id, userName: user.name, role: user.role,
      module: key, moduleName: page.name,
      currentPlan: currentPlan().id, requiredPlan: required.id,
      createdAt: new Date().toISOString()
    };
    const before = upgradeRequests();
    if (!write(UPGRADE_KEY, [...before, request])) return settle({ ok: false });
    // School administrators manage the subscription, so the request goes to the Admin role.
    // If the notification can't be saved, the request is rolled back: otherwise duplicate
    // prevention would show "Upgrade requested" for a request no admin ever received.
    if (!notify('Admin', {
      kind: 'upgrade-request',
      title: `${request.role} asked to upgrade for ${request.moduleName}.`,
      body: `${request.userName} (${request.role}) would like ${request.moduleName}. It needs the ${required.name} plan; ${school.name} is on ${currentPlan().name}.`,
      requestId: request.id,
      page: key,
      schoolId: request.schoolId,
      userId: request.userId,
      currentPlan: request.currentPlan,
      requiredPlan: request.requiredPlan
    })) { write(UPGRADE_KEY, before); return settle({ ok: false }); }
    return settle({ ok: true, created: true, request });
  }

  function submitEnquiry({ user, module, name, email, message, preferredTime, savedOffline = false }) {
    const enquiry = {
      id: `e-${Date.now().toString(36)}`,
      schoolId: school.id, userId: user.id, module,
      name: String(name).trim(), email: String(email).trim(), message: String(message).trim(),
      preferredTime, status: 'saved-locally', savedOffline, createdAt: new Date().toISOString()
    };
    if (!enquiry.name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(enquiry.email) || !enquiry.message) return settle({ ok: false, reason: 'invalid' });
    return settle(write(ENQUIRY_KEY, [...read(ENQUIRY_KEY, []), enquiry]) ? { ok: true, enquiry } : { ok: false });
  }

  /* ---------------------------------------------------------------- School data (S05 setup, S58 Settings, S17 Classes)
     One source of truth per school, keyed by school ID so schools never share records.
     Prototype only: kept in this browser's localStorage, not a server database. */

  const settingsKey = id => `nexora-settings:${id}`;
  const classesKey = id => `nexora-classes:${id}`;
  const staffKey = id => `nexora-staff-drafts:${id}`;
  const setupKey = id => `nexora-setup:${id}`;
  const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const CLASS_LEVELS = ['Toddler', 'Nursery', 'LKG', 'UKG', 'Montessori'];
  const STAFF_ROLES = ['Teacher', 'Director', 'Accountant', 'Admin'];

  // Settings sections: profile (S58 "School"), academicYear, hours, preferences.
  function defaultSettings(schoolId) {
    const s = schoolById(schoolId) || {};
    return {
      profile: { name: s.name || '', email: s.email || '', phone: s.phone || '', address: '' },
      academicYear: { name: '', start: '', end: '' },
      hours: { open: '', close: '', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
      preferences: { language: 'en', timeFormat: '12h' },
      updatedAt: null
    };
  }
  function getSettings(schoolId) {
    const base = defaultSettings(schoolId);
    const saved = read(settingsKey(schoolId), {});
    return {
      profile: { ...base.profile, ...saved.profile },
      academicYear: { ...base.academicYear, ...saved.academicYear },
      hours: { ...base.hours, ...saved.hours },
      preferences: { ...base.preferences, ...saved.preferences },
      updatedAt: saved.updatedAt || null
    };
  }
  function saveSettings(schoolId, section, values) {
    if (!['profile', 'academicYear', 'hours', 'preferences'].includes(section)) return false;
    const saved = read(settingsKey(schoolId), {});
    saved[section] = { ...values };
    saved.updatedAt = new Date().toISOString();
    return write(settingsKey(schoolId), saved);
  }

  // Class record (S17): { id, schoolId, name, level, section, capacity, createdAt, updatedAt }.
  // Students link to a class by its name, so a class with students can't be removed.
  const getClasses = schoolId => read(classesKey(schoolId), []).filter(c => c.schoolId === schoolId);
  const classStudentCount = (schoolId, name) => (schoolId === school.id ? students.filter(s => s.cls.toLowerCase() === String(name).trim().toLowerCase()).length : 0);
  function saveClasses(schoolId, list) {
    const now = new Date().toISOString();
    const before = getClasses(schoolId);
    const keep = new Set(list.map(c => c.id));
    const blocked = before.filter(c => !keep.has(c.id) && classStudentCount(schoolId, c.name) > 0);
    if (blocked.length) return { ok: false, reason: 'in-use', classes: blocked };
    const names = list.map(c => c.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) return { ok: false, reason: 'duplicate' };
    const next = list.map(c => {
      const old = before.find(b => b.id === c.id);
      return { id: c.id, schoolId, name: c.name.trim(), level: c.level, section: (c.section || '').trim(), capacity: c.capacity === '' || c.capacity == null ? null : Number(c.capacity), createdAt: old?.createdAt || now, updatedAt: now };
    });
    return write(classesKey(schoolId), next) ? { ok: true, classes: next } : { ok: false, reason: 'storage' };
  }

  // Staff entries from setup. No invitation service exists, so these stay drafts ("not invited yet").
  const getStaffDrafts = schoolId => read(staffKey(schoolId), []).filter(s => s.schoolId === schoolId);
  const saveStaffDrafts = (schoolId, list) => write(staffKey(schoolId), list.map(s => ({ id: s.id, schoolId, name: s.name.trim(), email: s.email.trim(), role: s.role, status: 'draft' })));

  // Setup progress: { status: 'not-started'|'in-progress'|'complete', currentStep, completed[], skipped[], drafts{}, lastSavedAt, completedAt }.
  const getSetup = schoolId => ({ status: 'not-started', currentStep: 1, completed: [], skipped: [], drafts: {}, lastSavedAt: null, completedAt: null, ...read(setupKey(schoolId), {}) });
  const saveSetup = (schoolId, patch) => write(setupKey(schoolId), { ...getSetup(schoolId), ...patch, lastSavedAt: new Date().toISOString() });


  function search(query, limit = 6) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const words = q.split(/\s+/);
    return records
      .map(r => {
        const hay = r.keywords.toLowerCase();
        if (!words.every(w => hay.includes(w))) return null;
        const score = r.title.toLowerCase().startsWith(q) ? 0 : r.title.toLowerCase().includes(q) ? 1 : 2;
        return { r, score };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score || a.r.title.localeCompare(b.r.title))
      .slice(0, limit)
      .map(x => x.r);
  }

  /* ---------------------------------------------------------------- Daily operations (S04 dashboard and its source pages)
     Attendance registers, staff on duty, class ratios, admission enquiries, fees, incidents,
     announcements and emergency broadcasts — one record set per school, keyed by school ID.
     Prototype only: seeded on first read and kept in this browser's localStorage. Every write
     checks the caller's role and the school's plan, the same rules the page guard uses, and
     resolves after the record is saved (or reports { ok: false }). */

  const pad2 = n => String(n).padStart(2, '0');
  const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const today = () => isoDate();
  const daysFromToday = n => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); };
  const atToday = (h, m, offsetDays = 0) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); d.setHours(h, m, 0, 0); return d.toISOString(); };
  const newId = prefix => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const can = (user, key) => canAccess(user, key) && isEntitled(key);

  // Seeds are saved without a change event: reading data must never notify subscribers.
  function seeded(key, make) {
    const saved = read(key, null);
    if (saved != null) return saved;
    const value = make();
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: seed stays in memory */ }
    return value;
  }

  // Classes the demo roster is seeded with. The live list is the S17 class registry (getClassRegistry).
  const ROSTER_SEED_CLASSES = [
    { name: 'Montessori A', level: 'Montessori' },
    { name: 'UKG A', level: 'UKG' },
    { name: 'UKG B', level: 'UKG' },
    { name: 'LKG A', level: 'LKG' },
    { name: 'Nursery', level: 'Nursery' }
  ];
  const ROSTER_NAMES = {
    'Montessori A': ['Ishaan Reddy', 'Ananya Iyer', 'Vihaan Nair', 'Saanvi Menon', 'Arjun Pillai', 'Kavya Rao', 'Aditya Joshi', 'Myra D’Souza', 'Reyansh Gupta', 'Anika Bose', 'Advik Chandran'],
    'UKG A': ['Zara Ahmed', 'Krish Malhotra', 'Aadhya Verma', 'Dhruv Kapoor', 'Ira Banerjee', 'Shaurya Das', 'Tara Fernandes', 'Yash Agarwal', 'Nila Murugan'],
    'UKG B': ['Aryan Mehta', 'Riya Sen', 'Kian Thomas', 'Pari Saxena', 'Atharv Kulkarni', 'Mahi Ghosh', 'Neel Varghese', 'Siya Chopra'],
    'LKG A': ['Veer Bhatia', 'Avni Hegde', 'Rudra Pandey', 'Diya Mathew', 'Om Prakash', 'Kiara Jain', 'Arnav Shetty', 'Meenakshi Sundaram'],
    Nursery: ['Aarush Yadav', 'Navya Krishnan', 'Ayaan Qureshi', 'Prisha Goel', 'Vivaan Srinivasan', 'Inaya Sheikh', 'Laksh Rajan', 'Ahana Dutta', 'Tanvi Raman']
  };
  let rosterSeq = 0;
  // Seed for the children records: the five design-system students first (same IDs), then the
  // rest of each class. Pages read the live roster (active children) through activeRoster().
  const rosterSeed = [
    ...students.map(s => ({ id: s.id, name: s.name, cls: s.cls })),
    ...Object.entries(ROSTER_NAMES).flatMap(([cls, names]) => names.map(name => ({ id: `r${++rosterSeq}`, name, cls })))
  ];

  /* ---------------------------------------------------------------- Children (S12 list, S13 record, S14 enrol)
     One record per child, seeded from the demo roster on first read and kept in localStorage:
     { id, firstName, lastName, dob, cls, status: 'active'|'starting'|'withdrawn'|'graduated',
       startDate, photo (asset path or null), guardian: { name, relation, phone, email },
       alerts: [{ type: 'allergy'|'medical'|'custody'|'dietary', detail }],
       withdrawal: { date, reason, by, at } | null, history: [{ at, by, action, detail }] }
     The live roster (attendance, fees, ratios) is every active child, so a class move or a
     withdrawal reaches those pages too. Every write checks the role and resolves after saving. */

  const childrenKey = id => `nexora-children:${id}`;
  const CHILD_STATUSES = { active: 'Active', starting: 'Starting soon', withdrawn: 'Withdrawn', graduated: 'Graduated' };
  const ALERT_TYPES = { allergy: 'Allergy', medical: 'Medical', custody: 'Custody', dietary: 'Dietary' };
  const CHILD_MANAGERS = ['Director', 'Admin', 'Super Admin'];
  const canManageChildren = user => CHILD_MANAGERS.includes(user.role);

  // Typical age in months on the seed date for each class level, before per-child variation.
  const BASE_AGE = { Nursery: 30, LKG: 42, UKG: 54, Montessori: 40 };
  const GUARDIAN_NAMES = ['Priya', 'Rahul', 'Lakshmi', 'Vikram', 'Deepa', 'Suresh', 'Anjali', 'Karthik', 'Meena', 'Arvind', 'Fatima', 'Joseph', 'Nandini', 'Ravi', 'Shalini', 'Imran', 'Geetha', 'Manoj'];
  const SEED_ALERTS = {
    'Aarav Sharma': [['allergy', 'Severe peanut allergy — EpiPen in office']],
    'Diya Patel': [['dietary', 'Vegetarian — no egg or gelatine']],
    'Rohan Kumar': [['medical', 'Asthma — blue inhaler in class bag; use before outdoor play']],
    'Meera Singh': [['custody', 'Court order on file: father may not collect. Collection by mother or grandmother only.']],
    'Ananya Iyer': [['allergy', 'Dairy allergy — lactose-free milk in the class fridge'], ['dietary', 'No cow’s milk products at snack time']],
    'Arjun Pillai': [['medical', 'Type 1 diabetes — glucose tablets in office; check before lunch']],
    'Zara Ahmed': [['allergy', 'Bee sting allergy — antihistamine syrup in office']],
    'Ira Banerjee': [['custody', 'Collection only by mother, Ms. Banerjee, or named nanny. Photo ID on file.']],
    'Riya Sen': [['medical', 'Epilepsy — seizure plan in office; call parent and 108 if over 3 minutes']],
    'Avni Hegde': [['dietary', 'Jain diet — no root vegetables']],
    'Kiara Jain': [['allergy', 'Egg allergy — mild; no EpiPen needed'], ['medical', 'Eczema — cream applied by staff after water play']],
    'Inaya Sheikh': [['dietary', 'Halal meals only']],
    'Navya Krishnan': [['allergy', 'Severe cashew and pistachio allergy — EpiPen in office and class bag'], ['custody', 'Shared custody: Mon–Wed mother, Thu–Fri father. Schedule in office.']]
  };
  // Children who aren't on today's roster: two joining soon, one withdrawn, one graduated.
  const SEED_EXTRA = [
    { id: 'c1', name: 'Advika Menon', cls: 'Nursery', status: 'starting', start: 10, age: 31 },
    { id: 'c2', name: 'Rehan Siddiqui', cls: 'LKG A', status: 'starting', start: 21, age: 40, alerts: [['dietary', 'Halal meals only']] },
    { id: 'c3', name: 'Lavanya Pillai', cls: 'UKG B', status: 'withdrawn', start: -400, age: 58, withdrawal: [-30, 'Family relocated to Bengaluru'] },
    { id: 'c4', name: 'Nikhil Varma', cls: 'Montessori A', status: 'graduated', start: -900, age: 75 }
  ];
  const monthsAgo = m => { const d = new Date(); d.setMonth(d.getMonth() - m); d.setDate(1 + ((m * 7) % 27)); return isoDate(d); };

  function seedChild({ id, name, cls }, i, extra = {}) {
    const [firstName, ...rest] = name.split(' ');
    const lastName = rest.join(' ');
    const level = classByName(cls).level;
    const known = students.find(s => s.id === id);
    const guardianFirst = known ? known.guardian.split(' ')[0] : GUARDIAN_NAMES[i % GUARDIAN_NAMES.length];
    const relation = i % 3 === 1 ? 'Father' : 'Mother';
    const alerts = (extra.alerts || SEED_ALERTS[name] || []).map(([type, detail]) => ({ type, detail }));
    const status = extra.status || 'active';
    return {
      id, firstName, lastName, cls, status, photo: null,
      dob: monthsAgo(extra.age || BASE_AGE[level] + ((i * 5) % 13)),
      startDate: extra.start != null ? daysFromToday(extra.start) : daysFromToday(-30 - ((i * 37) % 300)),
      guardian: { name: `${guardianFirst} ${lastName}`, relation, phone: `+91 98${String(4000000 + i * 7919).slice(0, 3)} ${String(10000 + i * 1373).slice(-5)}`, email: `${guardianFirst}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, '') + '@family.example' },
      alerts,
      withdrawal: extra.withdrawal ? { date: daysFromToday(extra.withdrawal[0]), reason: extra.withdrawal[1], by: 'Mrs. Rao', at: atToday(10, 0, extra.withdrawal[0]) } : null,
      history: [{ at: atToday(9, 0, extra.start != null ? Math.min(extra.start, 0) - 14 : -60), by: 'Mrs. Rao', action: 'enrolled', detail: `Enrolled in ${cls}` }]
    };
  }

  // Seeded on first read; older saved records are brought up to the S13 profile shape (saved without an event).
  function getChildren(schoolId = school.id) {
    const list = seeded(childrenKey(schoolId), () => [
      ...rosterSeed.map((s, i) => seedChild(s, i)),
      ...SEED_EXTRA.map((x, i) => seedChild(x, rosterSeed.length + i, x))
    ]);
    const guardians = read(guardiansKey(schoolId), []);
    let changed = false;
    list.forEach((c, i) => { if (normaliseChild(c, i, guardians)) changed = true; });
    // Scheduled class moves (S17 Move child) take effect on their date.
    list.forEach(c => {
      const m = c.pendingMove;
      if (!m || m.date > today()) return;
      if (['active', 'starting'].includes(c.status) && classByName(m.cls)?.status === 'active') applyMove({ name: m.by }, c, m.cls, ` (scheduled for ${m.date})`);
      else c.history = [...c.history, { at: new Date().toISOString(), by: 'System', action: 'move-cancelled', detail: `Scheduled move to ${m.cls} didn’t happen: the class or child is no longer active` }];
      delete c.pendingMove;
      changed = true;
    });
    if (changed) {
      try { localStorage.setItem(guardiansKey(schoolId), JSON.stringify(guardians)); localStorage.setItem(childrenKey(schoolId), JSON.stringify(list)); } catch { /* storage blocked: shape stays in memory */ }
    }
    return list;
  }
  const childById = id => getChildren().find(c => c.id === id) || null;
  const childName = c => `${c.firstName} ${c.lastName}`.trim();
  const activeRoster = () => getChildren().filter(c => c.status === 'active').map(c => ({ id: c.id, name: childName(c), cls: c.cls }));

  // Whole years and remaining months between a date of birth and today.
  function ageParts(dob, on = new Date()) {
    const b = new Date(`${dob}T00:00:00`);
    let months = (on.getFullYear() - b.getFullYear()) * 12 + (on.getMonth() - b.getMonth());
    if (on.getDate() < b.getDate()) months -= 1;
    months = Math.max(0, months);
    return { years: Math.floor(months / 12), months: months % 12, total: months };
  }

  function saveChildren(list, schoolId = school.id) { return write(childrenKey(schoolId), list); }
  const stamp = (user, action, detail) => ({ at: new Date().toISOString(), by: user.name, action, detail });

  function applyMove(user, c, cls, detail = '') {
    c.history = [...c.history, stamp(user, 'moved', `Moved from ${c.cls} to ${cls}${detail}`)];
    // A key teacher from the old class hands over to the new class's lead educator.
    if (!c.keyTeacher || staffOf(c.cls).some(e => e.name === c.keyTeacher)) c.keyTeacher = staffOf(cls)[0]?.name || '';
    c.cls = cls;
  }

  // Moves one or more children together: if any child can't move, nothing is saved.
  function moveChildren(user, ids, cls) {
    if (!canManageChildren(user)) return settle({ ok: false, reason: 'forbidden' });
    if (classByName(cls)?.status !== 'active') return settle({ ok: false, reason: 'invalid', errors: { cls: 'Choose a class to move to.' } });
    const list = getChildren();
    const targets = ids.map(id => list.find(c => c.id === id));
    if (!targets.length || targets.some(c => !c)) return settle({ ok: false, reason: 'missing' });
    const closed = targets.filter(c => ['withdrawn', 'graduated'].includes(c.status));
    if (closed.length) return settle({ ok: false, reason: 'closed', children: closed });
    let moved = 0;
    targets.forEach(c => {
      if (c.cls === cls) return;
      applyMove(user, c, cls);
      moved += 1;
    });
    if (!moved) return settle({ ok: false, reason: 'same', errors: { cls: `Already in ${cls}. Choose a different class.` } });
    return saveChildren(list) ? settle({ ok: true, moved, cls }) : settle({ ok: false, reason: 'storage' });
  }

  // Withdrawal keeps the record (status + reason); it never deletes the child.
  function withdrawChild(user, id, { date, reason }) {
    if (!canManageChildren(user)) return settle({ ok: false, reason: 'forbidden' });
    const errors = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) errors.date = 'Enter the last day the child attends.';
    if (!String(reason || '').trim()) errors.reason = 'Give a reason for the withdrawal.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const list = getChildren();
    const c = list.find(x => x.id === id);
    if (!c) return settle({ ok: false, reason: 'missing' });
    if (c.status === 'withdrawn') return settle({ ok: false, reason: 'closed' });
    c.status = 'withdrawn';
    c.withdrawal = { date, reason: String(reason).trim(), by: user.name, at: new Date().toISOString() };
    c.history = [...c.history, stamp(user, 'withdrawn', `Withdrawn from ${date}: ${c.withdrawal.reason}`)];
    return saveChildren(list) ? settle({ ok: true, child: c }) : settle({ ok: false, reason: 'storage' });
  }

  // Per-user page preferences (S12 grid/list view).
  const childPrefsKey = userId => `nexora-children-prefs:${userId}`;
  const getChildPrefs = user => ({ view: 'grid', ...read(childPrefsKey(user.id), {}) });
  const saveChildPrefs = (user, patch) => write(childPrefsKey(user.id), { ...getChildPrefs(user), ...patch });

  // S31 drafts: messages composed to families. Prototype only — nothing is delivered.
  const messagesKey = id => `nexora-family-messages:${id}`;
  const getFamilyMessages = (schoolId = school.id) => read(messagesKey(schoolId), []);
  function saveFamilyMessage(user, { recipients, subject, body, templateId = null }) {
    if (!can(user, 'communication')) return settle({ ok: false, reason: 'forbidden' });
    const errors = {};
    if (!recipients?.length) errors.recipients = 'Add at least one family.';
    if (!String(subject || '').trim()) errors.subject = 'Give the message a subject.';
    if (!String(body || '').trim()) errors.body = 'Write the message.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const msg = { id: newId('msg'), recipients, subject: subject.trim(), body: body.trim(), templateId, status: 'queued', createdAt: new Date().toISOString(), createdBy: user.name };
    return write(messagesKey(school.id), [msg, ...getFamilyMessages()]) ? settle({ ok: true, message: msg }) : settle({ ok: false, reason: 'storage' });
  }

  /* ---------------------------------------------------------------- S13 child profile
     Sections stored on the child record (normalised on read, so older saved records gain them):
       preferredName, keyTeacher, photo (data URL, set from the profile),
       guardianLinks [{ guardianId, relation, primary }] → shared guardian records (nexora-guardians),
       emergency [{ name, relation, phone }], pickup { authorised [{ name, relation, phone }], verification, passcode },
       medications [{ name, dose, storedAt }], careNotes, emergencyInstructions.
     Safety alerts stay in `alerts` (one source for S12 icons, the S13 banner and the editors):
       allergy/medical/dietary { type, detail, severity?, instructions? } · custody { type, detail, restrictedPerson? }.
     Diary, learning, documents and consents are their own record sets keyed by child ID.
     Every write checks the role (PROFILE_ACCESS) and is recorded in the audit log. */

  const guardiansKey = id => `nexora-guardians:${id}`;
  const auditKey = id => `nexora-audit:${id}`;
  const diaryKey = id => `nexora-diary:${id}`;
  const learningKey = id => `nexora-learning:${id}`;
  const docsKey = id => `nexora-child-docs:${id}`;
  const consentsKey = id => `nexora-consents:${id}`;

  const LEADERS = ['Director', 'Admin', 'Super Admin'];
  const CLASS_STAFF = ['Teacher', ...LEADERS];
  // Who can see (view) and change (edit) each profile section. Tabs tied to a module also need the module's
  // page role and the school's plan (module); safety alerts on the banner are never plan-locked.
  const PROFILE_ACCESS = {
    overview: { view: ['Teacher', 'Accountant', ...LEADERS], edit: LEADERS },
    identity: { view: ['Teacher', 'Accountant', ...LEADERS], edit: LEADERS },
    family: { view: ['Teacher', 'Accountant', ...LEADERS], edit: LEADERS },
    emergency: { view: CLASS_STAFF, edit: LEADERS },
    passcode: { view: CLASS_STAFF, edit: LEADERS },
    custody: { view: CLASS_STAFF, edit: LEADERS },
    medical: { view: CLASS_STAFF, edit: LEADERS },
    attendance: { view: CLASS_STAFF, edit: [], module: 'attendance' },
    diary: { view: CLASS_STAFF, edit: CLASS_STAFF },
    learning: { view: CLASS_STAFF, edit: CLASS_STAFF, module: 'classroom-tracker' },
    incidents: { view: ['Director', 'Super Admin'], edit: [], module: 'safeguarding' },
    documents: { view: CLASS_STAFF, edit: LEADERS },
    consents: { view: CLASS_STAFF, edit: LEADERS },
    conferences: { view: CLASS_STAFF, edit: [] },
    billing: { view: ['Director', 'Accountant', 'Admin', 'Super Admin'], edit: [], module: 'fees' }
  };
  const canView = (user, section) => Boolean(PROFILE_ACCESS[section]?.view.includes(user.role));
  const canEditSection = (user, section) => Boolean(PROFILE_ACCESS[section]?.edit.includes(user.role));
  const sectionModule = section => PROFILE_ACCESS[section]?.module || null;

  function logAudit(user, action, childId, detail = '') {
    const entry = { id: newId('au'), at: new Date().toISOString(), actorId: user.id, actorName: user.name, actorRole: user.role, action, childId, detail };
    const list = read(auditKey(school.id), []);
    list.unshift(entry);
    write(auditKey(school.id), list.slice(0, 500));
    return entry;
  }
  const getAudit = (childId = null) => read(auditKey(school.id), []).filter(e => !childId || e.childId === childId);

  /* Guardians: shared records so siblings point at the same person; removing a link never deletes one. */
  const getGuardians = () => read(guardiansKey(school.id), []);
  const guardianById = id => getGuardians().find(g => g.id === id) || null;
  const PROFILE_SEED = {
    'Meera Singh': { restrictedPerson: 'Manjit Singh' },
    'Aarav Sharma': { severity: 'severe', instructions: 'If symptoms appear: give EpiPen, call 108, then call parents.' },
    'Navya Krishnan': { severity: 'severe' },
    'Riya Sen': { medications: [{ name: 'Midazolam buccal', dose: 'As per seizure plan', storedAt: 'Office medicine cabinet' }] },
    'Rohan Kumar': { medications: [{ name: 'Salbutamol inhaler', dose: '2 puffs before outdoor play', storedAt: 'Class bag' }] },
    'Arjun Pillai': { medications: [{ name: 'Glucose tablets', dose: '1 if levels are low', storedAt: 'Office' }] }
  };

  // Brings any saved record up to the full profile shape. Returns true when it changed something.
  function normaliseChild(c, i, guardians) {
    let changed = false;
    const set = (k, v) => { if (c[k] === undefined) { c[k] = v; changed = true; } };
    const seed = PROFILE_SEED[childName(c)] || {};
    set('preferredName', '');
    set('keyTeacher', staffOf(c.cls)[0]?.name || '');
    if (!c.guardianLinks) {
      const findOrAdd = g => {
        const key = `${g.name.toLowerCase()}|${String(g.phone).replace(/\D/g, '')}`;
        let rec = guardians.find(x => `${x.name.toLowerCase()}|${x.phone.replace(/\D/g, '')}` === key);
        if (!rec) { rec = { id: `g-${guardians.length + 1}`, name: g.name, phone: g.phone, email: g.email || '', prefers: 'phone' }; guardians.push(rec); }
        return rec;
      };
      const primary = findOrAdd(c.guardian);
      c.guardianLinks = [{ guardianId: primary.id, relation: c.guardian.relation, primary: true }];
      // Most demo families have a second parent on file.
      if (i % 3 !== 2) {
        const other = c.guardian.relation === 'Mother' ? 'Father' : 'Mother';
        const first = GUARDIAN_NAMES[(i + 7) % GUARDIAN_NAMES.length];
        const second = findOrAdd({ name: `${first} ${c.lastName}`, phone: `+91 99${String(5000000 + i * 6151).slice(0, 3)} ${String(20000 + i * 1999).slice(-5)}`, email: '' });
        c.guardianLinks.push({ guardianId: second.id, relation: other, primary: false });
      }
      changed = true;
    }
    if (!c.emergency) {
      c.emergency = [{ name: `${GUARDIAN_NAMES[(i + 11) % GUARDIAN_NAMES.length]} ${c.lastName}`, relation: 'Grandparent', phone: `+91 97${String(3000000 + i * 4793).slice(0, 3)} ${String(30000 + i * 2711).slice(-5)}` }];
      changed = true;
    }
    if (!c.pickup) {
      const linked = c.guardianLinks.map(l => ({ g: guardians.find(x => x.id === l.guardianId), l })).filter(x => x.g);
      c.pickup = {
        authorised: linked.map(({ g, l }) => ({ name: g.name, relation: l.relation, phone: g.phone })),
        verification: 'Photo ID for anyone not known to the class team. Call the primary guardian before releasing to someone new.',
        passcode: String(1000 + ((i * 7919) % 9000))
      };
      changed = true;
    }
    set('medications', seed.medications || []);
    set('gender', '');
    set('languages', []);
    set('nationality', '');
    set('schedule', null);
    set('immunisations', []);
    set('doctor', { name: '', clinic: '', phone: '', notes: '' });
    set('dietaryNotes', '');
    set('liftedRestrictions', []);
    set('restrictionsDeclared', c.alerts.some(a => a.type === 'custody') ? 'recorded' : 'unknown');
    set('healthDeclared', { allergies: c.alerts.some(a => a.type === 'allergy') ? 'recorded' : 'unknown', conditions: c.alerts.some(a => a.type === 'medical') ? 'recorded' : 'unknown', medications: (c.medications || seed.medications || []).length ? 'recorded' : 'unknown' });
    if (c.pickup) c.pickup.authorised.forEach(p => { if (p.status === undefined) { p.status = 'authorised'; p.idRef = ''; changed = true; } if (!p.id) { p.id = newId('pk'); changed = true; } });
    c.medications.forEach(m => { if (m.consent === undefined) { m.consent = 'pending'; m.schedule = m.schedule || ''; m.notes = m.notes || ''; changed = true; } });
    c.guardianLinks.forEach(l => { if (l.livesWith === undefined) { l.livesWith = null; l.responsibility = null; changed = true; } });
    set('careNotes', '');
    set('emergencyInstructions', '');
    c.alerts.forEach(a => {
      if (a.type === 'custody' && a.restrictedPerson === undefined) { a.restrictedPerson = seed.restrictedPerson || ''; changed = true; }
      if (['allergy', 'medical'].includes(a.type) && a.severity === undefined) { a.severity = a.type === 'allergy' ? (seed.severity || (/\b(severe|moderate|mild)\b/i.exec(a.detail)?.[1].toLowerCase() ?? '')) : ''; changed = true; }
      if (['allergy', 'medical'].includes(a.type) && a.instructions === undefined) { a.instructions = a.type === 'allergy' ? (seed.instructions || '') : ''; changed = true; }
    });
    return changed;
  }

  // Keeps the denormalised `guardian` (used by S12 search, CSV and S31) equal to the primary link.
  function syncPrimary(c, guardians = getGuardians()) {
    const link = c.guardianLinks.find(l => l.primary) || c.guardianLinks[0];
    const g = link && guardians.find(x => x.id === link.guardianId);
    c.guardian = g ? { name: g.name, relation: link.relation, phone: g.phone, email: g.email } : { name: '', relation: '', phone: '', email: '' };
  }

  // Profile view of one child: record + linked guardians resolved.
  function childProfile(id) {
    const c = childById(id);
    if (!c) return null;
    const guardians = getGuardians();
    return { ...c, guardians: c.guardianLinks.map(l => ({ ...guardians.find(g => g.id === l.guardianId), relation: l.relation, primary: l.primary })).filter(g => g.id) };
  }

  const clean = v => String(v ?? '').trim();
  const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
  const phoneOk = v => clean(v).replace(/\D/g, '').length >= 10;
  const emailOk = v => !clean(v) || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean(v));
  const SEVERITIES_MED = ['severe', 'moderate', 'mild'];

  // Section validators: return { values, errors }. Row lists report errors as `rows.<index>.<field>`.
  const rowsCheck = (rows, rules, max = 8) => {
    const errors = {};
    const values = (rows || []).slice(0, max).map((r, i) => {
      const out = {};
      Object.entries(rules).forEach(([k, rule]) => {
        out[k] = clean(r[k]);
        const msg = rule(out[k], r);
        if (msg) errors[`rows.${i}.${k}`] = msg;
      });
      return out;
    });
    return { values, errors };
  };
  const req = label => v => (v ? '' : `Enter ${label}.`);
  const phoneRule = v => (phoneOk(v) ? '' : 'Enter a phone number with at least 10 digits.');

  const SECTION_RULES = {
    identity(v, c) {
      const errors = {};
      const values = { firstName: clean(v.firstName), lastName: clean(v.lastName), preferredName: clean(v.preferredName), dob: clean(v.dob), startDate: clean(v.startDate), keyTeacher: clean(v.keyTeacher) };
      if (!values.firstName) errors.firstName = 'Enter the child’s first name.';
      if (!values.lastName) errors.lastName = 'Enter the child’s last name.';
      if (!isDate(values.dob) || values.dob >= today()) errors.dob = 'Enter a date of birth in the past.';
      if (!isDate(values.startDate)) errors.startDate = 'Enter a start date.';
      if (values.keyTeacher && !educators.some(e => e.name === values.keyTeacher)) errors.keyTeacher = 'Choose a teacher from the list.';
      if (v.photo !== undefined) {
        if (v.photo && !/^data:image\/(png|jpeg|webp);base64,/.test(v.photo)) errors.photo = 'Use a PNG, JPEG or WebP image.';
        else if (v.photo && v.photo.length > 700000) errors.photo = 'Use an image under 500 KB.';
        else values.photo = v.photo || null;
      }
      void c;
      return { values, errors };
    },
    emergency: v => rowsCheck(v.rows, { name: req('a name'), relation: req('the relationship'), phone: phoneRule }, 4),
    pickup(v, c) {
      const r = rowsCheck(v.rows, { name: req('a name'), relation: req('the relationship'), phone: phoneRule, idRef: () => '', status: s => (['authorised', 'pending', 'suspended'].includes(s) ? '' : 'Choose a status.') }, 8);
      // Nobody can be authorised to collect while an active restriction names them.
      const barred = c.alerts.filter(a => a.type === 'custody' && a.status !== 'lifted' && a.restrictedPerson).map(a => a.restrictedPerson.trim().toLowerCase());
      r.values.forEach((p, i) => { if (p.status === 'authorised' && barred.includes(p.name.toLowerCase())) r.errors[`rows.${i}.name`] = `${p.name} is a restricted person. Lift the restriction first.`; });
      r.values = { authorised: r.values, verification: clean(v.verification) };
      return r;
    },
    custody: v => rowsCheck(v.rows, { detail: req('the restriction or court-order note'), restrictedPerson: () => '', relation: () => '', effective: d => (!d || isDate(d) ? '' : 'Enter a valid date or leave it blank.') }, 4),
    passcode(v) {
      const p = clean(v.passcode);
      return { values: { passcode: p }, errors: /^\d{4,8}$/.test(p) ? {} : { passcode: 'Use 4 to 8 digits.' } };
    },
    allergies: v => rowsCheck(v.rows, { detail: req('the allergy'), severity: s => (SEVERITIES_MED.includes(s) ? '' : 'Choose a severity.'), reaction: (x, r) => (r.severity === 'severe' && !clean(x) ? 'Describe the reaction for a severe allergy.' : ''), instructions: () => '' }),
    conditions: v => rowsCheck(v.rows, { detail: req('the condition'), instructions: () => '' }),
    medications: v => rowsCheck(v.rows, { name: req('the medication'), dose: req('the dose or instructions'), schedule: () => '', storedAt: () => '', consent: s => (['pending', 'given', 'declined'].includes(s) ? '' : 'Choose the consent status.') }),
    dietary: v => rowsCheck(v.rows, { detail: req('the dietary need') }),
    care: v => ({ values: { careNotes: clean(v.careNotes).slice(0, 2000), emergencyInstructions: clean(v.emergencyInstructions).slice(0, 2000) }, errors: {} })
  };
  // Which access rule guards each editable section.
  const SECTION_GUARD = { identity: 'identity', emergency: 'emergency', pickup: 'emergency', custody: 'custody', passcode: 'passcode', allergies: 'medical', conditions: 'medical', medications: 'medical', dietary: 'medical', care: 'medical' };
  const SECTION_LABEL = { identity: 'Child details', emergency: 'Emergency contacts', pickup: 'Authorised pickup', custody: 'Pickup restrictions', passcode: 'Pickup passcode', allergies: 'Allergies', conditions: 'Medical conditions', medications: 'Medication', dietary: 'Dietary needs', care: 'Care notes' };

  // Saves one section of one child. Only that section's fields change.
  function updateChildSection(user, id, section, input) {
    const guard = SECTION_GUARD[section];
    if (!guard || !canEditSection(user, guard)) return settle({ ok: false, reason: 'forbidden' });
    const list = getChildren();
    const c = list.find(x => x.id === id);
    if (!c) return settle({ ok: false, reason: 'missing' });
    if (!classScope(user).includes(c.cls)) return settle({ ok: false, reason: 'forbidden' });
    const { values, errors } = SECTION_RULES[section](input, c);
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const keepAlerts = types => c.alerts.filter(a => !types.includes(a.type));
    switch (section) {
      case 'identity': Object.assign(c, values); break;
      case 'emergency': c.emergency = values; break;
      case 'pickup': {
        // Contacts keep their ID while name and phone stay the same, so a changed person needs re-selecting at check-out.
        const prev = c.pickup?.authorised || [];
        const same = p => q => q.name.trim().toLowerCase() === p.name.trim().toLowerCase() && String(q.phone).replace(/\D/g, '') === String(p.phone).replace(/\D/g, '');
        values.authorised = values.authorised.map(p => ({ ...p, id: prev.find(same(p))?.id || newId('pk') }));
        c.pickup = { ...c.pickup, ...values };
        break;
      }
      case 'passcode': c.pickup = { ...c.pickup, passcode: values.passcode }; break;
      // Saving keeps attachments linked to the same entries, and an emptied list goes back to "not recorded", never "none".
      case 'custody': {
        const prev = c.alerts.filter(a => a.type === 'custody');
        c.alerts = [...keepAlerts(['custody']), ...values.map(r => ({ type: 'custody', detail: r.detail, restrictedPerson: r.restrictedPerson, relation: r.relation, effective: r.effective, status: 'active', docId: prev.find(p => p.restrictedPerson === r.restrictedPerson && p.detail === r.detail)?.docId || null }))];
        c.restrictionsDeclared = values.length ? 'recorded' : 'unknown';
        break;
      }
      case 'allergies': {
        const prev = c.alerts.filter(a => a.type === 'allergy');
        c.alerts = [...keepAlerts(['allergy']), ...values.map(r => ({ type: 'allergy', ...r, planDocId: prev.find(p => p.detail === r.detail)?.planDocId || null }))];
        c.healthDeclared = { ...c.healthDeclared, allergies: values.length ? 'recorded' : 'unknown' };
        break;
      }
      case 'conditions': c.alerts = [...keepAlerts(['medical']), ...values.map(r => ({ type: 'medical', detail: r.detail, severity: '', instructions: r.instructions }))]; c.healthDeclared = { ...c.healthDeclared, conditions: values.length ? 'recorded' : 'unknown' }; break;
      case 'dietary': c.alerts = [...keepAlerts(['dietary']), ...values.map(r => ({ type: 'dietary', detail: r.detail }))]; break;
      case 'medications': c.medications = values.map(m => { const p = c.medications.find(x => x.name === m.name); return { ...m, notes: p?.notes || '', docId: p?.docId || null }; }); c.healthDeclared = { ...c.healthDeclared, medications: values.length ? 'recorded' : 'unknown' }; break;
      case 'care': Object.assign(c, values); break;
    }
    // Passcodes are never written to history or the audit detail.
    c.history = [...c.history, stamp(user, 'edited', `${SECTION_LABEL[section]} updated`)];
    if (!saveChildren(list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, `edit:${section}`, id, `${SECTION_LABEL[section]} updated`);
    return settle({ ok: true, child: c });
  }

  // Guardians: add or edit one guardian for a child, or remove the link (the guardian record stays).
  function saveGuardianLink(user, childId, input, guardianId = null) {
    if (!canEditSection(user, 'family')) return settle({ ok: false, reason: 'forbidden' });
    const values = { name: clean(input.name), relation: clean(input.relation), phone: clean(input.phone), email: clean(input.email), prefers: clean(input.prefers) || 'phone', primary: Boolean(input.primary) };
    const errors = {};
    if (!values.name) errors.name = 'Enter the guardian’s name.';
    if (!values.relation) errors.relation = 'Choose the relationship.';
    if (!phoneOk(values.phone)) errors.phone = 'Enter a phone number with at least 10 digits.';
    if (!emailOk(values.email)) errors.email = 'Enter a valid email or leave it blank.';
    if (!['phone', 'whatsapp', 'email'].includes(values.prefers)) errors.prefers = 'Choose how they prefer to be contacted.';
    if (values.prefers === 'email' && !values.email) errors.email = 'Add an email to use it as the preferred contact.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const list = getChildren();
    const c = list.find(x => x.id === childId);
    if (!c) return settle({ ok: false, reason: 'missing' });
    const guardians = getGuardians();
    let g = guardianId && guardians.find(x => x.id === guardianId);
    if (g) Object.assign(g, { name: values.name, phone: values.phone, email: values.email, prefers: values.prefers });
    // S13 keeps one preferred channel; it is added to any channels already chosen on S16.
    if (g && Array.isArray(g.channels)) g.channels = [...new Set([...g.channels, values.prefers === 'phone' ? 'sms' : values.prefers])];
    else {
      g = { id: newId('g'), name: values.name, phone: values.phone, email: values.email, prefers: values.prefers };
      guardians.push(g);
    }
    let link = c.guardianLinks.find(l => l.guardianId === g.id);
    if (!link) { link = { guardianId: g.id, relation: values.relation, primary: false }; c.guardianLinks.push(link); }
    link.relation = values.relation;
    if (values.primary || c.guardianLinks.length === 1) c.guardianLinks.forEach(l => { l.primary = l === link; });
    // Shared record changed: refresh every linked child's primary snapshot.
    list.forEach(x => { if (x.guardianLinks?.some(l => l.guardianId === g.id)) syncPrimary(x, guardians); });
    c.history = [...c.history, stamp(user, 'edited', `${guardianId ? 'Guardian updated' : 'Guardian added'}: ${g.name}`)];
    if (!write(guardiansKey(school.id), guardians) || !saveChildren(list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, guardianId ? 'edit:guardian' : 'add:guardian', childId, g.name);
    return settle({ ok: true, guardian: g });
  }
  function unlinkGuardian(user, childId, guardianId) {
    if (!canEditSection(user, 'family')) return settle({ ok: false, reason: 'forbidden' });
    const list = getChildren();
    const c = list.find(x => x.id === childId);
    if (!c) return settle({ ok: false, reason: 'missing' });
    if (c.guardianLinks.length <= 1) return settle({ ok: false, reason: 'last', message: 'A child needs at least one guardian. Add another before removing this one.' });
    const link = c.guardianLinks.find(l => l.guardianId === guardianId);
    if (!link) return settle({ ok: false, reason: 'missing' });
    c.guardianLinks = c.guardianLinks.filter(l => l !== link);
    if (link.primary) c.guardianLinks[0].primary = true;
    syncPrimary(c);
    const g = guardianById(guardianId);
    c.history = [...c.history, stamp(user, 'edited', `Guardian removed from this child: ${g?.name || guardianId}`)];
    if (!saveChildren(list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'unlink:guardian', childId, g?.name || guardianId);
    return settle({ ok: true });
  }

  // Pickup passcode: only for authorised roles, and every reveal is audited (the code itself is never logged).
  function revealPasscode(user, childId) {
    const c = childById(childId);
    if (!c) return settle({ ok: false, reason: 'missing' });
    if (!canView(user, 'passcode') || !classScope(user).includes(c.cls)) return settle({ ok: false, reason: 'forbidden' });
    const entry = logAudit(user, 'reveal:passcode', childId, 'Pickup passcode revealed');
    return settle({ ok: true, passcode: c.pickup?.passcode || '', audit: entry });
  }

  /* Diary + learning: entries added by class staff. Learning uses the Montessori presentation stages. */
  const LEARNING_STAGES = { introduced: 'Introduced', practising: 'Practising', mastered: 'Mastered' };
  const LEARNING_AREAS = ['Practical life', 'Sensorial', 'Language', 'Mathematics', 'Culture'];
  const getDiary = childId => read(diaryKey(school.id), []).filter(e => e.childId === childId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const getLearning = childId => read(learningKey(school.id), []).filter(e => e.childId === childId).sort((a, b) => b.date.localeCompare(a.date));
  function saveEntry(kind, user, childId, input, entryId = null) {
    const section = kind === 'diary' ? 'diary' : 'learning';
    if (!canEditSection(user, section) || (sectionModule(section) && !isEntitled(sectionModule(section)))) return settle({ ok: false, reason: 'forbidden' });
    const c = childById(childId);
    if (!c || !classScope(user).includes(c.cls)) return settle({ ok: false, reason: 'forbidden' });
    const errors = {};
    let values;
    if (kind === 'diary') {
      values = { date: clean(input.date), title: clean(input.title), meals: clean(input.meals), rest: clean(input.rest), notes: clean(input.notes) };
      if (!isDate(values.date) || values.date > today()) errors.date = 'Enter today or an earlier date.';
      if (!values.title) errors.title = 'Give the entry a short title.';
      if (!values.notes && !values.meals && !values.rest) errors.notes = 'Add notes, meals or rest.';
    } else {
      values = { date: clean(input.date), area: clean(input.area), material: clean(input.material), stage: clean(input.stage), observation: clean(input.observation) };
      if (!isDate(values.date) || values.date > today()) errors.date = 'Enter today or an earlier date.';
      if (!LEARNING_AREAS.includes(values.area)) errors.area = 'Choose a learning area.';
      if (!values.material) errors.material = 'Enter the activity or material.';
      if (!LEARNING_STAGES[values.stage]) errors.stage = 'Choose a stage.';
    }
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const key = kind === 'diary' ? diaryKey(school.id) : learningKey(school.id);
    const all = read(key, []);
    let entry = entryId && all.find(e => e.id === entryId && e.childId === childId);
    if (entry) Object.assign(entry, values, { updatedAt: new Date().toISOString(), updatedBy: user.name });
    else { entry = { id: newId(kind === 'diary' ? 'dy' : 'ln'), childId, ...values, author: user.name, createdAt: new Date().toISOString() }; all.push(entry); }
    if (!write(key, all)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, `${entryId ? 'edit' : 'add'}:${kind}`, childId, values.title || values.material);
    return settle({ ok: true, entry });
  }

  /* Documents: real files only (PDF, JPEG, PNG up to 1 MB), stored as data URLs on this device. */
  const DOC_TYPES = { 'application/pdf': 'PDF', 'image/jpeg': 'JPEG', 'image/png': 'PNG' };
  const DOC_CATEGORIES = ['Birth certificate', 'Immunisation record', 'Medical plan', 'Court order', 'Address proof', 'Other'];
  const DOC_MAX = 1024 * 1024;
  const getDocuments = childId => read(docsKey(school.id), []).filter(d => d.childId === childId).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  function addDocument(user, childId, input) {
    if (!canEditSection(user, 'documents')) return settle({ ok: false, reason: 'forbidden' });
    const errors = {};
    const values = { name: clean(input.name), category: clean(input.category), expiry: clean(input.expiry), fileName: clean(input.fileName), mime: clean(input.mime), size: Number(input.size) || 0, data: String(input.data || '') };
    if (!values.data) errors.file = 'Choose a file to upload.';
    else if (!DOC_TYPES[values.mime]) errors.file = 'Upload a PDF, JPEG or PNG file.';
    else if (values.size > DOC_MAX) errors.file = 'Upload a file of 1 MB or less.';
    if (!values.name) errors.name = 'Give the document a name.';
    if (!DOC_CATEGORIES.includes(values.category)) errors.category = 'Choose a category.';
    if (values.expiry && !isDate(values.expiry)) errors.expiry = 'Enter a valid date or leave it blank.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const doc = { id: newId('doc'), childId, ...values, status: 'unverified', uploadedAt: new Date().toISOString(), uploadedBy: user.name };
    if (!write(docsKey(school.id), [...read(docsKey(school.id), []), doc])) return settle({ ok: false, reason: 'storage', message: 'This file is too large to keep on this device. Try a smaller file.' });
    logAudit(user, 'add:document', childId, values.name);
    return settle({ ok: true, document: doc });
  }
  function verifyDocument(user, childId, docId, verified) {
    if (!canEditSection(user, 'documents')) return settle({ ok: false, reason: 'forbidden' });
    const all = read(docsKey(school.id), []);
    const d = all.find(x => x.id === docId && x.childId === childId);
    if (!d) return settle({ ok: false, reason: 'missing' });
    Object.assign(d, { status: verified ? 'verified' : 'unverified', verifiedBy: verified ? user.name : null, verifiedAt: verified ? new Date().toISOString() : null });
    if (!write(docsKey(school.id), all)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, verified ? 'verify:document' : 'unverify:document', childId, d.name);
    return settle({ ok: true, document: d });
  }

  /* Consents: one record per category; a category with no record is Pending, never Granted. */
  const CONSENT_TYPES = [
    { id: 'photos-gallery', label: 'Photos in the parent gallery' },
    { id: 'photos-social', label: 'Photos on school social media' },
    { id: 'outings', label: 'Local walks and outings' },
    { id: 'first-aid', label: 'Emergency medical treatment' },
    { id: 'sun-cream', label: 'Applying sun cream' },
    { id: 'sharing', label: 'Sharing records with specialists' }
  ];
  const CONSENT_STATUSES = { granted: 'Granted', pending: 'Pending', declined: 'Declined', expired: 'Expired' };
  function getConsents(childId) {
    const saved = read(consentsKey(school.id), []).filter(x => x.childId === childId);
    return CONSENT_TYPES.map(t => {
      const r = saved.find(x => x.type === t.id);
      if (!r) return { type: t.id, label: t.label, status: 'pending', respondedBy: '', date: '', expires: '' };
      const status = r.status === 'granted' && r.expires && r.expires < today() ? 'expired' : r.status;
      return { ...r, label: t.label, status };
    });
  }
  function saveConsent(user, childId, input) {
    if (!canEditSection(user, 'consents')) return settle({ ok: false, reason: 'forbidden' });
    const values = { type: clean(input.type), status: clean(input.status), respondedBy: clean(input.respondedBy), date: clean(input.date), expires: clean(input.expires) };
    const errors = {};
    if (!CONSENT_TYPES.some(t => t.id === values.type)) errors.type = 'Unknown consent.';
    if (!['granted', 'declined', 'pending'].includes(values.status)) errors.status = 'Choose a response.';
    if (values.status !== 'pending' && !values.respondedBy) errors.respondedBy = 'Choose which guardian responded.';
    if (values.status !== 'pending' && (!isDate(values.date) || values.date > today())) errors.date = 'Enter the date of the response.';
    if (values.expires && (!isDate(values.expires) || (values.date && values.expires <= values.date))) errors.expires = 'The expiry must be after the response date.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const all = read(consentsKey(school.id), []).filter(x => !(x.childId === childId && x.type === values.type));
    all.push({ childId, ...values, recordedBy: user.name, recordedAt: new Date().toISOString() });
    if (!write(consentsKey(school.id), all)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'edit:consent', childId, `${CONSENT_TYPES.find(t => t.id === values.type).label}: ${CONSENT_STATUSES[values.status]}`);
    return settle({ ok: true });
  }

  /* Attendance: only registers actually saved on this device (no invented history). */
  function attendanceFor(childId) {
    const prefix = `nexora-register:${school.id}:`;
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith(prefix)) continue;
        const reg = read(k, {});
        Object.entries(reg).forEach(([cls, r]) => { if (r?.marks?.[childId]) out.push({ date: k.slice(prefix.length), cls, mark: r.marks[childId], takenBy: r.takenBy, takenAt: r.takenAt }); });
      }
    } catch { /* storage blocked */ }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }


  /* ---------------------------------------------------------------- S14 enrolment wizard, S09 waitlist, S15 families, S18 roster
     Classes: capacity comes from the S17 class record when one exists for the name, otherwise from
     the school's class configuration (nexora-class-config); occupancy is counted from the children
     records (active + starting soon), never stored, so it can't drift.
     Households group guardians; a child links to 1–2 households through guardianLinks[].householdId.
     enrolChild() validates every step, re-checks duplicates, capacity and pickup conflicts, then saves
     all related records together and rolls back if any write fails. */

  const classConfigKey = id => `nexora-class-config:${id}`;
  const householdsKey = id => `nexora-households:${id}`;
  const waitlistKey = id => `nexora-waitlist:${id}`;
  const draftsKey = id => `nexora-enrol-drafts:${id}`;

  const GENDERS = [['', 'Not answered'], ['girl', 'Girl'], ['boy', 'Boy'], ['another', 'Another gender'], ['prefer-not', 'Prefer not to say']];
  const LANGUAGES = ['English', 'Tamil', 'Hindi', 'Telugu', 'Kannada', 'Malayalam', 'Urdu', 'Bengali', 'Marathi', 'Gujarati', 'Punjabi', 'Arabic', 'French', 'Mandarin', 'Other'];
  const COUNTRIES = ['India', 'Sri Lanka', 'Bangladesh', 'Nepal', 'Pakistan', 'United Arab Emirates', 'Saudi Arabia', 'Singapore', 'Malaysia', 'United Kingdom', 'United States', 'Canada', 'Australia', 'New Zealand', 'Germany', 'France', 'Japan', 'South Africa', 'Kenya', 'Other'];
  const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Dairy-free', 'Gluten-free', 'Egg-free', 'Jain', 'Halal', 'Kosher', 'Religious requirement', 'Other'];
  const SESSIONS = { full: 'Full day', morning: 'Morning', afternoon: 'Afternoon' };
  const DECLARATIONS = { recorded: 'Recorded below', none: 'None — confirmed by family', unknown: 'Not yet collected' };
  const PICKUP_STATUS = { authorised: 'Authorised', pending: 'Pending verification', suspended: 'Suspended' };
  const RESTRICTION_STATUS = { active: 'Active', lifted: 'Lifted' };
  const MED_CONSENT = { pending: 'Consent not yet given', given: 'Written consent on file', declined: 'Consent declined' };

  // Demo configuration until S17 gives every class a capacity. Nursery is full on purpose (waitlist demo).
  const getClassConfig = () => seeded(classConfigKey(school.id), () => ({ 'Montessori A': 14, 'UKG A': 12, 'UKG B': 10, 'LKG A': 12, Nursery: 11 }));
  const schoolDays = () => getSettings(school.id).hours.days?.length ? getSettings(school.id).hours.days : ['mon', 'tue', 'wed', 'thu', 'fri'];

  // One class: teacher, capacity, occupancy (current children, optionally excluding one child being edited).
  function classInfo(name, excludeId = null) {
    const c = classByName(name);
    if (!c) return null;
    const capacity = Number.isInteger(c.capacity) && c.capacity > 0 ? c.capacity : null;
    const occupancy = getChildren().filter(k => k.cls === name && ['active', 'starting'].includes(k.status) && k.id !== excludeId).length;
    return { name, level: c.level, teacher: staffOf(name)[0]?.name || '', archived: c.status === 'archived', capacity, occupancy, remaining: capacity == null ? null : Math.max(0, capacity - occupancy), full: capacity != null && occupancy >= capacity };
  }
  const classesInfo = (excludeId = null) => activeClasses().map(c => classInfo(c.name, excludeId));

  /* Households: seeded from the existing guardian links (siblings share one), saved without an event. */
  function getHouseholds() {
    const saved = read(householdsKey(school.id), null);
    if (saved) return saved;
    const list = [];
    const children = getChildren();
    children.forEach(c => {
      const ids = c.guardianLinks.map(l => l.guardianId).sort();
      let h = list.find(x => x.guardianIds.slice().sort().join() === ids.join());
      if (!h) { h = { id: `h-${list.length + 1}`, label: `${c.lastName} household`, guardianIds: ids }; list.push(h); }
      c.guardianLinks.forEach(l => { if (!l.householdId) l.householdId = h.id; });
    });
    try { localStorage.setItem(householdsKey(school.id), JSON.stringify(list)); localStorage.setItem(childrenKey(school.id), JSON.stringify(children)); } catch { /* in memory */ }
    return list;
  }
  // Families for search (S14 step 2) and S15: household + guardians + linked children.
  function families(query = '') {
    const q = clean(query).toLowerCase();
    const households = getHouseholds();
    const guardians = getGuardians();
    const children = getChildren();
    return households.map(h => ({
      ...h,
      guardians: h.guardianIds.map(id => guardians.find(g => g.id === id)).filter(Boolean),
      children: children.filter(c => c.guardianLinks?.some(l => l.householdId === h.id)).map(c => ({ id: c.id, name: childName(c), cls: c.cls, status: c.status }))
    })).filter(f => !q || [f.label, ...f.guardians.map(g => `${g.name} ${g.phone} ${g.email}`), ...f.children.map(c => c.name)].join(' ').toLowerCase().includes(q));
  }

  /* Duplicates: same normalised first + last name and date of birth (drafts excluded, the edited child excluded). */
  const norm = s => clean(s).toLowerCase().replace(/\s+/g, ' ');
  function findDuplicates({ firstName, lastName, dob }, excludeId = null) {
    if (!norm(firstName) || !norm(lastName) || !isDate(dob)) return [];
    return getChildren().filter(c => c.id !== excludeId && norm(c.firstName) === norm(firstName) && norm(c.lastName) === norm(lastName) && c.dob === dob)
      .map(c => ({ id: c.id, name: childName(c), cls: c.cls, status: c.status }));
  }

  /* Waitlist (S09). */
  const getWaitlist = () => read(waitlistKey(school.id), []);
  function addToWaitlist(user, input) {
    if (!canManageChildren(user)) return settle({ ok: false, reason: 'forbidden' });
    const v = { firstName: clean(input.firstName), lastName: clean(input.lastName), dob: clean(input.dob), cls: clean(input.cls), startDate: clean(input.startDate), guardianName: clean(input.guardianName), guardianPhone: clean(input.guardianPhone), notes: clean(input.notes) };
    const errors = {};
    if (!v.firstName || !v.lastName) errors.name = 'Enter the child’s first and last name.';
    if (!isDate(v.dob) || v.dob >= today()) errors.dob = 'Enter a date of birth in the past.';
    if (classByName(v.cls)?.status !== 'active') errors.cls = 'Choose the class requested.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const list = getWaitlist();
    // One open entry per child and class: re-adding updates it instead of duplicating.
    let entry = list.find(w => w.status === 'waiting' && w.cls === v.cls && norm(w.firstName) === norm(v.firstName) && norm(w.lastName) === norm(v.lastName) && w.dob === v.dob);
    if (entry) Object.assign(entry, v, { updatedAt: new Date().toISOString() });
    else { entry = { id: newId('wl'), ...v, status: 'waiting', addedBy: user.name, createdAt: new Date().toISOString() }; list.push(entry); }
    if (!write(waitlistKey(school.id), list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'add:waitlist', entry.id, `${v.firstName} ${v.lastName} · ${v.cls}`);
    return settle({ ok: true, entry, position: list.filter(w => w.status === 'waiting' && w.cls === v.cls).indexOf(entry) + 1 });
  }

  /* Drafts: never children records, so they never count as enrolled. One draft per child being edited. */
  const getDrafts = () => read(draftsKey(school.id), []);
  function saveDraft(user, { id, childId = null, step, data }) {
    if (!canManageChildren(user)) return settle({ ok: false, reason: 'forbidden' });
    const list = getDrafts();
    let d = list.find(x => x.id === id) || (childId && list.find(x => x.childId === childId));
    const now = new Date().toISOString();
    // Files are kept as references to stored documents, not re-saved inside the draft.
    if (d) Object.assign(d, { step, data, updatedAt: now, updatedBy: user.name });
    else { d = { id: id || newId('dr'), childId, step, data, createdAt: now, createdBy: user.name, updatedAt: now, updatedBy: user.name }; list.push(d); }
    return write(draftsKey(school.id), list) ? settle({ ok: true, draft: d }) : settle({ ok: false, reason: 'storage', message: 'The draft is too large to keep on this device. Remove the photo or a document and try again.' });
  }
  function deleteDraft(user, id) {
    if (!canManageChildren(user)) return false;
    return write(draftsKey(school.id), getDrafts().filter(d => d.id !== id));
  }

  /* Full enrolment / edit. payload mirrors the five wizard steps. */
  const SAFE_NAME = v => clean(v).slice(0, 80);
  function validateEnrolment(p, { childId = null } = {}) {
    const e = {};
    const s1 = p.child || {};
    if (!clean(s1.firstName)) e['child.firstName'] = 'Enter the child’s first name.';
    if (!clean(s1.lastName)) e['child.lastName'] = 'Enter the child’s last name.';
    if (!isDate(s1.dob) || s1.dob > today()) e['child.dob'] = 'Enter a date of birth that isn’t in the future.';
    else if (ageParts(s1.dob).years > 12) e['child.dob'] = 'Check the date of birth — the child would be over 12.';
    if (s1.gender && !GENDERS.some(([k]) => k === s1.gender)) e['child.gender'] = 'Choose an option from the list.';
    if ((s1.languages || []).some(l => !LANGUAGES.includes(l))) e['child.languages'] = 'Choose languages from the list.';
    if (s1.photo && (!/^data:image\/(png|jpeg|webp);base64,/.test(s1.photo) || s1.photo.length > 700000)) e['child.photo'] = 'Use a PNG, JPEG or WebP image under 500 KB.';

    const gs = p.guardians || [];
    if (!gs.length) e['guardians'] = 'Add at least one guardian.';
    gs.forEach((g, i) => {
      if (!clean(g.name)) e[`guardians.${i}.name`] = 'Enter the guardian’s name.';
      if (!clean(g.relation)) e[`guardians.${i}.relation`] = 'Choose the relationship.';
      if (!phoneOk(g.phone)) e[`guardians.${i}.phone`] = 'Enter a phone number with at least 10 digits.';
      if (!emailOk(g.email)) e[`guardians.${i}.email`] = 'Enter a valid email or leave it blank.';
      if (![1, 2].includes(Number(g.household))) e[`guardians.${i}.household`] = 'Choose a household.';
    });
    if (gs.length && gs.filter(g => g.primary).length !== 1) e['guardians'] = 'Choose exactly one primary contact.';

    const em = p.emergency || [];
    if (!em.length) e['emergency'] = 'Add at least one emergency contact.';
    em.forEach((c, i) => {
      if (!clean(c.name)) e[`emergency.${i}.name`] = 'Enter a name.';
      if (!clean(c.relation)) e[`emergency.${i}.relation`] = 'Enter the relationship.';
      if (!phoneOk(c.phone)) e[`emergency.${i}.phone`] = 'Enter a phone number with at least 10 digits.';
    });
    const pk = p.pickup || [];
    if (!pk.some(x => x.status === 'authorised')) e['pickup'] = 'Authorise at least one person to collect the child.';
    pk.forEach((x, i) => {
      if (!clean(x.name)) e[`pickup.${i}.name`] = 'Enter a name.';
      if (!clean(x.relation)) e[`pickup.${i}.relation`] = 'Enter the relationship.';
      if (!PICKUP_STATUS[x.status]) e[`pickup.${i}.status`] = 'Choose a status.';
      if (x.phone && !phoneOk(x.phone)) e[`pickup.${i}.phone`] = 'Enter a phone number with at least 10 digits.';
    });
    if (!['none', 'recorded', 'unknown'].includes(p.restrictionsDeclared)) e['restrictionsDeclared'] = 'Say whether any custody or contact restrictions apply.';
    const rs = p.restrictions || [];
    if (p.restrictionsDeclared === 'recorded' && !rs.length) e['restrictions'] = 'Add the restricted person, or change the answer above.';
    rs.forEach((r, i) => {
      if (!clean(r.name)) e[`restrictions.${i}.name`] = 'Enter the person’s name.';
      if (!clean(r.reason)) e[`restrictions.${i}.reason`] = 'Give the reason (for example, the court order).';
      if (r.effective && !isDate(r.effective)) e[`restrictions.${i}.effective`] = 'Enter a valid date or leave it blank.';
      if (!RESTRICTION_STATUS[r.status]) e[`restrictions.${i}.status`] = 'Choose a status.';
    });
    // The same person can't be both allowed and barred from collecting the child.
    const barred = rs.filter(r => r.status === 'active').map(r => norm(r.name));
    pk.forEach((x, i) => { if (x.status === 'authorised' && barred.includes(norm(x.name))) e[`pickup.${i}.name`] = `${clean(x.name)} is also listed as a restricted person. Remove one of the two before saving.`; });

    const h = p.health || {};
    ['allergies', 'conditions', 'medications'].forEach(k => {
      if (!DECLARATIONS[h[`${k}Declared`]]) e[`health.${k}Declared`] = 'Choose one answer.';
      if (h[`${k}Declared`] === 'recorded' && !(h[k] || []).length) e[`health.${k}`] = 'Add at least one entry, or change the answer above.';
    });
    (h.allergies || []).forEach((a, i) => {
      if (!clean(a.allergen)) e[`health.allergies.${i}.allergen`] = 'Enter the allergen.';
      if (!['severe', 'moderate', 'mild'].includes(a.severity)) e[`health.allergies.${i}.severity`] = 'Choose a severity.';
      if (a.severity === 'severe' && !clean(a.reaction)) e[`health.allergies.${i}.reaction`] = 'Describe the reaction for a severe allergy.';
    });
    (h.conditions || []).forEach((c, i) => { if (!clean(c.name)) e[`health.conditions.${i}.name`] = 'Enter the condition.'; });
    (h.medications || []).forEach((m, i) => {
      if (!clean(m.name)) e[`health.medications.${i}.name`] = 'Enter the medication.';
      if (!clean(m.dose)) e[`health.medications.${i}.dose`] = 'Enter the dose or instructions.';
      if (!MED_CONSENT[m.consent]) e[`health.medications.${i}.consent`] = 'Choose the consent status.';
    });
    if ((h.dietary || []).some(d => !DIETARY_OPTIONS.includes(d))) e['health.dietary'] = 'Choose dietary needs from the list.';
    if ((h.dietary || []).includes('Other') && !clean(h.dietaryNotes)) e['health.dietaryNotes'] = 'Describe the other dietary need.';
    (h.immunisations || []).forEach((m, i) => {
      if (!clean(m.vaccine)) e[`health.immunisations.${i}.vaccine`] = 'Enter the vaccine.';
      if (m.date && (!isDate(m.date) || m.date > today())) e[`health.immunisations.${i}.date`] = 'Enter a date that isn’t in the future.';
    });
    if (h.doctor?.phone && !phoneOk(h.doctor.phone)) e['health.doctor.phone'] = 'Enter a phone number with at least 10 digits.';

    const cl = p.classSchedule || {};
    // Only active classes take children; an existing child may stay in the class they are already in.
    const target = classByName(cl.cls);
    const info = target && (target.status === 'active' || (childId && childById(childId)?.cls === cl.cls)) ? classInfo(cl.cls, childId) : null;
    if (!info) e['classSchedule.cls'] = 'Choose a class.';
    if (!isDate(cl.startDate)) e['classSchedule.startDate'] = 'Choose a start date.';
    else if (!childId && cl.startDate < daysFromToday(-30)) e['classSchedule.startDate'] = 'A new enrolment can start at most 30 days ago.';
    else if (cl.startDate > daysFromToday(366)) e['classSchedule.startDate'] = 'Choose a start date within the next year.';
    if (!(cl.days || []).length) e['classSchedule.days'] = 'Choose at least one day.';
    else if (cl.days.some(d => !schoolDays().includes(d))) e['classSchedule.days'] = 'Choose days the school is open.';
    if (!SESSIONS[cl.session]) e['classSchedule.session'] = 'Choose a session.';
    return { errors: e, info };
  }

  // Writes several keys as one unit: if any write fails, the earlier ones are put back.
  function commit(writes) {
    const before = writes.map(w => { try { return [w.key, localStorage.getItem(w.key)]; } catch { return [w.key, null]; } });
    for (const w of writes) {
      try { localStorage.setItem(w.key, JSON.stringify(w.value)); } catch {
        before.forEach(([k, v]) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* best effort */ } });
        return false;
      }
    }
    writes.forEach(w => emit(w.key));
    return true;
  }

  let enrolling = false;
  async function enrolChild(user, payload, { childId = null, draftId = null, overrideDuplicate = false } = {}) {
    if (!canManageChildren(user)) return settle({ ok: false, reason: 'forbidden' });
    // Guards against a double click submitting twice while the first save is in flight.
    if (enrolling) return settle({ ok: false, reason: 'busy' });
    enrolling = true;
    try {
      // Households first (their first read links every child), then one copy of the list is read, changed and written.
      const households = getHouseholds();
      const children = getChildren();
      const existing = childId ? children.find(c => c.id === childId) : null;
      if (childId && !existing) return settle({ ok: false, reason: 'missing' });
      const { errors, info } = validateEnrolment(payload, { childId });
      if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
      const dupes = findDuplicates(payload.child, childId);
      if (dupes.length && !overrideDuplicate) return settle({ ok: false, reason: 'duplicate', duplicates: dupes });
      const classChanged = !existing || existing.cls !== info.name || !['active', 'starting'].includes(existing.status);
      if (classChanged && info.full) return settle({ ok: false, reason: 'full', info });

      const guardians = getGuardians();
      const docs = read(docsKey(school.id), []);
      const now = new Date().toISOString();
      const p = payload;

      // Guardians: reuse an existing record when one was linked from a family search, otherwise create.
      const hhIds = {};
      const links = p.guardians.map(g => {
        let rec = g.guardianId && guardians.find(x => x.id === g.guardianId);
        if (rec) Object.assign(rec, { name: SAFE_NAME(g.name), phone: clean(g.phone), email: clean(g.email) });
        else { rec = { id: newId('g'), name: SAFE_NAME(g.name), phone: clean(g.phone), email: clean(g.email), prefers: 'phone' }; guardians.push(rec); }
        const slot = Number(g.household);
        if (!hhIds[slot]) {
          let hh = (slot === 1 ? p.householdIds?.[0] : p.householdIds?.[1]) && households.find(x => x.id === (slot === 1 ? p.householdIds[0] : p.householdIds[1]));
          if (!hh) { hh = { id: newId('h'), label: `${SAFE_NAME(g.name).split(' ').slice(-1)[0]} household`, guardianIds: [] }; households.push(hh); }
          hhIds[slot] = hh.id;
        }
        const hh = households.find(x => x.id === hhIds[slot]);
        if (!hh.guardianIds.includes(rec.id)) hh.guardianIds.push(rec.id);
        return { guardianId: rec.id, relation: clean(g.relation), primary: Boolean(g.primary), householdId: hh.id, livesWith: Boolean(g.livesWith), responsibility: Boolean(g.responsibility) };
      });
      const primaryRec = guardians.find(x => x.id === links.find(l => l.primary).guardianId);

      // Alerts are the single safety source (S12 icons, S13 banner): rebuilt from the health and restriction answers.
      const h = p.health;
      const dietaryAlerts = (h.dietary || []).filter(d => d !== 'Other').map(d => ({ type: 'dietary', detail: d }));
      if ((h.dietary || []).includes('Other') && clean(h.dietaryNotes)) dietaryAlerts.push({ type: 'dietary', detail: clean(h.dietaryNotes) });
      const alerts = [
        ...h.allergies.map(a => ({ type: 'allergy', detail: clean(a.allergen), severity: a.severity, reaction: clean(a.reaction), instructions: clean(a.instructions), planDocId: a.planDocId || null })),
        ...h.conditions.map(c => ({ type: 'medical', detail: clean(c.name), severity: '', instructions: clean(c.notes) })),
        ...dietaryAlerts,
        ...p.restrictions.filter(r => r.status === 'active').map(r => ({ type: 'custody', restrictedPerson: SAFE_NAME(r.name), relation: clean(r.relation), detail: clean(r.reason), effective: clean(r.effective), status: 'active', docId: r.docId || null }))
      ];
      // Lifted restrictions are kept on record but not shown as alerts.
      const liftedRestrictions = p.restrictions.filter(r => r.status === 'lifted').map(r => ({ name: SAFE_NAME(r.name), relation: clean(r.relation), reason: clean(r.reason), effective: clean(r.effective), docId: r.docId || null }));

      // New uploads (photo excluded) arrive as { data, mime, size, name, category }; store them as child documents.
      const childIdFinal = childId || newId('ch');
      const saveDoc = (file, category) => {
        if (!file?.data) return file?.docId || null;
        if (!DOC_TYPES[file.mime] || file.size > DOC_MAX) throw new Error('file');
        const d = { id: newId('doc'), childId: childIdFinal, name: clean(file.name) || category, category, expiry: '', fileName: clean(file.fileName), mime: file.mime, size: file.size, data: file.data, status: 'unverified', uploadedAt: now, uploadedBy: user.name };
        docs.push(d);
        return d.id;
      };
      try {
        h.allergies.forEach((a, i) => { const al = alerts.filter(x => x.type === 'allergy')[i]; if (a.planFile) al.planDocId = saveDoc(a.planFile, 'Medical plan'); });
        p.restrictions.forEach(r => { if (r.file) { const id = saveDoc(r.file, 'Court order'); const al = alerts.find(x => x.type === 'custody' && x.restrictedPerson === SAFE_NAME(r.name)); if (al) al.docId = id; else { const l = liftedRestrictions.find(x => x.name === SAFE_NAME(r.name)); if (l) l.docId = id; } } });
        h.medications.forEach(m => { if (m.file) m.docId = saveDoc(m.file, 'Medical plan'); });
      } catch { return settle({ ok: false, reason: 'invalid', errors: { files: 'Attachments must be PDF, JPEG or PNG files of 1 MB or less.' } }); }

      const status = p.classSchedule.startDate > today() ? 'starting' : 'active';
      const fields = {
        firstName: SAFE_NAME(p.child.firstName), lastName: SAFE_NAME(p.child.lastName), preferredName: SAFE_NAME(p.child.preferredName), dob: p.child.dob,
        gender: p.child.gender || '', languages: [...new Set(p.child.languages || [])], nationality: clean(p.child.nationality),
        cls: info.name, startDate: p.classSchedule.startDate, schedule: { days: [...new Set(p.classSchedule.days)], session: p.classSchedule.session },
        guardianLinks: links, guardian: { name: primaryRec.name, relation: links.find(l => l.primary).relation, phone: primaryRec.phone, email: primaryRec.email },
        emergency: p.emergency.map(c => ({ name: SAFE_NAME(c.name), relation: clean(c.relation), phone: clean(c.phone) })),
        alerts, restrictionsDeclared: p.restrictionsDeclared, liftedRestrictions,
        healthDeclared: { allergies: h.allergiesDeclared, conditions: h.conditionsDeclared, medications: h.medicationsDeclared },
        medications: h.medications.map(m => ({ name: clean(m.name), dose: clean(m.dose), schedule: clean(m.schedule), notes: clean(m.notes), storedAt: clean(m.storedAt), consent: m.consent, docId: m.docId || null })),
        dietaryNotes: clean(h.dietaryNotes), immunisations: h.immunisations.map(m => ({ vaccine: clean(m.vaccine), date: clean(m.date), notes: clean(m.notes) })),
        doctor: { name: clean(h.doctor?.name), clinic: clean(h.doctor?.clinic), phone: clean(h.doctor?.phone), notes: clean(h.doctor?.notes) }
      };
      if (p.child.photo !== undefined) fields.photo = p.child.photo || null;
      const pickupAuthorised = p.pickup.map(x => ({ name: SAFE_NAME(x.name), relation: clean(x.relation), phone: clean(x.phone), idRef: clean(x.idRef), status: x.status }));

      let child;
      if (existing) {
        child = existing;
        const changed = Object.keys(fields).filter(k => JSON.stringify(existing[k]) !== JSON.stringify(fields[k]));
        Object.assign(child, fields);
        child.pickup = { ...existing.pickup, authorised: pickupAuthorised };
        if (['active', 'starting'].includes(existing.status)) child.status = status;
        child.history = [...child.history, stamp(user, 'edited', changed.length ? `Updated: ${changed.join(', ')}` : 'Saved with no changes')];
      } else {
        child = {
          id: childIdFinal, ...fields, status, keyTeacher: info.teacher, careNotes: '', emergencyInstructions: '',
          pickup: { authorised: pickupAuthorised, verification: '', passcode: '' }, withdrawal: null,
          history: [stamp(user, 'enrolled', `Enrolled in ${info.name}`)]
        };
        if (child.photo === undefined) child.photo = null;
        children.push(child);
      }
      // Any other children sharing an edited guardian keep their primary snapshot in step.
      children.forEach(c => { if (c !== child && c.guardianLinks?.some(l => links.some(x => x.guardianId === l.guardianId))) syncPrimary(c, guardians); });

      const writes = [
        { key: guardiansKey(school.id), value: guardians },
        { key: householdsKey(school.id), value: households },
        { key: docsKey(school.id), value: docs },
        { key: childrenKey(school.id), value: children }
      ];
      if (draftId) writes.push({ key: draftsKey(school.id), value: getDrafts().filter(d => d.id !== draftId) });
      if (!commit(writes)) return settle({ ok: false, reason: 'storage', message: 'This enrolment couldn’t be saved on this device. Nothing was changed. Remove large files and try again.' });

      logAudit(user, existing ? 'edit:enrolment' : 'enrol', child.id, existing ? 'Enrolment details updated' : `Enrolled in ${info.name}`);
      // Only the class team hears about a new child; the notification names no health or custody details.
      if (!existing || existing.cls !== child.cls) {
        notifyUsers({ module: 'classroom-tracker', kind: 'enrolment', title: `${childName(child)} is joining ${child.cls}`, body: `Starts ${child.startDate} · ${SESSIONS[child.schedule.session]}. Open the profile for alerts and pickup details.`, recordType: 'child', recordId: child.id, dedupeKey: `enrol:${child.id}:${child.cls}` },
          { toUserIds: staffOf(child.cls).filter(e => e.userId).map(e => e.userId), exclude: [user.id] });
      }
      return settle({ ok: true, child, created: !existing });
    } finally {
      enrolling = false;
    }
  }


  /* ---------------------------------------------------------------- S15 families, S16 family detail, parent app
     A family groups one or more households (two homes = two households, one family). Guardians and
     children are not copied: a family's guardians are its households' guardians and its children are
     the children linked to those households. Families are reconciled on read, so a household created
     by S14 always belongs to exactly one active family.
     Parent-app accounts are per guardian ({ status: 'invited' | 'active', history[] }); a family is
     Active when any guardian has activated, Invited when an invite was issued and nobody has
     activated, otherwise Not invited. Prototype: invites are recorded, not delivered. */

  const familiesKey = id => `nexora-families:${id}`;
  const parentAppKey = id => `nexora-parent-app:${id}`;
  const FAMILY_MANAGERS = ['Director', 'Admin', 'Super Admin'];
  const canManageFamilies = user => FAMILY_MANAGERS.includes(user.role);
  const APP_STATUS = { active: 'Active', invited: 'Invited', 'not-invited': 'Not invited' };

  // Seeded demo accounts so every status appears; everything after this comes from real actions.
  function getParentApp() {
    return seeded(parentAppKey(school.id), () => {
      const accounts = {};
      getGuardians().forEach((g, i) => {
        if (i % 5 === 0) accounts[g.id] = { status: 'active', invitedAt: atToday(10, 0, -40), activatedAt: atToday(19, 30, -38), history: [{ at: atToday(10, 0, -40), event: 'invited', by: 'Mrs. Rao', result: 'issued' }, { at: atToday(19, 30, -38), event: 'activated' }] };
        else if (i % 5 === 2) accounts[g.id] = { status: 'invited', invitedAt: atToday(11, 0, -6), history: [{ at: atToday(11, 0, -6), event: 'invited', by: 'Mrs. Rao', result: 'issued' }] };
      });
      return { accounts, invitations: [] };
    });
  }

  function getFamilyRecords() {
    const households = getHouseholds();
    const children = getChildren();
    let list = read(familiesKey(school.id), null);
    const fresh = !list;
    list = list || [];
    let changed = fresh;
    const owner = new Map();
    list.filter(f => f.status === 'active').forEach(f => f.householdIds.forEach(h => owner.set(h, f)));
    // Households joined by a shared child are one family (two homes).
    const siblingsOf = hid => {
      const out = new Set();
      children.forEach(c => { const hs = [...new Set(c.guardianLinks.map(l => l.householdId).filter(Boolean))]; if (hs.includes(hid)) hs.forEach(h => out.add(h)); });
      return out;
    };
    households.forEach(h => {
      if (owner.has(h.id)) return;
      const linked = [...siblingsOf(h.id)].map(x => owner.get(x)).find(Boolean);
      if (linked) { linked.householdIds.push(h.id); owner.set(h.id, linked); changed = true; return; }
      const f = { id: `f-${list.length + 1}-${h.id}`, name: h.label.replace(/ household$/i, ' family'), householdIds: [h.id], primaryGuardianId: h.guardianIds[0] || null, notes: '', status: 'active', mergedInto: null, createdAt: new Date().toISOString(), history: [] };
      list.push(f);
      owner.set(h.id, f);
      changed = true;
    });
    if (changed) { try { localStorage.setItem(familiesKey(school.id), JSON.stringify(list)); } catch { /* in memory */ } }
    return list;
  }

  const accountOf = (app, gid) => app.accounts[gid] || { status: 'not-invited', history: [] };
  function familyStatus(guardianIds, app = getParentApp()) {
    const st = guardianIds.map(id => accountOf(app, id).status);
    return st.includes('active') ? 'active' : st.includes('invited') ? 'invited' : 'not-invited';
  }

  // Resolved view of one family: households, guardians (deduplicated by ID), children, status, balance.
  function resolveFamily(f, ctx) {
    const households = f.householdIds.map(id => ctx.households.find(h => h.id === id)).filter(Boolean);
    const gids = [...new Set(households.flatMap(h => h.guardianIds))];
    const guardians = gids.map(id => ctx.guardians.find(g => g.id === id)).filter(Boolean).map(g => ({ ...g, account: accountOf(ctx.app, g.id) }));
    const kidsIn = ctx.children.filter(c => c.guardianLinks?.some(l => f.householdIds.includes(l.householdId)));
    const primary = guardians.find(g => g.id === f.primaryGuardianId) || guardians[0] || null;
    const lines = ctx.ledger.filter(l => kidsIn.some(c => c.id === l.studentId));
    return {
      ...f, households: households.map(h => ({ ...h, guardianIds: h.guardianIds.filter(id => gids.includes(id)) })), guardians,
      children: kidsIn.map(c => ({ id: c.id, name: childName(c), firstName: c.firstName, lastName: c.lastName, cls: c.cls, status: c.status, photo: c.photo || null })),
      primary, appStatus: familyStatus(gids, ctx.app),
      balance: lines.reduce((s, l) => s + l.balance, 0), invoiceIds: lines.map(l => l.id)
    };
  }
  function listFamilies({ includeMerged = false } = {}) {
    const ctx = { households: getHouseholds(), guardians: getGuardians(), children: getChildren(), app: getParentApp(), ledger: feeLedger() };
    return getFamilyRecords().filter(f => includeMerged || f.status === 'active').map(f => resolveFamily(f, ctx));
  }
  const familyById = id => {
    const rec = getFamilyRecords().find(f => f.id === id);
    if (!rec) return null;
    // A merged family resolves to the family it now lives in.
    if (rec.status === 'merged') return { merged: true, mergedInto: rec.mergedInto, name: rec.name };
    return listFamilies().find(f => f.id === id) || null;
  };

  /* Add / edit family. */
  function saveFamily(user, input, familyId = null) {
    if (!canManageFamilies(user)) return settle({ ok: false, reason: 'forbidden' });
    const errors = {};
    const name = clean(input.name);
    if (!name) errors.name = 'Give the family a name.';
    const families = getFamilyRecords();
    if (familyId) {
      const f = families.find(x => x.id === familyId && x.status === 'active');
      if (!f) return settle({ ok: false, reason: 'missing' });
      const view = listFamilies().find(x => x.id === familyId);
      if (input.primaryGuardianId && !view.guardians.some(g => g.id === input.primaryGuardianId)) errors.primaryGuardianId = 'Choose a guardian in this family.';
      if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
      const before = { name: f.name, primaryGuardianId: f.primaryGuardianId, notes: f.notes };
      Object.assign(f, { name, primaryGuardianId: input.primaryGuardianId || f.primaryGuardianId, notes: clean(input.notes).slice(0, 1000) });
      f.history = [...(f.history || []), { at: new Date().toISOString(), by: user.name, event: 'edited', detail: Object.keys(before).filter(k => before[k] !== f[k]).join(', ') || 'no changes' }];
      if (!write(familiesKey(school.id), families)) return settle({ ok: false, reason: 'storage' });
      logAudit(user, 'edit:family', familyId, name);
      return settle({ ok: true, family: f });
    }
    // New family: existing guardians are linked by ID; new guardians are checked against existing phone numbers.
    const guardians = getGuardians();
    const picked = (input.existingGuardianIds || []).filter(id => guardians.some(g => g.id === id));
    const newOnes = (input.newGuardians || []).map((g, i) => ({ i, name: clean(g.name), phone: clean(g.phone), email: clean(g.email), relation: clean(g.relation) }));
    newOnes.forEach(g => {
      if (!g.name) errors[`newGuardians.${g.i}.name`] = 'Enter the guardian’s name.';
      if (!phoneOk(g.phone)) errors[`newGuardians.${g.i}.phone`] = 'Enter a phone number with at least 10 digits.';
      else {
        const same = guardians.find(x => x.phone.replace(/\D/g, '').slice(-10) === g.phone.replace(/\D/g, '').slice(-10));
        if (same) errors[`newGuardians.${g.i}.phone`] = `${same.name} already has this number. Link the existing guardian instead.`;
      }
      if (!emailOk(g.email)) errors[`newGuardians.${g.i}.email`] = 'Enter a valid email or leave it blank.';
      if (!g.relation) errors[`newGuardians.${g.i}.relation`] = 'Choose the relationship to the children.';
    });
    if (!picked.length && !newOnes.length) errors.guardians = 'Add at least one guardian.';
    const children = getChildren();
    const childIds = (input.childIds || []).filter(id => children.some(c => c.id === id));
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });

    const households = getHouseholds();
    const created = newOnes.map(g => ({ id: newId('g'), name: g.name, phone: g.phone, email: g.email, prefers: 'phone', relation: g.relation }));
    const hh = { id: newId('h'), label: `${name.replace(/ family$/i, '')} household`, guardianIds: [...picked, ...created.map(g => g.id)] };
    const relationOf = gid => created.find(g => g.id === gid)?.relation || clean(input.existingRelations?.[gid]) || 'Guardian';
    childIds.forEach(cid => {
      const c = children.find(x => x.id === cid);
      hh.guardianIds.forEach(gid => {
        if (c.guardianLinks.some(l => l.guardianId === gid)) return;
        c.guardianLinks.push({ guardianId: gid, relation: relationOf(gid), primary: false, householdId: hh.id, livesWith: null, responsibility: null });
      });
      c.history = [...c.history, stamp(user, 'edited', `Linked to the ${name}`)];
    });
    const f = { id: newId('f'), name, householdIds: [hh.id], primaryGuardianId: hh.guardianIds[0], notes: clean(input.notes).slice(0, 1000), status: 'active', mergedInto: null, createdAt: new Date().toISOString(), history: [{ at: new Date().toISOString(), by: user.name, event: 'created' }] };
    const ok = commit([
      { key: guardiansKey(school.id), value: [...guardians, ...created.map(({ relation, ...g }) => g)] },
      { key: householdsKey(school.id), value: [...households, hh] },
      { key: childrenKey(school.id), value: children },
      { key: familiesKey(school.id), value: [...families, f] }
    ]);
    if (!ok) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'add:family', f.id, name);
    return settle({ ok: true, family: f });
  }

  /* Invitations: one per eligible guardian across the selected families (deduplicated); active accounts are skipped. */
  function invitePreview(familyIds) {
    const fams = listFamilies().filter(f => familyIds.includes(f.id));
    const seen = new Set();
    const recipients = [];
    const skipped = [];
    fams.forEach(f => f.guardians.forEach(g => {
      if (seen.has(g.id)) return;
      seen.add(g.id);
      if (g.account.status === 'active') skipped.push({ guardianId: g.id, name: g.name, familyId: f.id, reason: 'Already active' });
      else if (!g.phone && !g.email) skipped.push({ guardianId: g.id, name: g.name, familyId: f.id, reason: 'No phone or email' });
      else recipients.push({ guardianId: g.id, name: g.name, familyId: f.id, resend: g.account.status === 'invited' });
    }));
    const eligibleFamilies = [...new Set(recipients.map(r => r.familyId))];
    return { families: fams, recipients, skipped, eligibleFamilies };
  }
  function inviteFamilies(user, familyIds) {
    if (!canManageFamilies(user)) return settle({ ok: false, reason: 'forbidden' });
    const p = invitePreview(familyIds);
    if (!p.recipients.length) return settle({ ok: false, reason: 'none', skipped: p.skipped });
    const app = getParentApp();
    const now = new Date().toISOString();
    const results = p.recipients.map(r => {
      const g = getGuardians().find(x => x.id === r.guardianId);
      // Demo channel: issuing = recording the invite. Without a contact route there is nothing to issue to.
      const ok = Boolean(g && (g.phone || g.email));
      return { ...r, ok, result: ok ? 'issued (demo — not delivered)' : 'failed: no contact route' };
    });
    results.filter(r => r.ok).forEach(r => {
      const acc = app.accounts[r.guardianId] || { status: 'not-invited', history: [] };
      // Never downgrade an active account.
      if (acc.status !== 'active') acc.status = 'invited';
      acc.invitedAt = now;
      acc.history = [...(acc.history || []), { at: now, event: 'invited', by: user.name, result: 'issued', familyId: r.familyId }];
      app.accounts[r.guardianId] = acc;
    });
    const invitedFamilies = [...new Set(results.filter(r => r.ok).map(r => r.familyId))];
    app.invitations.unshift({ id: newId('inv'), at: now, by: user.name, familyIds, recipients: results.map(r => ({ guardianId: r.guardianId, familyId: r.familyId, ok: r.ok, result: r.result })), skipped: p.skipped });
    if (!write(parentAppKey(school.id), app)) return settle({ ok: false, reason: 'storage' });
    invitedFamilies.forEach(fid => logAudit(user, 'invite:parent-app', fid, `${results.filter(r => r.ok && r.familyId === fid).length} guardian(s)`));
    return settle({ ok: true, invitedFamilies, results, skipped: p.skipped });
  }

  /* Merge: `keepId` survives, `mergeId` is marked merged into it. Only the families record changes:
     households (and so guardians and children) move across by ID; nothing is deleted. */
  function mergeFamilies(user, { keepId, mergeId, name, primaryGuardianId, notes }) {
    if (!canManageFamilies(user)) return settle({ ok: false, reason: 'forbidden' });
    if (!keepId || !mergeId || keepId === mergeId) return settle({ ok: false, reason: 'invalid', message: 'Choose two different families.' });
    const families = getFamilyRecords();
    const keep = families.find(f => f.id === keepId);
    const gone = families.find(f => f.id === mergeId);
    if (!keep || !gone || keep.status !== 'active' || gone.status !== 'active') return settle({ ok: false, reason: 'stale', message: 'One of these families changed or was already merged. Refresh and try again.' });
    const both = listFamilies().filter(f => f.id === keepId || f.id === mergeId);
    const gids = new Set(both.flatMap(f => f.guardians.map(g => g.id)));
    if (primaryGuardianId && !gids.has(primaryGuardianId)) return settle({ ok: false, reason: 'invalid', message: 'The primary contact must be one of the two families’ guardians.' });
    if (!clean(name)) return settle({ ok: false, reason: 'invalid', message: 'Choose the family name to keep.' });
    const at = new Date().toISOString();
    const before = { keep: JSON.parse(JSON.stringify(keep)), gone: JSON.parse(JSON.stringify(gone)) };
    keep.householdIds = [...new Set([...keep.householdIds, ...gone.householdIds])];
    keep.name = clean(name);
    keep.primaryGuardianId = primaryGuardianId || keep.primaryGuardianId;
    keep.notes = clean(notes ?? keep.notes);
    keep.mergedFrom = [...(keep.mergedFrom || []), gone.id];
    keep.history = [...(keep.history || []), { at, by: user.name, event: 'merged', detail: `Merged ${gone.name} (${gone.id}) into this family` }];
    Object.assign(gone, { status: 'merged', mergedInto: keep.id, mergedAt: at, mergedBy: user.name, householdIds: before.gone.householdIds });
    gone.history = [...(gone.history || []), { at, by: user.name, event: 'merged', detail: `Merged into ${keep.name} (${keep.id})` }];
    if (!commit([{ key: familiesKey(school.id), value: families }])) return settle({ ok: false, reason: 'storage', message: 'The merge couldn’t be saved. Nothing was changed.' });
    logAudit(user, 'merge:family', keep.id, `${gone.name} (${gone.id}) merged into ${keep.name} (${keep.id})`);
    return settle({ ok: true, family: keep, merged: gone });
  }


  /* ---------------------------------------------------------------- S16 family details
     Guardians gain `language` and `channels` (preferred contact channels). A channel is only
     "available" when its service exists: the parent app once the guardian's account is active;
     email/SMS/WhatsApp have no delivery service in this prototype, so they stay "preferred, not
     connected". Households gain `address`, `invoiceRecipientId`, `reportRecipientId`.
     Legal notes are restricted to the safeguarding roles: every read and write checks the role here,
     so a page can't get them by asking. */

  const legalKey = id => `nexora-legal-notes:${id}`;
  const GUARDIAN_LANGUAGES = { en: 'English', ta: 'தமிழ் (Tamil)', ar: 'العربية (Arabic)', hi: 'हिन्दी (Hindi)' };
  const CHANNELS = { app: 'Parent app', email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp' };
  const schoolLanguage = () => getSettings(school.id).preferences?.language || 'en';
  const canSeeLegal = user => Boolean(pages.safeguarding?.roles.includes(user.role));
  const guardianLanguage = g => (GUARDIAN_LANGUAGES[g?.language] ? g.language : schoolLanguage());
  const guardianChannels = g => (Array.isArray(g?.channels) ? g.channels : g?.prefers === 'whatsapp' ? ['whatsapp'] : g?.prefers === 'email' ? ['email'] : ['sms']);
  // Preferred ≠ available: only the parent app can deliver here, and only to an activated account.
  function channelState(g, ch, app = getParentApp()) {
    if (ch === 'app') return accountOf(app, g.id).status === 'active' ? { ok: true, note: 'Active account' } : { ok: false, note: 'No active parent-app account' };
    if (ch === 'email' && !g.email) return { ok: false, note: 'No email address' };
    return { ok: false, note: 'Not connected in this prototype' };
  }

  // The family a guardian or household belongs to must be the family being edited.
  function familyContext(familyId) {
    const families = getFamilyRecords();
    const fam = families.find(f => f.id === familyId && f.status === 'active');
    return fam ? { families, fam } : null;
  }

  /* Guardians: add (new or existing record by ID) or edit, within one household of the family. */
  function saveFamilyGuardian(user, familyId, input, guardianId = null) {
    if (!canManageFamilies(user)) return settle({ ok: false, reason: 'forbidden' });
    const ctx = familyContext(familyId);
    if (!ctx) return settle({ ok: false, reason: 'missing' });
    const households = getHouseholds();
    const guardians = getGuardians();
    const children = getChildren();
    const famHh = households.filter(h => ctx.fam.householdIds.includes(h.id));
    const errors = {};
    const v = {
      linkId: clean(input.linkId), name: clean(input.name), phone: clean(input.phone), email: clean(input.email), relation: clean(input.relation),
      language: clean(input.language), channels: [...new Set((input.channels || []).filter(c => CHANNELS[c]))], householdId: clean(input.householdId), primary: Boolean(input.primary)
    };
    const existing = guardianId ? guardians.find(g => g.id === guardianId) : v.linkId ? guardians.find(g => g.id === v.linkId) : null;
    if ((guardianId || v.linkId) && !existing) return settle({ ok: false, reason: 'missing' });
    if (!existing || guardianId) {
      if (!v.name) errors.name = 'Enter the guardian’s full name.';
      if (!phoneOk(v.phone)) errors.phone = 'Enter a phone number with at least 10 digits.';
      else {
        const same = guardians.find(g => g.id !== guardianId && g.phone.replace(/\D/g, '').slice(-10) === v.phone.replace(/\D/g, '').slice(-10));
        if (same) errors.phone = `${same.name} already has this number. Use “Link an existing guardian” instead.`;
      }
      if (!emailOk(v.email)) errors.email = 'Enter a valid email or leave it blank.';
      if (!GUARDIAN_LANGUAGES[v.language]) errors.language = 'Choose a language.';
      if (!v.channels.length) errors.channels = 'Choose at least one way to contact them.';
      if (v.channels.includes('email') && !v.email) errors.email = 'Add an email address to use email as a channel.';
    }
    if (!guardianId) {
      if (!v.relation) errors.relation = 'Choose the relationship to the children.';
      if (!famHh.some(h => h.id === v.householdId)) errors.householdId = 'Choose a household in this family.';
      if (existing && famHh.some(h => h.guardianIds.includes(existing.id))) errors.linkId = `${existing.name} is already in this family.`;
    }
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });

    let g = existing;
    if (guardianId) Object.assign(g, { name: v.name, phone: v.phone, email: v.email, language: v.language, channels: v.channels, prefers: v.channels.includes('whatsapp') ? 'whatsapp' : v.channels.includes('email') ? 'email' : 'phone' });
    else if (!g) { g = { id: newId('g'), name: v.name, phone: v.phone, email: v.email, language: v.language, channels: v.channels, prefers: v.channels.includes('whatsapp') ? 'whatsapp' : v.channels.includes('email') ? 'email' : 'phone' }; guardians.push(g); }
    if (!guardianId) {
      // Joining a household links the guardian to that household's children, with the stated relationship.
      const hh = households.find(h => h.id === v.householdId);
      hh.guardianIds.push(g.id);
      children.filter(c => c.guardianLinks.some(l => l.householdId === hh.id)).forEach(c => {
        if (c.guardianLinks.some(l => l.guardianId === g.id && l.householdId === hh.id)) return;
        c.guardianLinks.push({ guardianId: g.id, relation: v.relation, primary: false, householdId: hh.id, livesWith: null, responsibility: null });
        c.history = [...c.history, stamp(user, 'edited', `Guardian added: ${g.name}`)];
      });
    }
    if (v.primary) ctx.fam.primaryGuardianId = g.id;
    children.forEach(c => { if (c.guardianLinks?.some(l => l.guardianId === g.id)) syncPrimary(c, guardians); });
    if (!commit([{ key: guardiansKey(school.id), value: guardians }, { key: householdsKey(school.id), value: households }, { key: childrenKey(school.id), value: children }, { key: familiesKey(school.id), value: ctx.families }])) return settle({ ok: false, reason: 'storage' });
    logAudit(user, guardianId ? 'edit:guardian' : 'add:guardian', familyId, g.name);
    return settle({ ok: true, guardian: g });
  }

  function setFamilyPrimary(user, familyId, guardianId) {
    if (!canManageFamilies(user)) return settle({ ok: false, reason: 'forbidden' });
    const ctx = familyContext(familyId);
    if (!ctx) return settle({ ok: false, reason: 'missing' });
    if (!listFamilies().find(f => f.id === familyId).guardians.some(g => g.id === guardianId)) return settle({ ok: false, reason: 'invalid', message: 'Choose a guardian in this family.' });
    ctx.fam.primaryGuardianId = guardianId;
    ctx.fam.history = [...(ctx.fam.history || []), { at: new Date().toISOString(), by: user.name, event: 'primary', detail: guardianId }];
    if (!write(familiesKey(school.id), ctx.families)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'edit:family-primary', familyId, guardianId);
    return settle({ ok: true });
  }

  /* Households: label, address and who receives invoices and reports (must be guardians of that household). */
  function saveFamilyHousehold(user, familyId, input, householdId = null) {
    if (!canManageFamilies(user)) return settle({ ok: false, reason: 'forbidden' });
    const ctx = familyContext(familyId);
    if (!ctx) return settle({ ok: false, reason: 'missing' });
    const households = getHouseholds();
    const v = { label: clean(input.label), address: clean(input.address).slice(0, 300), invoiceRecipientId: clean(input.invoiceRecipientId), reportRecipientId: clean(input.reportRecipientId) };
    const errors = {};
    if (!v.label) errors.label = 'Give the household a name.';
    if (v.address && v.address.length < 8) errors.address = 'Enter a full address, or leave it blank.';
    let hh = householdId ? households.find(h => h.id === householdId && ctx.fam.householdIds.includes(h.id)) : null;
    if (householdId && !hh) return settle({ ok: false, reason: 'missing' });
    const members = hh ? hh.guardianIds : [];
    if (v.invoiceRecipientId && !members.includes(v.invoiceRecipientId)) errors.invoiceRecipientId = 'Choose a guardian who lives in this household.';
    if (v.reportRecipientId && !members.includes(v.reportRecipientId)) errors.reportRecipientId = 'Choose a guardian who lives in this household.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    if (hh) Object.assign(hh, v);
    else { hh = { id: newId('h'), guardianIds: [], ...v, invoiceRecipientId: '', reportRecipientId: '' }; households.push(hh); ctx.fam.householdIds.push(hh.id); }
    if (!commit([{ key: householdsKey(school.id), value: households }, { key: familiesKey(school.id), value: ctx.families }])) return settle({ ok: false, reason: 'storage' });
    logAudit(user, householdId ? 'edit:household' : 'add:household', familyId, v.label);
    return settle({ ok: true, household: hh });
  }

  // Children in a household: adding links each household guardian (with a relationship); removing never
  // leaves a child without any guardian.
  function setHouseholdChildren(user, familyId, householdId, { childIds = [], relations = {} }) {
    if (!canManageFamilies(user)) return settle({ ok: false, reason: 'forbidden' });
    const ctx = familyContext(familyId);
    if (!ctx) return settle({ ok: false, reason: 'missing' });
    const households = getHouseholds();
    const hh = households.find(h => h.id === householdId && ctx.fam.householdIds.includes(h.id));
    if (!hh) return settle({ ok: false, reason: 'missing' });
    const children = getChildren();
    const famKids = new Set(listFamilies().find(f => f.id === familyId).children.map(c => c.id));
    const want = new Set(childIds.filter(id => famKids.has(id)));
    const errors = {};
    children.filter(c => want.has(c.id) && !c.guardianLinks.some(l => l.householdId === hh.id)).forEach(() => {
      hh.guardianIds.forEach(gid => { if (!clean(relations[gid])) errors[`relations.${gid}`] = 'Choose this guardian’s relationship to the children being added.'; });
    });
    if (!hh.guardianIds.length && want.size) errors.childIds = 'Add a guardian to this household before linking children.';
    const losing = children.filter(c => famKids.has(c.id) && !want.has(c.id) && c.guardianLinks.some(l => l.householdId === hh.id));
    losing.forEach(c => { if (c.guardianLinks.every(l => l.householdId === hh.id)) errors.childIds = `${childName(c)} would have no guardian left. Link them to another household first.`; });
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    children.forEach(c => {
      if (want.has(c.id) && !c.guardianLinks.some(l => l.householdId === hh.id)) {
        hh.guardianIds.forEach(gid => c.guardianLinks.push({ guardianId: gid, relation: clean(relations[gid]), primary: false, householdId: hh.id, livesWith: null, responsibility: null }));
        c.history = [...c.history, stamp(user, 'edited', `Linked to ${hh.label}`)];
      }
      if (losing.includes(c)) {
        c.guardianLinks = c.guardianLinks.filter(l => l.householdId !== hh.id);
        if (!c.guardianLinks.some(l => l.primary)) c.guardianLinks[0].primary = true;
        syncPrimary(c);
        c.history = [...c.history, stamp(user, 'edited', `Removed from ${hh.label}`)];
      }
    });
    if (!write(childrenKey(school.id), children)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'edit:household-children', familyId, hh.label);
    return settle({ ok: true });
  }

  function unlinkHouseholdGuardian(user, familyId, householdId, guardianId) {
    if (!canManageFamilies(user)) return settle({ ok: false, reason: 'forbidden' });
    const ctx = familyContext(familyId);
    if (!ctx) return settle({ ok: false, reason: 'missing' });
    if (ctx.fam.primaryGuardianId === guardianId) return settle({ ok: false, reason: 'invalid', message: 'This is the family’s primary contact. Make someone else primary first.' });
    const households = getHouseholds();
    const hh = households.find(h => h.id === householdId && ctx.fam.householdIds.includes(h.id));
    if (!hh || !hh.guardianIds.includes(guardianId)) return settle({ ok: false, reason: 'missing' });
    const children = getChildren();
    const orphan = children.find(c => c.guardianLinks.length && c.guardianLinks.every(l => l.guardianId === guardianId));
    if (orphan) return settle({ ok: false, reason: 'invalid', message: `${childName(orphan)} would have no guardian left.` });
    hh.guardianIds = hh.guardianIds.filter(id => id !== guardianId);
    ['invoiceRecipientId', 'reportRecipientId'].forEach(k => { if (hh[k] === guardianId) hh[k] = ''; });
    children.forEach(c => {
      if (!c.guardianLinks.some(l => l.guardianId === guardianId && l.householdId === hh.id)) return;
      c.guardianLinks = c.guardianLinks.filter(l => !(l.guardianId === guardianId && l.householdId === hh.id));
      if (!c.guardianLinks.some(l => l.primary)) c.guardianLinks[0].primary = true;
      syncPrimary(c);
    });
    if (!commit([{ key: householdsKey(school.id), value: households }, { key: childrenKey(school.id), value: children }])) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'unlink:household-guardian', familyId, guardianId);
    return settle({ ok: true });
  }

  /* Custody & legal notes: role-checked on every read and write; the children's own custody alerts are included. */
  function getLegalNotes(user, familyId) {
    if (!canSeeLegal(user)) return { ok: false, reason: 'forbidden' };
    const fam = listFamilies().find(f => f.id === familyId);
    if (!fam) return { ok: false, reason: 'missing' };
    const notes = read(legalKey(school.id), []).filter(n => n.familyId === familyId);
    const custody = getChildren().filter(c => fam.children.some(k => k.id === c.id)).flatMap(c => c.alerts.filter(a => a.type === 'custody').map(a => ({ child: childName(c), childId: c.id, ...a })));
    return { ok: true, notes, custody };
  }
  function saveLegalNote(user, familyId, input, noteId = null) {
    if (!canSeeLegal(user)) return settle({ ok: false, reason: 'forbidden' });
    if (!familyContext(familyId)) return settle({ ok: false, reason: 'missing' });
    const v = { title: clean(input.title), detail: clean(input.detail).slice(0, 2000), effective: clean(input.effective), review: clean(input.review), instructions: clean(input.instructions).slice(0, 1000), docRef: clean(input.docRef) };
    const errors = {};
    if (!v.title) errors.title = 'Give the note a title.';
    if (!v.detail) errors.detail = 'Describe the order or arrangement.';
    if (v.effective && !isDate(v.effective)) errors.effective = 'Enter a valid date.';
    if (v.review && (!isDate(v.review) || (v.effective && v.review < v.effective))) errors.review = 'The review date must be after the effective date.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const all = read(legalKey(school.id), []);
    let note = noteId && all.find(n => n.id === noteId && n.familyId === familyId);
    if (noteId && !note) return settle({ ok: false, reason: 'missing' });
    const at = new Date().toISOString();
    if (note) Object.assign(note, v, { updatedAt: at, updatedBy: user.name });
    else { note = { id: newId('ln'), familyId, ...v, createdAt: at, createdBy: user.name }; all.push(note); }
    if (!write(legalKey(school.id), all)) return settle({ ok: false, reason: 'storage' });
    // The audit trail records that a note changed, never its content.
    logAudit(user, noteId ? 'edit:legal-note' : 'add:legal-note', familyId, 'Restricted note');
    return settle({ ok: true, note });
  }

  /* Templates: one per language; a missing translation falls back to the school language, then English. */
  const TEMPLATES = {
    'pickup-change': { label: 'Change to pickup time', en: { subject: 'Pickup time for {child}', body: 'Dear {guardian},\n\nPlease note a change to {child}’s pickup time. Contact the office if this doesn’t suit you.\n\n{school}' }, ta: { subject: '{child} அழைத்துச் செல்லும் நேரம்', body: 'அன்புள்ள {guardian},\n\n{child} அவர்களை அழைத்துச் செல்லும் நேரத்தில் மாற்றம் உள்ளது. இது உங்களுக்கு ஏற்றதாக இல்லையென்றால் அலுவலகத்தைத் தொடர்பு கொள்ளவும்.\n\n{school}' }, ar: { subject: 'موعد استلام {child}', body: 'عزيزي/عزيزتي {guardian}،\n\nيرجى ملاحظة تغيير في موعد استلام {child}. تواصلوا مع المكتب إذا لم يناسبكم الموعد.\n\n{school}' } },
    'fee-reminder': { label: 'Fee reminder', en: { subject: 'Fee reminder for {child}', body: 'Dear {guardian},\n\nThis is a reminder that this term’s fees for {child} are due. Thank you.\n\n{school}' }, ta: { subject: '{child} கட்டண நினைவூட்டல்', body: 'அன்புள்ள {guardian},\n\n{child} அவர்களின் இந்த பருவக் கட்டணம் செலுத்த வேண்டிய நேரம் வந்துவிட்டது. நன்றி.\n\n{school}' } },
    'event-invite': { label: 'Event invitation', en: { subject: 'You’re invited: family morning', body: 'Dear {guardian},\n\nWe’d love you to join {child} and the class for our family morning.\n\n{school}' } }
  };
  function renderTemplate(templateId, language, vars) {
    const t = TEMPLATES[templateId];
    if (!t) return null;
    const used = t[language] ? language : t[schoolLanguage()] ? schoolLanguage() : 'en';
    const fill = s => s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null && vars[k] !== '' ? vars[k] : m));
    return { language: used, requested: language, fallback: used !== language, subject: fill(t[used].subject), body: fill(t[used].body) };
  }

  /* Messages that reached any of a family's guardians, newest first. */
  function familyThreads(familyId, limit = 0) {
    const fam = listFamilies({ includeMerged: true }).find(f => f.id === familyId);
    if (!fam) return [];
    const ids = new Set(fam.guardians.map(g => g.id));
    const phones = new Set(fam.guardians.map(g => g.phone.replace(/\D/g, '').slice(-10)));
    const list = getFamilyMessages().filter(m => m.recipients.some(r => ids.has(r.guardianId) || (!r.guardianId && phones.has(String(r.phone || '').replace(/\D/g, '').slice(-10)))))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return limit ? list.slice(0, limit) : list;
  }

  /* Account: invoices and payments for the family's children. */
  function familyAccount(familyId) {
    const fam = listFamilies().find(f => f.id === familyId);
    if (!fam) return null;
    const kidIds = new Set(fam.children.map(c => c.id));
    const lines = feeLedger().filter(l => kidIds.has(l.studentId));
    const payments = getPayments().filter(p => kidIds.has(p.studentId)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt?.localeCompare(a.createdAt || '') || 0);
    const entries = [
      ...lines.map(l => ({ date: l.dueDate, kind: 'invoice', label: `${l.student?.name || ''} · ${l.term}`, amount: l.amount, ref: l.id })),
      ...payments.map(p => ({ date: p.date, kind: 'payment', label: `${studentById(p.studentId)?.name || ''} · ${p.method}${p.reference ? ` · ${p.reference}` : ''}`, amount: -p.amount, ref: p.id }))
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'invoice' ? -1 : 1));
    let running = 0;
    entries.forEach(e => { running += e.amount; e.balance = running; });
    return { balance: lines.reduce((s, l) => s + l.balance, 0), invoices: lines, payments, lastPayment: payments[0] || null, entries };
  }

  // Any child on record (including withdrawn), so past invoices and incidents keep their names.
  const studentById = id => { const c = childById(id); return c ? { id: c.id, name: childName(c), cls: c.cls } : null; };

  // Staff on record. `home` only seeds the class registry; assignments live on each class (staffIds).
  // Ms. Lakshmi is the demo Teacher account.
  const educators = [
    { id: 'ed-lakshmi', name: 'Ms. Lakshmi', userId: 'u-teacher', home: 'Montessori A' },
    { id: 'ed-deepa', name: 'Ms. Deepa', home: 'Montessori A' },
    { id: 'ed-arjun', name: 'Mr. Arjun', home: 'UKG A' },
    { id: 'ed-kavitha', name: 'Ms. Kavitha', home: 'UKG B' },
    { id: 'ed-sunita', name: 'Ms. Sunita', home: 'LKG A' },
    { id: 'ed-priya', name: 'Ms. Priya', home: 'Nursery' },
    { id: 'ed-anjali', name: 'Ms. Anjali', home: 'Nursery' },
    // Relief staff: no class of their own; they cover absences (S17 class detail → Assign substitute).
    { id: 'ed-revathi', name: 'Ms. Revathi', home: null, relief: true },
    { id: 'ed-joseph', name: 'Mr. Joseph', home: null, relief: true }
  ];
  educators.forEach(e => Object.defineProperty(e, 'cls', { get: () => classesOfStaff(e.id)[0] || '', enumerable: false }));

  /* ---------------------------------------------------------------- S17 class registry (single source of truth)
     { id, name, level, colour, ageMin, ageMax, mixedAge, room, capacity, ratio: { adults, children },
       staffIds: [educatorId, …] (first = lead), status: 'active' | 'archived', createdAt, updatedAt, archivedAt }
     Children keep pointing at a class by name (c.cls), so a rename updates them in the same write.
     Seeded from the demo roster classes; classes added in the S05 setup wizard join by name.
     Archived classes leave every active list and enrolment choice but still resolve by name, so past
     invoices, registers and withdrawn children keep their class. */

  const classRegistryKey = id => `nexora-class-registry:${id}`;
  const CLASS_COLOURS = { amber: 'Amber', sage: 'Sage', sky: 'Sky', rose: 'Rose', slate: 'Slate' };
  const SEED_CLASS_DETAILS = {
    'Montessori A': { room: 'Room 1 · Garden room', ageMin: 3, ageMax: 6, mixedAge: true, colour: 'amber' },
    'UKG A': { room: 'Room 2', ageMin: 4, ageMax: 5, mixedAge: false, colour: 'sky' },
    'UKG B': { room: 'Room 3', ageMin: 4, ageMax: 5, mixedAge: false, colour: 'sage' },
    'LKG A': { room: 'Room 4', ageMin: 3, ageMax: 4, mixedAge: false, colour: 'rose' },
    Nursery: { room: 'Room 5 · Nest', ageMin: 2, ageMax: 3, mixedAge: false, colour: 'slate' }
  };
  const LEVEL_AGES = { Toddler: [1, 2], Nursery: [2, 3], LKG: [3, 4], UKG: [4, 5], Montessori: [3, 6] };

  function getClassRegistry() {
    let list = read(classRegistryKey(school.id), null);
    let changed = false;
    if (!list) {
      const rules = getRatioRules();
      const capacities = getClassConfig();
      list = ROSTER_SEED_CLASSES.map((c, i) => ({
        id: `cl-${i + 1}`, name: c.name, level: c.level, ...SEED_CLASS_DETAILS[c.name],
        capacity: capacities[c.name] ?? null, ratio: { adults: 1, children: Number(rules[c.level]) || 8 },
        staffIds: educators.filter(e => e.home === c.name).map(e => e.id), status: 'active', createdAt: atToday(8, 0, -200), updatedAt: atToday(8, 0, -200), archivedAt: null
      }));
      changed = true;
    }
    // Classes created in the setup wizard (S05 step 4) join the registry once, by name.
    getClasses(school.id).forEach(s => {
      if (list.some(c => c.name.toLowerCase() === s.name.toLowerCase())) return;
      const [a, b] = LEVEL_AGES[s.level] || [2, 6];
      list.push({ id: newId('cl'), name: s.name, level: s.level, colour: 'slate', ageMin: a, ageMax: b, mixedAge: s.level === 'Montessori', room: s.section ? `Section ${s.section}` : '', capacity: s.capacity ?? null, ratio: { adults: 1, children: Number(getRatioRules()[s.level]) || 8 }, staffIds: [], status: 'active', createdAt: s.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), archivedAt: null });
      changed = true;
    });
    if (changed) { try { localStorage.setItem(classRegistryKey(school.id), JSON.stringify(list)); } catch { /* in memory */ } }
    return list;
  }
  const activeClasses = () => getClassRegistry().filter(c => c.status === 'active');
  // Resolves archived classes too, so history keeps working.
  const classByName = name => getClassRegistry().find(c => c.name === name) || null;
  const classById = id => getClassRegistry().find(c => c.id === id) || null;
  // Staff assigned to a class, lead first.
  const staffOf = name => { const c = classByName(name); return c ? c.staffIds.map(id => educators.find(e => e.id === id)).filter(Boolean) : []; };
  const classesOfStaff = staffId => activeClasses().filter(c => c.staffIds.includes(staffId)).map(c => c.name);
  // An adult can only be in one room: a member of staff counts towards the ratio of their first active class
  // only — unless they are covering another class today, where they count instead.
  const countedClassOf = staffId => {
    const cover = substitutesOn(today()).find(s => s.substituteId === staffId);
    if (cover) return classById(cover.classId)?.name || null;
    return activeClasses().find(c => c.staffIds.includes(staffId))?.name || null;
  };


  // Classes a user's data is limited to: a Teacher sees only the classes they're assigned to.
  function classScope(user) {
    const names = activeClasses().map(c => c.name);
    if (user.role !== 'Teacher') return names;
    const mine = educators.filter(e => e.userId === user.id).map(e => e.id);
    return names.filter(n => staffOf(n).some(e => mine.includes(e.id)));
  }

  // Configured children-per-educator limits by class level (demo configuration).
  const ratioKey = id => `nexora-ratio-rules:${id}`;
  const getRatioRules = (schoolId = school.id) => seeded(ratioKey(schoolId), () => ({ Toddler: 5, Nursery: 8, LKG: 10, UKG: 12, Montessori: 12 }));

  /* Student register: { [className]: { takenAt, takenBy, marks: { [studentId]: 'present'|'late'|'absent' } } } */
  const registerKey = (id, date) => `nexora-register:${id}:${date}`;
  const SEED_MARKS = { s1: 'present', s2: 'present', s3: 'late', s4: 'absent', s5: 'present', r2: 'absent', r13: 'late', r31: 'absent', r30: 'late' };
  function getRegister(date = today(), schoolId = school.id) {
    return seeded(registerKey(schoolId, date), () => {
      if (date !== today()) return {};
      // Today's demo: every register taken by 09:10 except UKG B.
      const reg = {};
      activeClasses().filter(c => c.name !== 'UKG B').forEach((c, i) => {
        const marks = {};
        activeRoster().filter(s => s.cls === c.name).forEach(s => { marks[s.id] = SEED_MARKS[s.id] || 'present'; });
        reg[c.name] = { takenAt: atToday(8, 40 + i * 6), takenBy: staffOf(c.name)[0]?.name || 'Class teacher', marks };
      });
      return reg;
    });
  }
  function saveRegister(user, cls, marks) {
    const pupils = activeRoster().filter(s => s.cls === cls);
    if (!can(user, 'attendance') || !classScope(user).includes(cls)) return settle({ ok: false, reason: 'forbidden' });
    if (!pupils.length || pupils.some(s => !['present', 'late', 'absent'].includes(marks[s.id]))) return settle({ ok: false, reason: 'incomplete' });
    const reg = getRegister();
    const before = reg[cls] || { marks: {}, live: {} };
    const live = { ...(before.live || {}) };
    // A collected child can't be re-marked absent from the register; S19 check-in/out details are kept.
    const clash = pupils.find(s => marks[s.id] === 'absent' && ['in', 'out'].includes(live[s.id]?.status) && before.marks?.[s.id] !== 'absent');
    if (clash && live[clash.id].status === 'out') return settle({ ok: false, reason: 'conflict', child: clash.name });
    const at = new Date().toISOString();
    const evs = [];
    pupils.forEach(s => {
      if (before.marks?.[s.id] === marks[s.id]) return;
      if (marks[s.id] === 'absent') live[s.id] = { status: 'absent', reason: null, note: '', absentAt: at, absentBy: user.name };
      else if (live[s.id]?.status === 'absent') delete live[s.id];
      else if (live[s.id]) live[s.id] = { ...live[s.id], late: marks[s.id] === 'late' };
      evs.push({ id: newId('at'), type: 'register', childId: s.id, classId: classByName(cls)?.id || null, cls, date: today(), at, by: actor(user), mark: marks[s.id] });
    });
    reg[cls] = { takenAt: at, takenBy: user.name, marks: Object.fromEntries(pupils.map(s => [s.id, marks[s.id]])), live };
    if (!commit([{ key: registerKey(school.id, today()), value: reg }, { key: attEventsKey(school.id, today()), value: [...getAttendanceEvents(), ...evs] }])) return settle({ ok: false, reason: 'storage' });
    events.register(user, cls);
    return settle({ ok: true, cls });
  }

  /* Staff on duty: { [educatorId]: 'present'|'absent' } */
  const staffAttKey = (id, date) => `nexora-staff-attendance:${id}:${date}`;
  const getStaffAttendance = (date = today(), schoolId = school.id) => seeded(staffAttKey(schoolId, date), () => (
    date === today() ? Object.fromEntries(educators.map(e => [e.id, e.id === 'ed-anjali' ? 'absent' : 'present'])) : {}
  ));
  const canManageStaff = user => can(user, 'attendance') && MANAGE_PLAN_ROLES.includes(user.role);
  function setStaffAttendance(user, educatorId, status) {
    if (!canManageStaff(user)) return settle({ ok: false, reason: 'forbidden' });
    if (!educators.some(e => e.id === educatorId) || !['present', 'absent'].includes(status)) return settle({ ok: false, reason: 'invalid' });
    const att = { ...getStaffAttendance(), [educatorId]: status };
    if (!write(staffAttKey(school.id, today()), att)) return settle({ ok: false, reason: 'storage' });
    classesOfStaff(educatorId).forEach(cls => events.ratio(cls));
    return settle({ ok: true });
  }

  /* Live ratio for one class (S17 card, S19, dashboard). Children present = present + late marks in
     today's register; adults present = staff assigned to the class, marked present, and counted here
     (someone assigned to two classes counts in their first only). With the rule "A adults : C children",
     required = ceil(children / (C / A)) and the ratio is met when adults present >= required.
     status: 'ok' | 'breach' | 'unavailable' (with a reason) — never a guessed ratio. `limit` is children
     per adult, kept for older readers. */
  function classRatio(cls, { register = getRegister(), staff = getStaffAttendance() } = {}) {
    const c = classByName(cls);
    const base = { cls, level: c?.level || '' };
    const adults = Number(c?.ratio?.adults);
    const per = Number(c?.ratio?.children);
    if (!c || !Number.isInteger(adults) || adults <= 0 || !Number.isInteger(per) || per <= 0) return { ...base, status: 'unavailable', reason: 'No ratio set' };
    const limit = per / adults;
    const rule = { ...base, limit, ratio: { adults, children: per } };
    if (!schoolDay().open) return { ...rule, status: 'unavailable', reason: 'School closed today' };
    const entry = register[cls];
    if (!entry) return { ...rule, status: 'unavailable', reason: 'Register not taken yet' };
    // Today's team: assigned staff who aren't being covered, plus anyone covering this class today.
    const covers = substitutesOn(today()).filter(s => s.classId === c.id);
    const covered = new Set(covers.map(s => s.replacingId));
    const team = [...staffOf(cls).filter(e => !covered.has(e.id)), ...covers.map(s => educators.find(e => e.id === s.substituteId)).filter(Boolean)];
    if (!team.length) return { ...rule, status: 'unavailable', reason: 'No staff assigned' };
    if (team.some(e => !staff[e.id])) return { ...rule, status: 'unavailable', reason: 'Staff attendance not recorded' };
    // Children on site now: checked in and not yet collected (S19).
    const children = attendanceView(cls).counts.in;
    const onDuty = team.filter(e => staff[e.id] === 'present' && countedClassOf(e.id) === cls).length;
    const required = Math.ceil(children / limit);
    return { ...rule, children, educators: onDuty, assigned: team.length, required, status: onDuty >= required ? 'ok' : 'breach' };
  }
  function ratioStatus(user) {
    const ctx = { register: getRegister(), staff: getStaffAttendance() };
    return classScope(user).map(cls => classRatio(cls, ctx));
  }

  /* ---------------------------------------------------------------- S19 live attendance: check-in, check-out, absence
     Append-only events `nexora-attendance-events:<school>:<date>`:
       { id, requestId, type: 'check-in'|'check-out'|'absent'|'undo'|'register'|'release-refused'|'passcode-failed',
         childId, classId, cls, date, at, by: { id, name, role }, late, start, droppedBy, collector: { id, name, relation },
         verification: { method, result }, reason, note, bulkId, reverts, corrects }
     The day's register (`nexora-register:<school>:<date>`) is the projection every page reads:
       marks { childId: 'present'|'late'|'absent' } for older readers + live { childId: { status: 'in'|'out'|'absent', … } }.
     Event and projection are saved in one commit; a repeated requestId returns the first result (no duplicates).
     Times come from this device's clock, which stands in for the school's local time. Passcodes are compared
     here and never returned or logged. This is a browser prototype: production must run these checks on a server. */

  const attEventsKey = (id, date) => `nexora-attendance-events:${id}:${date}`;
  const holidaysKey = id => `nexora-holidays:${id}`;
  const remindersKey = id => `nexora-attendance-reminders:${id}`;
  const ABSENCE_REASONS = { sick: 'Sick', holiday: 'Holiday', unknown: 'Unknown', other: 'Other' };
  const PASSCODE_TRIES = 5;
  const PASSCODE_WINDOW_MIN = 15;
  const UNDO_GRACE_MS = 15000;
  // School calendar: declared holidays (demo entries). Weekly closed days come from Settings → school days.
  // Older saved holiday list (still honoured); new holidays are Holiday / Closure events in the calendar.
  const getHolidays = () => read(holidaysKey(school.id), []);
  function schoolDay(date = today()) {
    const h = getHolidays().find(x => x.date === date) || closureOn(date);
    if (h) return { open: false, kind: 'holiday', name: h.name || h.title };
    if (!schoolDays().includes(weekdayOf(date))) return { open: false, kind: 'closed', name: new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' }) };
    return { open: true, kind: 'open', name: '' };
  }
  const registerFor = date => (date === today() ? getRegister() : read(registerKey(school.id, date), {}));
  const getAttendanceEvents = (date = today()) => read(attEventsKey(school.id, date), []);
  const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  // Expected: active, started by the date, and booked for that weekday (no booked days = every school day).
  const expectedOn = (child, date) => child.status === 'active' && (!child.startDate || child.startDate <= date) && (!child.schedule?.days?.length || child.schedule.days.includes(weekdayOf(date)));

  function attendanceView(cls, date = today()) {
    const c = classByName(cls);
    const day = schoolDay(date);
    const entry = registerFor(date)[cls] || null;
    const start = c ? classRoutine(c.id, date).blocks[0]?.start || null : null;
    const kids = day.open ? getChildren().filter(k => k.cls === cls && expectedOn(k, date)).sort((a, b) => childName(a).localeCompare(childName(b))) : [];
    const rows = kids.map(k => {
      const live = entry?.live?.[k.id] || null;
      const mark = entry?.marks?.[k.id];
      const status = live ? live.status : mark === 'absent' ? 'absent' : mark ? 'in' : 'not-arrived';
      return { child: k, status, late: live ? Boolean(live.late) : mark === 'late', detail: live, legacy: !live && Boolean(mark) };
    });
    const counts = { expected: rows.length, notArrived: 0, in: 0, out: 0, absent: 0, late: 0 };
    const KEY = { 'not-arrived': 'notArrived', in: 'in', out: 'out', absent: 'absent' };
    rows.forEach(r => { counts[KEY[r.status]] += 1; if (r.late && r.status !== 'absent') counts.late += 1; });
    return { cls, classId: c?.id || null, date, live: date === today(), day, start, entry, rows, counts };
  }

  // One shape for the S04 dashboard and anything else that totals attendance across a user's classes.
  function attendanceSummary(user, date = today()) {
    const scope = classScope(user);
    const perClass = scope.map(cls => { const v = attendanceView(cls, date); return { cls, ...v.counts, taken: Boolean(v.entry), takenAt: v.entry?.takenAt || null, complete: v.counts.expected > 0 && v.counts.notArrived === 0 }; });
    const sum = k => perClass.reduce((t, p) => t + p[k], 0);
    return { scope, day: schoolDay(date), perClass, counts: { expected: sum('expected'), in: sum('in'), out: sum('out'), absent: sum('absent'), notArrived: sum('notArrived'), late: sum('late') } };
  }

  const activeRestrictions = c => c.alerts.filter(a => a.type === 'custody' && a.status !== 'lifted' && a.restrictedPerson).map(a => ({ name: a.restrictedPerson.trim(), detail: a.detail }));
  // Who may collect, as the check-out screen sees it. Never includes the passcode, only whether one is required.
  function pickupOptions(user, childId) {
    const c = childById(childId);
    if (!c || !canView(user, 'emergency') || !classScope(user).includes(c.cls)) return null;
    const barred = activeRestrictions(c);
    const isBarred = name => barred.some(b => b.name.toLowerCase() === String(name).trim().toLowerCase());
    const contacts = (c.pickup?.authorised || []).map(p => {
      const restricted = isBarred(p.name);
      const reason = restricted ? 'Do not release' : p.status === 'pending' ? 'Pending verification — can’t collect yet' : p.status === 'suspended' ? 'Suspended — can’t collect' : p.status !== 'authorised' ? 'Not authorised' : '';
      return { id: p.id, name: p.name, relation: p.relation || '', status: p.status || 'authorised', hasIdRef: Boolean(p.idRef), eligible: !reason, restricted, reason };
    });
    return {
      contacts,
      restricted: barred.filter(b => !contacts.some(p => p.name.toLowerCase() === b.name.toLowerCase())),
      passcodeRequired: Boolean(c.pickup?.passcode),
      verification: c.pickup?.verification || '',
      custody: c.alerts.filter(a => a.type === 'custody' && a.status !== 'lifted').map(a => a.detail)
    };
  }
  // People who might drop a child off: linked guardians and listed pickup contacts (dropping off grants nothing).
  function familyContacts(child) {
    const out = [];
    (child.guardianLinks || []).forEach(l => { const g = guardianById(l.guardianId); if (g) out.push({ id: g.id, name: g.name, relation: l.relation || 'Guardian' }); });
    (child.pickup?.authorised || []).forEach(p => { if (p.id && !out.some(x => x.name.toLowerCase() === p.name.toLowerCase())) out.push({ id: p.id, name: p.name, relation: p.relation || '' }); });
    return out;
  }

  const actor = user => ({ id: user.id, name: user.name, role: user.role });
  const priorEvent = requestId => (requestId ? getAttendanceEvents().find(e => e.requestId === requestId) : null);
  function attendanceCtx(user, cls, childId) {
    if (!can(user, 'attendance') || !classScope(user).includes(cls)) return { error: 'forbidden' };
    if (!schoolDay().open) return { error: 'closed' };
    const view = attendanceView(cls);
    const row = childId ? view.rows.find(r => r.child.id === childId) : null;
    if (childId && !row) return { error: 'not-expected' };
    return { view, row };
  }
  // changes: [{ childId, live (null = clear), mark (null = clear), event }]; extra: events with no state change.
  function recordAttendance(user, cls, changes, extra = []) {
    const date = today();
    const writes = [];
    if (changes.length) {
      const reg = getRegister();
      const entry = reg[cls] || { takenAt: new Date().toISOString(), takenBy: user.name, marks: {} };
      entry.marks = entry.marks || {};
      entry.live = entry.live || {};
      changes.forEach(ch => {
        if (ch.live) entry.live[ch.childId] = ch.live; else delete entry.live[ch.childId];
        if (ch.mark) entry.marks[ch.childId] = ch.mark; else delete entry.marks[ch.childId];
      });
      entry.updatedAt = new Date().toISOString();
      if (Object.keys(entry.marks).length) reg[cls] = entry; else delete reg[cls];
      writes.push({ key: registerKey(school.id, date), value: reg });
    }
    writes.push({ key: attEventsKey(school.id, date), value: [...getAttendanceEvents(date), ...changes.map(ch => ch.event).filter(Boolean), ...extra] });
    return commit(writes);
  }
  const lateNow = start => (start ? nowMinutes() > toMinutes(start) : false);

  function checkIn(user, { cls, childId, droppedBy = '', requestId = '' }) {
    const prior = priorEvent(requestId);
    if (prior) return settle({ ok: true, repeated: true, event: prior, late: prior.late });
    const ctx = attendanceCtx(user, cls, childId);
    if (ctx.error) return settle({ ok: false, reason: ctx.error });
    const { row, view } = ctx;
    if (!['not-arrived', 'absent'].includes(row.status)) return settle({ ok: false, reason: 'conflict', status: row.status });
    let dropper = null;
    if (droppedBy) {
      dropper = familyContacts(row.child).find(p => p.id === droppedBy);
      if (!dropper) return settle({ ok: false, reason: 'invalid', errors: { droppedBy: 'Choose someone from the list, or skip this.' } });
    }
    const at = new Date().toISOString();
    const late = lateNow(view.start);
    const event = { id: newId('at'), requestId, type: 'check-in', childId, classId: view.classId, cls, date: today(), at, by: actor(user), late, start: view.start, droppedBy: dropper, corrects: row.status === 'absent' ? 'absent' : null };
    const live = { status: 'in', inAt: at, inBy: user.name, late, droppedBy: dropper };
    if (!recordAttendance(user, cls, [{ childId, live, mark: late ? 'late' : 'present', event }])) return settle({ ok: false, reason: 'storage' });
    resolveReminder(childId, today(), 'Checked in');
    events.ratio(cls);
    return settle({ ok: true, event, late });
  }

  function bulkCheckIn(user, { cls, requestId = '' }) {
    const prior = priorEvent(requestId);
    if (prior) return settle({ ok: true, repeated: true, bulkId: prior.bulkId, ids: getAttendanceEvents().filter(e => e.bulkId === prior.bulkId).map(e => e.childId) });
    const ctx = attendanceCtx(user, cls);
    if (ctx.error) return settle({ ok: false, reason: ctx.error });
    const { view } = ctx;
    const rows = view.rows.filter(r => r.status === 'not-arrived');
    if (!rows.length) return settle({ ok: false, reason: 'conflict' });
    const bulkId = newId('bulk');
    const at = new Date().toISOString();
    const late = lateNow(view.start);
    const changes = rows.map((r, i) => ({
      childId: r.child.id, mark: late ? 'late' : 'present', live: { status: 'in', inAt: at, inBy: user.name, late, droppedBy: null, bulkId },
      event: { id: newId('at'), requestId: i ? '' : requestId, type: 'check-in', childId: r.child.id, classId: view.classId, cls, date: today(), at, by: actor(user), late, start: view.start, bulkId }
    }));
    if (!recordAttendance(user, cls, changes)) return settle({ ok: false, reason: 'storage' });
    rows.forEach(r => resolveReminder(r.child.id, today(), 'Checked in'));
    events.ratio(cls);
    return settle({ ok: true, bulkId, ids: rows.map(r => r.child.id), at });
  }

  // Reverts only children whose latest attendance event is still this bulk check-in; later changes are left alone.
  function undoBulk(user, { cls, bulkId }) {
    const ctx = attendanceCtx(user, cls);
    if (ctx.error) return settle({ ok: false, reason: ctx.error });
    const all = getAttendanceEvents();
    const mine = all.filter(e => e.bulkId === bulkId && e.type === 'check-in');
    if (!mine.length) return settle({ ok: false, reason: 'missing' });
    if (mine[0].by.id !== user.id) return settle({ ok: false, reason: 'forbidden' });
    if (Date.now() - new Date(mine[0].at).getTime() > UNDO_GRACE_MS) return settle({ ok: false, reason: 'expired' });
    if (all.some(e => e.type === 'undo' && e.bulkId === bulkId)) return settle({ ok: false, reason: 'missing' });
    const STATE = ['check-in', 'check-out', 'absent', 'undo', 'register'];
    const latest = id => [...all].reverse().find(e => e.childId === id && STATE.includes(e.type));
    const at = new Date().toISOString();
    const reverted = [];
    const skipped = [];
    const changes = [];
    mine.forEach(e => {
      if (latest(e.childId)?.id !== e.id) { skipped.push(e.childId); return; }
      reverted.push(e.childId);
      changes.push({ childId: e.childId, live: null, mark: null, event: { id: newId('at'), type: 'undo', childId: e.childId, classId: e.classId, cls, date: today(), at, by: actor(user), reverts: e.id, bulkId } });
    });
    if (changes.length && !recordAttendance(user, cls, changes)) return settle({ ok: false, reason: 'storage' });
    if (changes.length) { logAudit(user, 'undo:attendance', cls, `${reverted.length} check-ins undone`); events.ratio(cls); }
    return settle({ ok: true, reverted, skipped });
  }

  function failedPasscodes(childId) {
    const since = Date.now() - PASSCODE_WINDOW_MIN * 60000;
    return getAttendanceEvents().filter(e => e.type === 'passcode-failed' && e.childId === childId && new Date(e.at).getTime() >= since).length;
  }

  // Check-out: the collector must be on the child's current list, authorised, not restricted, and pass the passcode.
  function checkOut(user, { cls, childId, collectorId, passcode = '', requestId = '' }) {
    const prior = priorEvent(requestId);
    if (prior && prior.type === 'check-out') return settle({ ok: true, repeated: true, event: prior });
    const ctx = attendanceCtx(user, cls, childId);
    if (ctx.error) return settle({ ok: false, reason: ctx.error });
    const { row, view } = ctx;
    if (row.status !== 'in') return settle({ ok: false, reason: 'conflict', status: row.status });
    const opts = pickupOptions(user, childId);
    if (!opts) return settle({ ok: false, reason: 'forbidden' });
    const base = { childId, classId: view.classId, cls, date: today(), by: actor(user) };
    const contact = opts.contacts.find(p => p.id === collectorId);
    if (!contact) return settle({ ok: false, reason: 'not-authorised', errors: { collectorId: `This person isn’t on ${row.child.firstName}’s current authorised list. The list may have just changed — choose again.` } });
    if (!contact.eligible) {
      recordAttendance(user, cls, [], [{ id: newId('at'), type: 'release-refused', ...base, at: new Date().toISOString(), collector: { id: contact.id, name: contact.name, relation: contact.relation }, reason: contact.reason }]);
      logAudit(user, 'release-refused', childId, `${contact.name}: ${contact.reason}`);
      return settle({ ok: false, reason: 'not-authorised', errors: { collectorId: `${contact.name} can’t collect ${row.child.firstName}: ${contact.reason}.` } });
    }
    if (opts.passcodeRequired) {
      if (failedPasscodes(childId) >= PASSCODE_TRIES) return settle({ ok: false, reason: 'locked', errors: { passcode: `Too many wrong passcodes. Wait ${PASSCODE_WINDOW_MIN} minutes and call a guardian or the office.` } });
      if (!String(passcode).trim()) return settle({ ok: false, reason: 'invalid', errors: { passcode: 'Enter the pickup passcode.' } });
      if (String(passcode).trim() !== String(childById(childId).pickup.passcode)) {
        recordAttendance(user, cls, [], [{ id: newId('at'), type: 'passcode-failed', ...base, at: new Date().toISOString(), collector: { id: contact.id, name: contact.name, relation: contact.relation } }]);
        logAudit(user, 'passcode-failed', childId, `Wrong pickup passcode for ${contact.name}`);
        const left = PASSCODE_TRIES - failedPasscodes(childId);
        return settle({ ok: false, reason: left > 0 ? 'invalid' : 'locked', errors: { passcode: left > 0 ? `That passcode isn’t right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : `Too many wrong passcodes. Wait ${PASSCODE_WINDOW_MIN} minutes and call a guardian or the office.` } });
      }
    }
    const at = new Date().toISOString();
    const collector = { id: contact.id, name: contact.name, relation: contact.relation };
    const verification = { method: opts.passcodeRequired ? 'passcode' : 'authorised-list', result: 'passed' };
    const event = { id: newId('at'), requestId, type: 'check-out', ...base, at, collector, verification };
    const live = { ...(row.detail || { inAt: null, late: row.late }), status: 'out', outAt: at, outBy: user.name, collector, verification };
    if (!recordAttendance(user, cls, [{ childId, live, mark: row.late ? 'late' : 'present', event }])) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'check-out', childId, `Collected by ${collector.name} (${verification.method})`);
    events.ratio(cls);
    return settle({ ok: true, event });
  }

  // "Someone else": nothing changes; the refusal is recorded for safeguarding.
  function refuseRelease(user, { cls, childId }) {
    const ctx = attendanceCtx(user, cls, childId);
    if (ctx.error) return settle({ ok: false, reason: ctx.error });
    const ok = recordAttendance(user, cls, [], [{ id: newId('at'), type: 'release-refused', childId, classId: ctx.view.classId, cls, date: today(), at: new Date().toISOString(), by: actor(user), collector: null, reason: 'Not on authorised list' }]);
    logAudit(user, 'release-refused', childId, 'Person not on the authorised list; child not released');
    return settle(ok ? { ok: true } : { ok: false, reason: 'storage' });
  }

  function markAbsent(user, { cls, childIds, reason, note = '', requestId = '' }) {
    const prior = priorEvent(requestId);
    if (prior) return settle({ ok: true, repeated: true, applied: getAttendanceEvents().filter(e => e.requestId === requestId || (prior.bulkId && e.bulkId === prior.bulkId)).map(e => e.childId), skipped: [] });
    const ctx = attendanceCtx(user, cls);
    if (ctx.error) return settle({ ok: false, reason: ctx.error });
    if (!ABSENCE_REASONS[reason]) return settle({ ok: false, reason: 'invalid', errors: { reason: 'Choose a reason.' } });
    const text = clean(note).slice(0, 500);
    const ids = [...new Set(childIds || [])];
    const rows = ids.map(id => ctx.view.rows.find(r => r.child.id === id));
    const applied = [];
    const skipped = [];
    ids.forEach((id, i) => { const r = rows[i]; if (r && ['not-arrived', 'absent'].includes(r.status)) applied.push(r); else skipped.push({ id, status: r?.status || 'not-expected' }); });
    if (!applied.length) return settle({ ok: false, reason: 'conflict', skipped });
    const at = new Date().toISOString();
    const bulkId = applied.length > 1 ? newId('bulk') : null;
    const changes = applied.map((r, i) => ({
      childId: r.child.id, mark: 'absent', live: { status: 'absent', reason, note: text, absentAt: at, absentBy: user.name },
      event: { id: newId('at'), requestId: i ? '' : requestId, type: 'absent', childId: r.child.id, classId: ctx.view.classId, cls, date: today(), at, by: actor(user), reason, note: text, bulkId, corrects: r.status === 'absent' ? 'absent' : null }
    }));
    if (!recordAttendance(user, cls, changes)) return settle({ ok: false, reason: 'storage' });
    applied.forEach(r => (reason === 'unknown' ? scheduleReminder(user, r.child.id, cls, today()) : resolveReminder(r.child.id, today(), `Reason recorded: ${ABSENCE_REASONS[reason]}`)));
    return settle({ ok: true, applied: applied.map(r => r.child.id), skipped });
  }

  /* Unknown-absence reminders `nexora-attendance-reminders:<school>`:
     { id, childId, cls, date, dueAt (10:00 that day), status: 'pending'|'due'|'resolved', resolvedAt, why }.
     There is no background job in this prototype: a pending reminder becomes due (and notifies once) when
     processDueReminders() runs — on the S19 page and dashboard while they're open. */
  const getReminders = () => read(remindersKey(school.id), []);
  function scheduleReminder(user, childId, cls, date) {
    const list = getReminders();
    if (list.some(r => r.childId === childId && r.date === date && r.status !== 'resolved')) return;
    list.push({ id: newId('rem'), childId, cls, date, dueAt: new Date(`${date}T10:00:00`).toISOString(), status: 'pending', createdAt: new Date().toISOString(), createdBy: user.name });
    write(remindersKey(school.id), list);
  }
  function resolveReminder(childId, date, why) {
    const list = getReminders();
    const open = list.filter(r => r.childId === childId && r.date === date && r.status !== 'resolved');
    if (!open.length) return;
    open.forEach(r => Object.assign(r, { status: 'resolved', resolvedAt: new Date().toISOString(), why }));
    write(remindersKey(school.id), list);
  }
  const remindersFor = (cls, date = today()) => getReminders().filter(r => r.cls === cls && r.date === date);
  function processDueReminders() {
    const list = getReminders();
    let changed = false;
    list.filter(r => r.status === 'pending' && new Date(r.dueAt).getTime() <= Date.now()).forEach(r => {
      const row = attendanceView(r.cls, r.date).rows.find(x => x.child.id === r.childId);
      if (!row || row.status !== 'absent' || row.detail?.reason !== 'unknown') { Object.assign(r, { status: 'resolved', resolvedAt: new Date().toISOString(), why: 'No longer an unknown absence' }); changed = true; return; }
      r.status = 'due';
      changed = true;
      notifyUsers({ module: 'attendance', kind: 'absence-call', title: `Call ${childName(row.child)}’s family`, body: `${r.cls}: absent with no reason given. Contact a guardian.`, recordType: 'child', recordId: r.childId, severity: 'critical', dedupeKey: `absence-call:${r.childId}:${r.date}` },
        { toRoles: STAFF_RATIO_ROLES, toUserIds: staffOf(r.cls).filter(e => e.userId).map(e => e.userId) });
    });
    if (changed) write(remindersKey(school.id), list);
  }

  /* ---------------------------------------------------------------- Daily Diary & Care Log (diary.js; S13 Daily Diary tab)
     One diary store, `nexora-diary:<school>` — the records S13 already shows — extended with typed care entries:
       { id, childId, classId, cls, date, type: 'meal'|'nap'|'toilet'|'mood'|'activity'|'note'|'photo', at (event time, ISO),
         status: 'draft'|'published'|'internal', data: {…per type…}, title/meals/rest/notes (summary fields older readers
         use), author, byId, createdAt, updatedAt, updatedBy, publishedAt, publishedBy, bulkId, requestId, allergyCheck,
         history: [{ at, by, action, detail }] }
     draft = staff only, not yet shared · published = shared with the child's family · internal = staff only, never shared.
     Older entries (title/meals/rest/notes only) are read as published notes.
     Photos `nexora-diary-photos:<school>` { id, data (downscaled data URL), mime, size, by, at } are stored once and
     referenced by each child's photo entry. This is device storage only — production needs private object storage.
     Menu `nexora-menus:<school>` { [weekday]: [{ id, meal, name, allergens: [ids] | null, tags }] } is a demo menu;
     allergens null means ingredients aren't recorded, which is never treated as safe.
     Every rule (permissions, class, attendance, allergy acknowledgement, nap overlap, photo consent) is checked here. */

  const menusKey = id => `nexora-menus:${id}`;
  const diaryPhotosKey = id => `nexora-diary-photos:${id}`;
  const DIARY_TYPES = { meal: 'Meal', nap: 'Nap', toilet: 'Toileting', mood: 'Mood', activity: 'Activity', note: 'Note', photo: 'Photo' };
  const MEAL_TYPES = { breakfast: 'Breakfast', 'morning-snack': 'Morning snack', lunch: 'Lunch', 'afternoon-snack': 'Afternoon snack', other: 'Other' };
  const MEAL_AMOUNTS = { none: 'None', some: 'Some', most: 'Most', all: 'All' };
  const TOILET_TYPES = { wet: 'Wet', dry: 'Dry', bm: 'BM', potty: 'Potty', accident: 'Accident' };
  const MOODS = { 'very-unhappy': 'Very unhappy', unhappy: 'Unhappy', neutral: 'Neutral', happy: 'Happy', 'very-happy': 'Very happy' };
  const DIARY_STATUS = { draft: 'Draft', published: 'Shared with family', internal: 'Staff only' };
  const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const PHOTO_MAX = 1024 * 1024;
  const ALLERGENS = { peanut: 'Peanuts', 'tree-nut': 'Tree nuts', dairy: 'Dairy', egg: 'Egg', gluten: 'Gluten', soy: 'Soy', sesame: 'Sesame', fish: 'Fish', shellfish: 'Shellfish', gelatine: 'Gelatine', meat: 'Meat', 'root-veg': 'Root vegetables' };
  const ALLERGEN_WORDS = [['peanut', /peanut|groundnut/i], ['tree-nut', /cashew|pistachio|almond|walnut|hazelnut|pecan|tree[\s-]?nut/i], ['dairy', /dairy|milk|lactose|cheese|paneer|curd|yogh?urt|butter|ghee/i], ['egg', /\begg/i], ['gluten', /gluten|wheat|co?eliac/i], ['soy', /\bsoy/i], ['sesame', /sesame/i], ['fish', /\bfish/i], ['shellfish', /shellfish|prawn|shrimp|crab|lobster/i], ['gelatine', /gelatin/i]];
  const NON_FOOD = /\bbee\b|sting|insect|wasp|latex|dust|pollen|penicillin|plaster/i;

  // Demo school menu by weekday (school configuration). An item with allergens: null has no ingredient record.
  const MENU_SEED = {
    mon: [['morning-snack', 'Banana and apple slices', []], ['morning-snack', 'Warm milk', ['dairy']], ['lunch', 'Vegetable pulao', []], ['lunch', 'Curd raita', ['dairy']], ['lunch', 'Cashew kheer', ['dairy', 'tree-nut']], ['afternoon-snack', 'Peanut chikki', ['peanut']]],
    tue: [['morning-snack', 'Papaya cubes', []], ['lunch', 'Idli and sambar', []], ['lunch', 'Coconut chutney', []], ['afternoon-snack', 'Egg muffin', ['egg', 'gluten', 'dairy']], ['afternoon-snack', 'Buttermilk', ['dairy']]],
    wed: [['morning-snack', 'Orange segments', []], ['lunch', 'Chapati', ['gluten']], ['lunch', 'Dal tadka', []], ['lunch', 'Paneer butter masala', ['dairy']], ['afternoon-snack', 'Sesame ladoo', ['sesame']]],
    thu: [['morning-snack', 'Watermelon', []], ['lunch', 'Lemon rice', ['peanut']], ['lunch', 'Potato fry', [], ['root-veg']], ['lunch', 'Cucumber salad', []], ['afternoon-snack', 'Birthday cake (from a family)', null]],
    fri: [['morning-snack', 'Grapes', []], ['lunch', 'Vegetable noodles', ['gluten', 'soy']], ['lunch', 'Chicken curry', [], ['meat']], ['lunch', 'Steamed rice', []], ['afternoon-snack', 'Fruit custard', ['dairy']]]
  };
  const getMenus = () => seeded(menusKey(school.id), () => Object.fromEntries(Object.entries(MENU_SEED).map(([day, items]) => [day, items.map(([meal, name, allergens, tags], i) => ({ id: `${day}-${i + 1}`, meal, name, allergens, tags: tags || [] }))])));
  function menuFor(date) {
    const day = schoolDay(date);
    if (!day.open) return { available: false, reason: day.kind === 'holiday' ? `${day.name} — no menu` : 'School closed — no menu', items: [] };
    const items = getMenus()[weekdayOf(date)] || [];
    return items.length ? { available: true, reason: '', items } : { available: false, reason: 'No menu has been set for this day', items: [] };
  }

  // A child's food rules from their current alerts. An allergy naming no known food allergen is "unmatched" (check by hand).
  function dietaryRule(detail) {
    const avoid = new Set();
    const check = new Set();
    if (/vegetarian|vegan/i.test(detail)) ['meat', 'fish', 'shellfish', 'gelatine'].forEach(x => avoid.add(x));
    if (/vegan/i.test(detail)) ['dairy', 'egg'].forEach(x => avoid.add(x));
    if (/jain/i.test(detail)) ['meat', 'fish', 'shellfish', 'egg', 'gelatine', 'root-veg'].forEach(x => avoid.add(x));
    if (/root veg/i.test(detail)) avoid.add('root-veg');
    if (/halal/i.test(detail)) check.add('meat');
    if (/\bno\b|free|avoid|without/i.test(detail)) ALLERGEN_WORDS.forEach(([id, re]) => { if (re.test(detail)) avoid.add(id); });
    return { avoid: [...avoid], check: [...check] };
  }
  function foodRules(child) {
    const rules = { allergies: [], dietary: [], unmatched: [] };
    child.alerts.filter(a => a.status !== 'lifted').forEach(a => {
      if (a.type === 'allergy') {
        const ids = a.allergen && ALLERGENS[a.allergen] ? [a.allergen] : ALLERGEN_WORDS.filter(([, re]) => re.test(a.detail)).map(([id]) => id);
        if (ids.length) rules.allergies.push({ ids, detail: a.detail, severe: a.severity === 'severe' });
        else if (!NON_FOOD.test(a.detail)) rules.unmatched.push(a.detail);
      } else if (a.type === 'dietary') {
        const d = dietaryRule(a.detail);
        if (d.avoid.length || d.check.length) rules.dietary.push({ ...d, detail: a.detail });
        else rules.unmatched.push(a.detail);
      }
    });
    return rules;
  }
  const mealSignature = (childIds, itemIds) => `${[...childIds].sort().join(',')}|${[...itemIds].sort().join(',')}`;
  // Checks every selected child against every selected item. Roles without Medical access learn that a warning
  // exists (count only), never the detail.
  function mealCheck(user, { childIds = [], itemIds = [], date = today() }) {
    const menu = menuFor(date);
    const items = itemIds.map(id => menu.items.find(i => i.id === id)).filter(Boolean);
    const found = new Map();
    const unmatched = [];
    const add = (c, kind, label, item, severe = false) => {
      const k = `${c.id}|${kind}|${label}`;
      const cur = found.get(k) || { childId: c.id, name: c.preferredName || c.firstName, kind, label, items: [], severe };
      if (!cur.items.includes(item)) cur.items.push(item);
      found.set(k, cur);
    };
    childIds.forEach(id => {
      const c = childById(id);
      if (!c) return;
      const r = foodRules(c);
      items.forEach(it => {
        if (!Array.isArray(it.allergens)) return;
        const has = new Set([...it.allergens, ...(it.tags || [])]);
        r.allergies.forEach(a => a.ids.filter(x => has.has(x)).forEach(x => add(c, 'allergy', ALLERGENS[x], it.name, a.severe)));
        r.dietary.forEach(d => {
          d.avoid.filter(x => has.has(x)).forEach(x => add(c, 'dietary', ALLERGENS[x], it.name));
          d.check.filter(x => has.has(x)).forEach(() => add(c, 'check', d.detail, it.name));
        });
      });
      if (items.length) r.unmatched.forEach(detail => unmatched.push({ childId: c.id, name: c.preferredName || c.firstName, detail }));
    });
    const conflicts = [...found.values()];
    const unknownItems = items.filter(i => !Array.isArray(i.allergens)).map(i => i.name);
    const seeHealth = canView(user, 'medical');
    return {
      conflicts: seeHealth ? conflicts : [], hidden: seeHealth ? 0 : conflicts.length + unmatched.length,
      unknownItems, unmatched: seeHealth ? unmatched : [],
      needsAck: conflicts.length > 0 || unknownItems.length > 0 || unmatched.length > 0,
      signature: mealSignature(childIds, itemIds)
    };
  }

  const fmtTime = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const fmtDuration = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`; };
  // Reads any diary record in the typed shape; older S13 entries become published notes.
  function diaryEntry(e) {
    if (e.type) return e;
    const text = [e.meals && `Meals: ${e.meals}`, e.rest && `Rest: ${e.rest}`, e.notes].filter(Boolean).join(' · ');
    return { ...e, type: 'note', at: e.createdAt, status: 'published', data: { text: text || e.title }, legacy: true };
  }
  const allDiary = () => read(diaryKey(school.id), []);
  function diaryDay(cls, date = today()) {
    const c = classByName(cls);
    const att = attendanceView(cls, date);
    const live = date === today();
    const kids = live
      ? att.rows.map(r => ({ child: r.child, attendance: r.status }))
      : getChildren().filter(k => k.cls === cls && k.status === 'active').sort((a, b) => childName(a).localeCompare(childName(b))).map(k => ({ child: k, attendance: null }));
    const onDay = allDiary().filter(e => e.date === date).map(diaryEntry);
    const rows = kids.map(k => {
      const entries = onDay.filter(e => e.childId === k.child.id).sort((a, b) => a.at.localeCompare(b.at));
      const latest = {};
      entries.forEach(e => { latest[e.type] = e; });
      return { ...k, entries, latest, activeNap: entries.find(e => e.type === 'nap' && !e.data?.end) || null };
    });
    return { cls, classId: c?.id || null, date, live, day: att.day, rows, menu: menuFor(date) };
  }

  function diaryCtx(user, cls, date, childIds) {
    if (!canEditSection(user, 'diary') || !classScope(user).includes(cls)) return { error: 'forbidden' };
    if (date !== today()) return { error: 'past' };
    if (!schoolDay(date).open) return { error: 'closed' };
    const att = attendanceView(cls, date);
    const ids = [...new Set(childIds || [])];
    if (!ids.length) return { error: 'invalid', errors: { children: 'Choose at least one child.' } };
    const children = [];
    const skipped = [];
    ids.forEach(id => {
      const r = att.rows.find(x => x.child.id === id);
      if (!r) skipped.push({ id, name: childById(id)?.firstName || 'A child', reason: 'Not in this class today' });
      else if (r.status === 'absent') skipped.push({ id, name: r.child.firstName, reason: 'Absent today' });
      else children.push(r.child);
    });
    return { att, children, skipped, classId: classByName(cls)?.id || null };
  }
  function eventTime(date, time) {
    if (!/^\d{2}:\d{2}$/.test(String(time || ''))) return { error: 'Enter a time.' };
    const at = new Date(`${date}T${time}:00`);
    if (Number.isNaN(at.getTime())) return { error: 'Enter a valid time.' };
    if (at.getTime() > Date.now() + 5 * 60000) return { error: 'That time is in the future.' };
    return { at: at.toISOString() };
  }

  // Validates one entry's content. Returns { values: { data, title, meals, rest, notes }, errors }.
  function diaryValues(type, input, date) {
    const errors = {};
    const note = clean(input.note).slice(0, 500);
    if (clean(input.note).length > 500) errors.note = 'Keep the note under 500 characters.';
    let data = {};
    let title = '';
    let meals = '';
    let rest = '';
    let notes = note;
    if (type === 'meal') {
      const menu = menuFor(date);
      const itemIds = [...new Set(input.itemIds || [])];
      const items = itemIds.map(id => menu.items.find(i => i.id === id));
      if (!MEAL_TYPES[input.mealType]) errors.mealType = 'Choose the meal.';
      if (!MEAL_AMOUNTS[input.amount]) errors.amount = 'Choose how much was eaten.';
      if (items.some(i => !i)) errors.items = 'One of the menu items is no longer on today’s menu. Choose again.';
      const other = clean(input.otherFood).slice(0, 120);
      if (!items.length && !other) errors.items = menu.available ? 'Choose what was served, or describe it.' : 'Describe what was served — there is no menu for today.';
      data = { mealType: input.mealType, items: items.filter(Boolean).map(i => ({ id: i.id, name: i.name })), otherFood: other, amount: input.amount, note };
      const food = [...data.items.map(i => i.name), other].filter(Boolean).join(', ');
      title = `${MEAL_TYPES[input.mealType] || 'Meal'} · ${MEAL_AMOUNTS[input.amount] || ''}`;
      meals = `${MEAL_TYPES[input.mealType] || 'Meal'}: ${food} — ate ${String(MEAL_AMOUNTS[input.amount] || '').toLowerCase()}`;
    } else if (type === 'toilet') {
      if (!TOILET_TYPES[input.kind]) errors.kind = 'Choose a type.';
      data = { kind: input.kind, note };
      title = `Toileting · ${TOILET_TYPES[input.kind] || ''}`;
    } else if (type === 'mood') {
      if (!MOODS[input.mood]) errors.mood = 'Choose a mood.';
      data = { mood: input.mood, note };
      title = `Mood · ${MOODS[input.mood] || ''}`;
    } else if (type === 'activity') {
      const name = clean(input.title).slice(0, 80);
      if (!name) errors.title = 'Give the activity a title.';
      if (input.area && !LEARNING_AREAS.includes(input.area)) errors.area = 'Choose a learning area from the list.';
      const description = clean(input.description).slice(0, 1000);
      data = { title: name, area: input.area || '', description, note };
      title = `Activity · ${name}`;
      notes = [input.area, description, note].filter(Boolean).join(' · ');
    } else if (type === 'note') {
      const text = clean(input.text);
      if (!text) errors.text = 'Write the note.';
      else if (text.length > 1000) errors.text = 'Keep the note under 1,000 characters.';
      data = { text: text.slice(0, 1000) };
      title = 'Note';
      notes = data.text;
    } else if (type === 'nap') {
      const s = eventTime(date, input.start);
      const e = input.end ? eventTime(date, input.end) : { at: null };
      if (s.error) errors.start = s.error;
      if (e.error) errors.end = e.error;
      if (!s.error && !e.error && e.at && e.at < s.at) errors.end = 'The end time can’t be before the start.';
      data = { start: s.at || null, end: e.at || null, note };
      title = data.end && data.start ? `Nap · ${fmtDuration(new Date(data.end) - new Date(data.start))}` : 'Nap · sleeping';
      rest = data.start ? (data.end ? `Slept ${fmtTime(data.start)}–${fmtTime(data.end)} (${fmtDuration(new Date(data.end) - new Date(data.start))})` : `Asleep since ${fmtTime(data.start)}`) : '';
    }
    return { values: { data, title, meals, rest, notes }, errors };
  }
  const diaryStatus = (type, wanted) => (type === 'note' && wanted === 'internal' ? 'internal' : wanted === 'published' ? 'published' : 'draft');
  const photoConsent = childId => getConsents(childId).find(x => x.type === 'photos-gallery')?.status === 'granted';

  // Creates one record per selected child in a single write (all or nothing). Absent children are skipped and reported.
  function saveDiaryEntries(user, { cls, date, type, childIds, time, status = 'draft', requestId = '', allergyAck = '', ...input }) {
    if (requestId) {
      const prior = allDiary().filter(e => e.requestId === requestId);
      if (prior.length) return settle({ ok: true, repeated: true, entries: prior, skipped: [] });
    }
    if (!DIARY_TYPES[type] || type === 'photo') return settle({ ok: false, reason: 'invalid' });
    const ctx = diaryCtx(user, cls, date, childIds);
    if (ctx.error) return settle({ ok: false, reason: ctx.error, errors: ctx.errors });
    if (!ctx.children.length) return settle({ ok: false, reason: 'none', skipped: ctx.skipped });
    const t = type === 'nap' ? { at: null } : eventTime(date, time);
    const { values, errors } = diaryValues(type, input, date);
    if (t.error) errors.time = t.error;
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    let allergyCheck = null;
    if (type === 'meal') {
      const check = mealCheck(user, { childIds: ctx.children.map(c => c.id), itemIds: values.data.items.map(i => i.id), date });
      if (check.needsAck && allergyAck !== check.signature) return settle({ ok: false, reason: 'allergy-ack', check });
      allergyCheck = check.needsAck ? { acknowledged: true, by: user.name, byId: user.id, at: new Date().toISOString(), warnings: check.conflicts.length + check.hidden + check.unmatched.length, unknownItems: check.unknownItems } : { acknowledged: false, warnings: 0 };
    }
    if (type === 'nap') {
      const day = diaryDay(cls, date);
      const clash = ctx.children.find(c => { const row = day.rows.find(r => r.child.id === c.id); return row && row.entries.some(e => e.type === 'nap' && overlapsNap(e.data, values.data)); });
      if (clash) return settle({ ok: false, reason: 'invalid', errors: { start: `${clash.firstName} already has a nap at that time.` } });
    }
    const now = new Date().toISOString();
    const bulkId = ctx.children.length > 1 ? newId('bulk') : null;
    const st = diaryStatus(type, status);
    const made = ctx.children.map(c => ({
      id: newId('dy'), childId: c.id, classId: ctx.classId, cls, date, type, at: type === 'nap' ? values.data.start : t.at,
      status: st, ...values, data: type === 'activity' && input.perChild?.[c.id] ? { ...values.data, description: clean(input.perChild[c.id]).slice(0, 1000) } : values.data,
      author: user.name, byId: user.id, createdAt: now, bulkId, requestId, allergyCheck,
      publishedAt: st === 'published' ? now : null, publishedBy: st === 'published' ? user.name : null,
      history: [{ at: now, by: user.name, action: 'created', detail: `${DIARY_TYPES[type]} · ${DIARY_STATUS[st]}` }]
    }));
    if (!write(diaryKey(school.id), [...allDiary(), ...made])) return settle({ ok: false, reason: 'storage' });
    logAudit(user, `add:diary-${type}`, made.length === 1 ? made[0].childId : cls, `${made.length} ${DIARY_TYPES[type].toLowerCase()} entr${made.length === 1 ? 'y' : 'ies'}${allergyCheck?.acknowledged ? ' · allergy warning checked' : ''}`);
    return settle({ ok: true, entries: made, skipped: ctx.skipped });
  }
  const overlapsNap = (a, b) => {
    const as = new Date(a.start).getTime(); const ae = a.end ? new Date(a.end).getTime() : Infinity;
    const bs = new Date(b.start).getTime(); const be = b.end ? new Date(b.end).getTime() : Infinity;
    return as < be && bs < ae;
  };

  function startNaps(user, { cls, childIds, requestId = '' }) {
    if (requestId) { const prior = allDiary().filter(e => e.requestId === requestId); if (prior.length) return settle({ ok: true, repeated: true, entries: prior, skipped: [] }); }
    const ctx = diaryCtx(user, cls, today(), childIds);
    if (ctx.error) return settle({ ok: false, reason: ctx.error, errors: ctx.errors });
    const day = diaryDay(cls);
    const skipped = [...ctx.skipped];
    const now = new Date().toISOString();
    const bulkId = ctx.children.length > 1 ? newId('bulk') : null;
    const made = [];
    ctx.children.forEach(c => {
      if (day.rows.find(r => r.child.id === c.id)?.activeNap) { skipped.push({ id: c.id, name: c.firstName, reason: 'Already napping' }); return; }
      made.push({ id: newId('dy'), childId: c.id, classId: ctx.classId, cls, date: today(), type: 'nap', at: now, status: 'draft', data: { start: now, end: null, note: '' }, title: 'Nap · sleeping', meals: '', rest: `Asleep since ${fmtTime(now)}`, notes: '', author: user.name, byId: user.id, createdAt: now, bulkId, requestId, history: [{ at: now, by: user.name, action: 'nap-started', detail: fmtTime(now) }] });
    });
    if (!made.length) return settle({ ok: false, reason: 'none', skipped });
    if (!write(diaryKey(school.id), [...allDiary(), ...made])) return settle({ ok: false, reason: 'storage' });
    return settle({ ok: true, entries: made, skipped });
  }

  function stopNaps(user, { cls, childIds }) {
    if (!canEditSection(user, 'diary') || !classScope(user).includes(cls)) return settle({ ok: false, reason: 'forbidden' });
    // Any child of this class with a running nap can be woken, even if they were later marked absent or collected.
    const ids = new Set((childIds || []).filter(id => childById(id)?.cls === cls));
    const all = allDiary();
    const now = new Date().toISOString();
    const stopped = [];
    all.forEach(e => {
      if (e.type !== 'nap' || e.date !== today() || e.data?.end || !ids.has(e.childId)) return;
      e.data = { ...e.data, end: now };
      const dur = fmtDuration(new Date(now) - new Date(e.data.start));
      Object.assign(e, { title: `Nap · ${dur}`, rest: `Slept ${fmtTime(e.data.start)}–${fmtTime(now)} (${dur})`, updatedAt: now, updatedBy: user.name, history: [...(e.history || []), { at: now, by: user.name, action: 'nap-stopped', detail: fmtTime(now) }] });
      stopped.push(e);
    });
    if (!stopped.length) return settle({ ok: false, reason: 'none' });
    if (!write(diaryKey(school.id), all)) return settle({ ok: false, reason: 'storage' });
    return settle({ ok: true, entries: stopped });
  }

  // Edits one entry (any date the user's class owns). The change is kept in the entry's history.
  function updateDiaryEntry(user, entryId, { time, status, allergyAck = '', ...input }) {
    const all = allDiary();
    const e = all.find(x => x.id === entryId);
    if (!e || !e.type) return settle({ ok: false, reason: 'missing' });
    const child = childById(e.childId);
    if (!child || !canEditSection(user, 'diary') || !classScope(user).includes(child.cls)) return settle({ ok: false, reason: 'forbidden' });
    if (e.type === 'photo') {
      const caption = clean(input.caption).slice(0, 200);
      if (status === 'published' && !photoConsent(e.childId)) return settle({ ok: false, reason: 'consent', errors: { status: `${child.firstName}’s family hasn’t given photo consent, so this photo can’t be shared.` } });
      e.data = { ...e.data, caption };
    } else {
      const merged = e.type === 'meal' ? { ...e.data, itemIds: input.itemIds || e.data.items.map(i => i.id), ...input } : { ...e.data, ...input };
      const { values, errors } = diaryValues(e.type, merged, e.date);
      const t = e.type === 'nap' ? { at: values.data.start } : time ? eventTime(e.date, time) : { at: e.at };
      if (t.error) errors.time = t.error;
      if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
      if (e.type === 'meal') {
        const changedItems = mealSignature([e.childId], values.data.items.map(i => i.id)) !== mealSignature([e.childId], e.data.items.map(i => i.id));
        const check = mealCheck(user, { childIds: [e.childId], itemIds: values.data.items.map(i => i.id), date: e.date });
        if (changedItems && check.needsAck && allergyAck !== check.signature) return settle({ ok: false, reason: 'allergy-ack', check });
        if (changedItems) e.allergyCheck = check.needsAck ? { acknowledged: true, by: user.name, byId: user.id, at: new Date().toISOString(), warnings: check.conflicts.length + check.hidden + check.unmatched.length, unknownItems: check.unknownItems } : { acknowledged: false, warnings: 0 };
      }
      if (e.type === 'nap') {
        const others = all.filter(x => x.id !== e.id && x.childId === e.childId && x.date === e.date && x.type === 'nap');
        if (others.some(x => overlapsNap(x.data, values.data))) return settle({ ok: false, reason: 'invalid', errors: { start: 'This overlaps another nap for the same child.' } });
      }
      Object.assign(e, values, { at: t.at });
    }
    const now = new Date().toISOString();
    const before = e.status;
    if (status) {
      const st = diaryStatus(e.type, status);
      if (before === 'internal' && st !== 'internal') return settle({ ok: false, reason: 'invalid', errors: { status: 'Staff-only notes can’t be shared with families. Write a new note instead.' } });
      e.status = st;
      if (st === 'published' && before !== 'published') Object.assign(e, { publishedAt: now, publishedBy: user.name });
    }
    Object.assign(e, { updatedAt: now, updatedBy: user.name, history: [...(e.history || []), { at: now, by: user.name, action: 'edited', detail: before !== e.status ? `${DIARY_STATUS[before]} → ${DIARY_STATUS[e.status]}` : 'Details changed' }] });
    if (!write(diaryKey(school.id), all)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'edit:diary', e.childId, e.title);
    return settle({ ok: true, entry: e });
  }

  // Shares drafts with families. Staff-only notes and photos without consent are skipped and reported.
  function publishDiaryEntries(user, entryIds) {
    const all = allDiary();
    const now = new Date().toISOString();
    const published = [];
    const skipped = [];
    [...new Set(entryIds)].forEach(id => {
      const e = all.find(x => x.id === id);
      const child = e && childById(e.childId);
      if (!e || !e.type || !child || !canEditSection(user, 'diary') || !classScope(user).includes(child.cls)) { skipped.push({ id, reason: 'Not found or not yours' }); return; }
      if (e.status === 'published') return;
      if (e.status === 'internal') { skipped.push({ id, name: child.firstName, reason: 'Staff-only note' }); return; }
      if (e.type === 'nap' && !e.data?.end) { skipped.push({ id, name: child.firstName, reason: 'Nap still running' }); return; }
      if (e.type === 'photo' && !photoConsent(e.childId)) { skipped.push({ id, name: child.firstName, reason: 'No photo consent' }); return; }
      Object.assign(e, { status: 'published', publishedAt: now, publishedBy: user.name, history: [...(e.history || []), { at: now, by: user.name, action: 'published', detail: 'Shared with family' }] });
      published.push(e);
    });
    if (published.length && !write(diaryKey(school.id), all)) return settle({ ok: false, reason: 'storage' });
    if (published.length) logAudit(user, 'publish:diary', published.length === 1 ? published[0].childId : published[0].cls, `${published.length} diary entr${published.length === 1 ? 'y' : 'ies'} shared`);
    return settle({ ok: true, published: published.map(e => e.id), skipped });
  }

  // One photo, linked to each selected child. Several children need explicit confirmation; sharing needs every
  // pictured child's photo consent. Stored on this device only.
  function addDiaryPhoto(user, { cls, date, childIds, data, mime, size, caption = '', time, status = 'draft', confirmMulti = false, requestId = '' }) {
    if (requestId) { const prior = allDiary().filter(e => e.requestId === requestId); if (prior.length) return settle({ ok: true, repeated: true, entries: prior, skipped: [] }); }
    const ctx = diaryCtx(user, cls, date, childIds);
    if (ctx.error) return settle({ ok: false, reason: ctx.error, errors: ctx.errors });
    const errors = {};
    if (!PHOTO_TYPES.includes(mime) || !new RegExp(`^data:${String(mime).replace('/', '\\/')};base64,`).test(String(data || ''))) errors.file = 'Choose a JPEG, PNG or WebP photo.';
    else if (!(Number(size) > 0) || Number(size) > PHOTO_MAX || String(data).length > PHOTO_MAX * 1.4) errors.file = 'The photo is too large. Choose one under 1 MB.';
    const t = eventTime(date, time);
    if (t.error) errors.time = t.error;
    if (!ctx.children.length) errors.children = 'Choose at least one child who is here today.';
    if (ctx.children.length > 1 && !confirmMulti) errors.confirmMulti = 'Confirm that this photo shows every selected child.';
    const st = status === 'published' ? 'published' : 'draft';
    const noConsent = st === 'published' ? ctx.children.filter(c => !photoConsent(c.id)) : [];
    if (noConsent.length) errors.status = `Can’t share: no photo consent for ${noConsent.map(c => c.firstName).join(', ')}. Save as a draft instead.`;
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const now = new Date().toISOString();
    const photo = { id: newId('ph'), data, mime, size: Number(size), by: user.name, byId: user.id, at: now, classId: ctx.classId };
    const cap = clean(caption).slice(0, 200);
    const bulkId = ctx.children.length > 1 ? newId('bulk') : null;
    const made = ctx.children.map(c => ({ id: newId('dy'), childId: c.id, classId: ctx.classId, cls, date, type: 'photo', at: t.at, status: st, data: { photoId: photo.id, caption: cap, with: ctx.children.map(x => x.id) }, title: cap ? `Photo · ${cap}` : 'Photo', meals: '', rest: '', notes: cap, author: user.name, byId: user.id, createdAt: now, bulkId, requestId, publishedAt: st === 'published' ? now : null, publishedBy: st === 'published' ? user.name : null, history: [{ at: now, by: user.name, action: 'created', detail: `Photo · ${DIARY_STATUS[st]}` }] }));
    if (!commit([{ key: diaryPhotosKey(school.id), value: [...read(diaryPhotosKey(school.id), []), photo] }, { key: diaryKey(school.id), value: [...allDiary(), ...made] }])) return settle({ ok: false, reason: 'storage', errors: { file: 'This device has run out of space for photos. Nothing was saved.' } });
    logAudit(user, 'add:diary-photo', made.length === 1 ? made[0].childId : cls, `${made.length} child${made.length === 1 ? '' : 'ren'}`);
    return settle({ ok: true, entries: made, skipped: ctx.skipped });
  }
  // Photos are only handed to school staff who can see the diary of a pictured child.
  function diaryPhoto(user, photoId) {
    if (!canView(user, 'diary')) return null;
    const linked = allDiary().filter(e => e.type === 'photo' && e.data?.photoId === photoId);
    if (!linked.some(e => { const c = childById(e.childId); return c && classScope(user).includes(c.cls); })) return null;
    return read(diaryPhotosKey(school.id), []).find(p => p.id === photoId)?.data || null;
  }
  // What the child's family would see: shared entries only; a photo also needs every pictured child's consent.
  function familyDiary(childId) {
    return allDiary().filter(e => e.childId === childId).map(diaryEntry)
      .filter(e => e.status === 'published' && (e.type !== 'photo' || (e.data?.with || [e.childId]).every(photoConsent)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at));
  }

  /* ---------------------------------------------------------------- Calendar & Events (calendar.js; dashboard, class, child pages)
     Series `nexora-events:<school>`: { id, schoolId, title, type, allDay, start, end (local 'YYYY-MM-DDTHH:MM', or
       'YYYY-MM-DD' for all-day; the end date is inclusive), repeat: 'none'|'weekly'|'monthly', until, location,
       description, classIds ([] = whole school), staffIds, rsvp, consent, attachments [fileId], status: 'active'|'cancelled',
       exceptions: { [originalDate]: { cancelled, by, at } | { override: {…event fields} } }, createdBy, createdAt,
       updatedBy, updatedAt, history }
     Occurrence id = `${seriesId}@${originalDate}`. Monthly series skip months that don't have the start day
     (a series on the 31st has no February, April, June, September or November occurrence).
     RSVPs `nexora-event-rsvps:<school>` and consents `nexora-event-consents:<school>` are separate records per
     occurrence + child, so an RSVP "yes" is never treated as consent.
     Notices `nexora-event-notices:<school>` record reminders and move notices per guardian. No message is delivered in
     this prototype: a guardian with an active parent-app account is recorded as "queued (demo)", others are skipped.
     Files `nexora-event-files:<school>`: PDF/JPEG/PNG ≤ 1 MB stored on this device.
     Leaders create, edit, move and delete; class staff record RSVP and consent for their classes. A school-wide
     Holiday / Closure closes the school for attendance and the diary (schoolDay). */

  const eventsKey = id => `nexora-events:${id}`;
  const rsvpKey = id => `nexora-event-rsvps:${id}`;
  const eventConsentKey = id => `nexora-event-consents:${id}`;
  const noticesKey = id => `nexora-event-notices:${id}`;
  const eventFilesKey = id => `nexora-event-files:${id}`;
  const calPrefsKey = userId => `nexora-calendar-prefs:${userId}`;
  const EVENT_TYPES = { event: 'Event', trip: 'Trip', meeting: 'Meeting', holiday: 'Holiday / Closure', conference: 'Parent conference' };
  const EVENT_REPEATS = { none: 'Does not repeat', weekly: 'Weekly', monthly: 'Monthly' };
  const RSVP_TYPES = ['event', 'trip', 'conference'];
  const CONSENT_EVENT_TYPES = ['event', 'trip'];
  const canManageEvents = user => LEADERS.includes(user.role);
  const dAdd = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return isoDate(x); };
  const dDiff = (a, b) => Math.round((new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / 86400000);
  const datePart = v => String(v).slice(0, 10);
  const timePart = v => (String(v).length > 10 ? String(v).slice(11, 16) : '');
  const isTime = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ''));

  function getEvents() {
    return seeded(eventsKey(school.id), () => {
      // Demo calendar, relative to today. No RSVP or consent replies are seeded.
      const nextWd = (wd, after = 1) => { let d = daysFromToday(after); while (new Date(`${d}T12:00:00`).getDay() !== wd) d = dAdd(d, 1); return d; };
      const mk = (title, type, start, end, extra = {}) => ({ id: newId('ev'), schoolId: school.id, title, type, allDay: start.length === 10, start, end, repeat: 'none', until: '', location: '', description: '', classIds: [], staffIds: [], rsvp: false, consent: false, attachments: [], status: 'active', exceptions: {}, createdBy: 'Mrs. Rao', createdAt: atToday(9, 0, -14), updatedBy: null, updatedAt: null, history: [{ at: atToday(9, 0, -14), by: 'Mrs. Rao', action: 'created' }], ...extra });
      const fri = nextWd(5);
      const wed = nextWd(3, 0);
      const mon = nextWd(1, 7);
      const trip = nextWd(4, 8);
      const montA = getClassRegistry().find(c => c.name === 'Montessori A');
      return [
        mk('Deepavali holiday', 'holiday', '2026-11-09', '2026-11-09', { description: 'School closed.' }),
        mk('Christmas Day', 'holiday', '2026-12-25', '2026-12-25', { description: 'School closed.' }),
        mk('Diwali celebration', 'event', `${fri}T10:00`, `${fri}T12:00`, { location: 'Garden courtyard', description: 'Children may come in traditional clothes. Please send a small diya for the class display.', rsvp: true }),
        mk('Staff meeting', 'meeting', `${wed}T15:30`, `${wed}T16:30`, { repeat: 'weekly', until: dAdd(wed, 70), location: 'Staff room', staffIds: educators.filter(e => !e.relief).map(e => e.id) }),
        mk('Parent–teacher conferences', 'conference', `${mon}T14:00`, `${mon}T17:00`, { location: 'Classrooms', description: '15-minute slots for each family.', rsvp: true }),
        mk('Farm visit', 'trip', `${trip}T09:00`, `${trip}T13:00`, { location: 'Green Acres Farm, Kelambakkam', description: 'Bus leaves at 09:00 sharp. Packed lunch provided.', classIds: montA ? [montA.id] : [], staffIds: ['ed-lakshmi', 'ed-deepa'], rsvp: true, consent: true })
      ];
    });
  }
  const saveEvents = list => write(eventsKey(school.id), list);

  function seriesDates(s) {
    const first = datePart(s.start);
    if (s.repeat === 'none') return [first];
    const until = s.until || first;
    const out = [];
    if (s.repeat === 'weekly') {
      for (let d = first; d <= until && out.length < 600; d = dAdd(d, 7)) out.push(d);
    } else {
      const [y, m, day] = first.split('-').map(Number);
      for (let i = 0; i < 240; i++) {
        const dt = new Date(y, m - 1 + i, day, 12);
        if (dt.getDate() !== day) continue; // this month has no such day: skipped
        const iso = isoDate(dt);
        if (iso > until) break;
        out.push(iso);
      }
    }
    return out;
  }
  const FIELDS = ['title', 'type', 'allDay', 'start', 'end', 'location', 'description', 'classIds', 'staffIds', 'rsvp', 'consent', 'attachments'];
  function occurrencesOf(s) {
    if (s.status !== 'active') return [];
    const first = datePart(s.start);
    return seriesDates(s).flatMap(d => {
      const ex = s.exceptions?.[d];
      if (ex?.cancelled) return [];
      const shift = dDiff(d, first);
      const move = v => (String(v).length > 10 ? `${dAdd(datePart(v), shift)}T${timePart(v)}` : dAdd(v, shift));
      const base = Object.fromEntries(FIELDS.map(k => [k, s[k]]));
      const o = { ...base, start: move(s.start), end: move(s.end), ...(ex?.override || {}) };
      return [{ ...o, id: `${s.id}@${d}`, seriesId: s.id, date: d, repeat: s.repeat, until: s.until, recurring: s.repeat !== 'none', exception: Boolean(ex?.override), createdBy: s.createdBy, createdAt: s.createdAt, updatedBy: ex?.override?.updatedBy || s.updatedBy, updatedAt: ex?.override?.updatedAt || s.updatedAt, seriesStart: first }];
    });
  }
  const findOccurrence = occurrenceId => {
    const [sid] = String(occurrenceId).split('@');
    const s = getEvents().find(x => x.id === sid);
    return s ? occurrencesOf(s).find(o => o.id === occurrenceId) || null : null;
  };

  // Who can see an occurrence: leaders see everything; class staff see school-wide events, their classes' events and events they staff.
  function canSeeEvent(user, o) {
    if (!canAccess(user, 'calendar')) return false;
    if (LEADERS.includes(user.role)) return true;
    const mine = educators.filter(e => e.userId === user.id).map(e => e.id);
    const ids = classScope(user).map(n => classByName(n)?.id).filter(Boolean);
    return !o.classIds.length || o.classIds.some(id => ids.includes(id)) || o.staffIds.some(id => mine.includes(id));
  }
  // Occurrences overlapping [from, to] (dates), visible to the user, optionally filtered by types and class name.
  function eventsBetween(user, from, to, { types = [], cls = '' } = {}) {
    const clsId = cls ? classByName(cls)?.id : '';
    return getEvents().flatMap(occurrencesOf)
      .filter(o => datePart(o.start) <= to && datePart(o.end) >= from)
      .filter(o => (!types.length || types.includes(o.type)) && (!clsId || !o.classIds.length || o.classIds.includes(clsId)))
      .filter(o => canSeeEvent(user, o))
      .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
  }
  // School-wide holidays/closures on a date (read by schoolDay).
  const closureOn = date => getEvents().flatMap(occurrencesOf).find(o => o.type === 'holiday' && !o.classIds.length && datePart(o.start) <= date && datePart(o.end) >= date) || null;

  function eventValues(input) {
    const errors = {};
    const v = {
      title: clean(input.title).replace(/\s+/g, ' ').slice(0, 120), type: clean(input.type), allDay: Boolean(input.allDay),
      repeat: clean(input.repeat) || 'none', until: clean(input.until), location: clean(input.location).slice(0, 120),
      description: clean(input.description).slice(0, 2000),
      classIds: [...new Set(input.classIds || [])], staffIds: [...new Set(input.staffIds || [])],
      rsvp: Boolean(input.rsvp), consent: Boolean(input.consent), attachments: [...new Set(input.attachments || [])]
    };
    if (!v.title) errors.title = 'Give the event a title.';
    if (!EVENT_TYPES[v.type]) errors.type = 'Choose an event type.';
    if (!isDate(input.startDate)) errors.startDate = 'Choose a start date.';
    if (!isDate(input.endDate)) errors.endDate = 'Choose an end date.';
    if (!v.allDay) {
      if (!isTime(input.startTime)) errors.startTime = 'Choose a start time.';
      if (!isTime(input.endTime)) errors.endTime = 'Choose an end time.';
    }
    if (!errors.startDate && !errors.endDate && !errors.startTime && !errors.endTime) {
      v.start = v.allDay ? input.startDate : `${input.startDate}T${input.startTime}`;
      v.end = v.allDay ? input.endDate : `${input.endDate}T${input.endTime}`;
      if (v.allDay ? v.end < v.start : v.end <= v.start) errors[input.endDate < input.startDate ? 'endDate' : 'endTime'] = 'The end must be after the start.';
    }
    if (!EVENT_REPEATS[v.repeat]) errors.repeat = 'Choose how it repeats.';
    else if (v.repeat !== 'none') {
      if (!isDate(v.until)) errors.until = 'Choose when the repeats end.';
      else if (isDate(input.startDate) && v.until < input.startDate) errors.until = 'The repeats must end on or after the first date.';
      else if (isDate(input.startDate) && dDiff(v.until, input.startDate) > 731) errors.until = 'Repeats can run for up to two years.';
      if (isDate(input.startDate) && isDate(input.endDate) && dDiff(input.endDate, input.startDate) >= (v.repeat === 'weekly' ? 7 : 28)) errors.repeat = 'An event that repeats must end before the next one starts.';
    } else v.until = '';
    if (v.classIds.some(id => getClassRegistry().find(c => c.id === id)?.status !== 'active')) errors.classIds = 'One of the classes is no longer active.';
    if (v.staffIds.some(id => !educators.some(e => e.id === id))) errors.staffIds = 'One of the staff is no longer on record.';
    if (v.rsvp && !RSVP_TYPES.includes(v.type)) errors.rsvp = 'RSVP is for events, trips and parent conferences.';
    if (v.consent && !CONSENT_EVENT_TYPES.includes(v.type)) errors.consent = 'Consent is for trips and events.';
    const files = read(eventFilesKey(school.id), []);
    if (v.attachments.some(id => !files.some(f => f.id === id))) errors.attachments = 'An attachment is missing. Remove it and add it again.';
    return { v, errors };
  }

  const stamp2 = (user, action, detail = '') => ({ at: new Date().toISOString(), by: user.name, action, detail });
  function createEvent(user, input) {
    if (!canManageEvents(user)) return settle({ ok: false, reason: 'forbidden' });
    const { v, errors } = eventValues(input);
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const now = new Date().toISOString();
    const ev = { id: newId('ev'), schoolId: school.id, ...v, status: 'active', exceptions: {}, createdBy: user.name, createdAt: now, updatedBy: null, updatedAt: null, history: [stamp2(user, 'created')] };
    if (!saveEvents([...getEvents(), ev])) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'add:event', ev.id, `${EVENT_TYPES[ev.type]}: ${ev.title}`);
    return settle({ ok: true, event: ev, occurrenceId: `${ev.id}@${datePart(ev.start)}` });
  }

  // Moves RSVP and consent records with their occurrence when dates or series change.
  function remapResponses(map) {
    if (!Object.keys(map).length) return [];
    const writes = [];
    [rsvpKey, eventConsentKey].forEach(k => {
      const list = read(k(school.id), []);
      let n = 0;
      list.forEach(r => { if (map[r.occurrenceId]) { r.occurrenceId = map[r.occurrenceId]; n += 1; } });
      if (n) writes.push({ key: k(school.id), value: list });
    });
    return writes;
  }
  function responseCount(occurrenceIds) {
    const set = new Set(occurrenceIds);
    return { rsvps: read(rsvpKey(school.id), []).filter(r => set.has(r.occurrenceId)).length, consents: read(eventConsentKey(school.id), []).filter(r => set.has(r.occurrenceId)).length };
  }
  // What an edit, move or delete would touch: how many occurrences and linked replies.
  function eventImpact(occurrenceId, scope) {
    const o = findOccurrence(occurrenceId);
    if (!o) return null;
    const s = getEvents().find(x => x.id === o.seriesId);
    const all = occurrencesOf(s);
    const hit = !o.recurring || scope === 'all' ? all : scope === 'future' ? all.filter(x => x.date >= o.date) : [o];
    return { occurrences: hit.length, ...responseCount(hit.map(x => x.id)) };
  }

  // Edit with a scope: 'this' (one occurrence), 'future' (split the series here) or 'all'. One-off events are always 'all'.
  function updateEvent(user, occurrenceId, input, scope = 'all') {
    if (!canManageEvents(user)) return settle({ ok: false, reason: 'forbidden' });
    const list = getEvents();
    const o = findOccurrence(occurrenceId);
    const s = o && list.find(x => x.id === o.seriesId);
    if (!s) return settle({ ok: false, reason: 'missing' });
    const { v, errors } = eventValues(scope === 'this' && o.recurring ? { ...input, repeat: 'none' } : input);
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const now = new Date().toISOString();
    const eff = o.recurring ? scope : 'all';
    const fields = Object.fromEntries(FIELDS.map(k => [k, v[k]]));
    let writes = [];
    let created = null;
    let target = occurrenceId;
    if (eff === 'this') {
      s.exceptions = { ...(s.exceptions || {}), [o.date]: { override: { ...fields, updatedBy: user.name, updatedAt: now } } };
      s.history = [...(s.history || []), stamp2(user, 'edited', `Only ${o.date}`)];
    } else {
      // Day shift between the edited occurrence's old start and its new start: applied to the series dates.
      const shift = dDiff(datePart(v.start), datePart(o.start));
      const span = dDiff(datePart(v.end), datePart(v.start));
      const build = startDate => {
        const end = dAdd(startDate, span);
        return { start: v.allDay ? startDate : `${startDate}T${timePart(v.start)}`, end: v.allDay ? end : `${end}T${timePart(v.end)}` };
      };
      if (eff === 'all' || o.date === datePart(s.start)) {
        const oldIds = occurrencesOf(s).map(x => x.id);
        const firstNew = dAdd(datePart(s.start), shift);
        const ex = {};
        // The occurrence edited here takes the new values, so its own one-off changes are dropped. Other changed
        // dates keep their one-off changes, except for the fields this edit changed, which apply everywhere.
        const changed = FIELDS.filter(k => !['start', 'end'].includes(k) && JSON.stringify(v[k]) !== JSON.stringify(s[k]));
        Object.entries(s.exceptions || {}).forEach(([d, e]) => {
          if (d === o.date && !e.cancelled) return;
          if (e.override) changed.forEach(k => { e.override[k] = v[k]; });
          ex[dAdd(d, shift)] = e;
        });
        Object.assign(s, fields, build(firstNew), { repeat: v.repeat, until: v.repeat === 'none' ? '' : v.until, exceptions: ex, updatedBy: user.name, updatedAt: now, history: [...(s.history || []), stamp2(user, 'edited', 'Entire series')] });
        if (shift) {
          const map = {};
          oldIds.forEach(id => { const d = id.split('@')[1]; map[id] = `${s.id}@${dAdd(d, shift)}`; });
          writes = remapResponses(map);
        }
        target = `${s.id}@${dAdd(o.date, shift)}`;
      } else {
        // Split: the old series ends the day before; a new series starts at this occurrence.
        const future = occurrencesOf(s).filter(x => x.date >= o.date);
        created = { id: newId('ev'), schoolId: school.id, ...fields, ...build(datePart(v.start)), repeat: v.repeat, until: v.repeat === 'none' ? '' : v.until, status: 'active', exceptions: {}, createdBy: s.createdBy, createdAt: s.createdAt, updatedBy: user.name, updatedAt: now, splitFrom: s.id, history: [stamp2(user, 'split', `From ${s.id} on ${o.date}`)] };
        Object.entries(s.exceptions || {}).forEach(([d, e]) => { if (d >= o.date) { created.exceptions[dAdd(d, shift)] = e; delete s.exceptions[d]; } });
        s.until = dAdd(o.date, -1);
        s.updatedBy = user.name; s.updatedAt = now;
        s.history = [...(s.history || []), stamp2(user, 'edited', `Split at ${o.date}: this and future events moved to ${created.id}`)];
        list.push(created);
        const map = {};
        future.forEach(x => { map[x.id] = `${created.id}@${dAdd(x.date, shift)}`; });
        writes = remapResponses(map);
        target = `${created.id}@${datePart(v.start)}`;
      }
    }
    if (!commit([{ key: eventsKey(school.id), value: list }, ...writes])) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'edit:event', s.id, `${v.title} (${eff === 'this' ? 'this event' : eff === 'future' ? 'this and future' : 'entire series'})`);
    return settle({ ok: true, occurrenceId: target, scope: eff });
  }

  function deleteEvent(user, occurrenceId, scope = 'all') {
    if (!canManageEvents(user)) return settle({ ok: false, reason: 'forbidden' });
    const list = getEvents();
    const o = findOccurrence(occurrenceId);
    const s = o && list.find(x => x.id === o.seriesId);
    if (!s) return settle({ ok: false, reason: 'missing' });
    const eff = o.recurring ? scope : 'all';
    const now = new Date().toISOString();
    if (eff === 'this') s.exceptions = { ...(s.exceptions || {}), [o.date]: { cancelled: true, by: user.name, at: now } };
    else if (eff === 'future' && o.date > datePart(s.start)) { s.until = dAdd(o.date, -1); Object.keys(s.exceptions || {}).forEach(d => { if (d >= o.date) delete s.exceptions[d]; }); }
    else Object.assign(s, { status: 'cancelled', cancelledBy: user.name, cancelledAt: now });
    s.history = [...(s.history || []), stamp2(user, 'deleted', eff === 'this' ? `Only ${o.date}` : eff === 'future' ? `From ${o.date}` : 'Entire series')];
    s.updatedBy = user.name; s.updatedAt = now;
    if (!saveEvents(list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'delete:event', s.id, `${s.title} (${eff})`);
    return settle({ ok: true, scope: eff });
  }

  // Reschedule keeping the duration (and all-day status). Saved first; families are told only after the save.
  async function moveEvent(user, occurrenceId, { date, time = '' }, scope = 'this', notify = false) {
    const o = findOccurrence(occurrenceId);
    if (!o) return { ok: false, reason: 'missing' };
    const span = o.allDay ? dDiff(datePart(o.end), datePart(o.start)) : (new Date(o.end) - new Date(o.start)) / 60000;
    let input;
    if (o.allDay) input = { ...o, startDate: date, endDate: dAdd(date, span) };
    else {
      const t = isTime(time) ? time : timePart(o.start);
      const st = new Date(`${date}T${t}:00`);
      const en = new Date(st.getTime() + span * 60000);
      input = { ...o, startDate: date, startTime: t, endDate: isoDate(en), endTime: `${pad2(en.getHours())}:${pad2(en.getMinutes())}` };
    }
    const r = await updateEvent(user, occurrenceId, input, scope);
    if (!r.ok) return r;
    if (!notify) return { ...r, notice: null };
    const n = await sendEventNotice(user, { occurrenceId: r.occurrenceId, kind: 'moved', previous: o.start });
    return { ...r, notice: n };
  }

  // Children an occurrence is for (its classes, or the whole school), with their RSVP and consent records.
  function eventResponses(user, occurrenceId) {
    const o = findOccurrence(occurrenceId);
    if (!o || !canSeeEvent(user, o)) return null;
    const ids = o.classIds;
    const kids = getChildren().filter(c => c.status === 'active' && (!ids.length || ids.includes(classByName(c.cls)?.id)))
      .filter(c => LEADERS.includes(user.role) || classScope(user).includes(c.cls))
      .sort((a, b) => a.cls.localeCompare(b.cls) || childName(a).localeCompare(childName(b)));
    const rs = read(rsvpKey(school.id), []).filter(r => r.occurrenceId === occurrenceId);
    const cs = read(eventConsentKey(school.id), []).filter(r => r.occurrenceId === occurrenceId);
    const rows = kids.map(c => ({ child: c, rsvp: o.rsvp ? rs.find(r => r.childId === c.id) || null : null, consent: o.consent ? cs.find(r => r.childId === c.id) || null : null }));
    const count = (fn) => rows.filter(fn).length;
    return {
      occurrence: o, rows,
      rsvp: o.rsvp ? { yes: count(r => r.rsvp?.response === 'yes'), no: count(r => r.rsvp?.response === 'no'), none: count(r => !r.rsvp) } : null,
      consent: o.consent ? { granted: count(r => r.consent?.status === 'granted'), declined: count(r => r.consent?.status === 'declined'), pending: count(r => !r.consent) } : null
    };
  }
  function responseCtx(user, occurrenceId, childId) {
    const o = findOccurrence(occurrenceId);
    if (!o) return { error: 'missing' };
    const c = childById(childId);
    if (!c || c.status !== 'active' || (o.classIds.length && !o.classIds.includes(classByName(c.cls)?.id))) return { error: 'invalid' };
    if (!canAccess(user, 'calendar') || !(LEADERS.includes(user.role) || classScope(user).includes(c.cls))) return { error: 'forbidden' };
    return { o, c };
  }
  // A family's reply, recorded by staff (no family app yet). guardianId says which guardian replied, when known.
  function setEventRsvp(user, occurrenceId, childId, response, guardianId = '') {
    const ctx = responseCtx(user, occurrenceId, childId);
    if (ctx.error) return settle({ ok: false, reason: ctx.error });
    if (!ctx.o.rsvp) return settle({ ok: false, reason: 'invalid', errors: { rsvp: 'This event doesn’t ask for RSVPs.' } });
    if (response && !['yes', 'no'].includes(response)) return settle({ ok: false, reason: 'invalid' });
    if (guardianId && !(ctx.c.guardianLinks || []).some(l => l.guardianId === guardianId)) return settle({ ok: false, reason: 'invalid', errors: { guardianId: 'Choose one of the child’s guardians.' } });
    const list = read(rsvpKey(school.id), []).filter(r => !(r.occurrenceId === occurrenceId && r.childId === childId));
    if (response) list.push({ id: newId('rsvp'), occurrenceId, seriesId: ctx.o.seriesId, childId, response, guardianId: guardianId || null, by: 'family', recordedBy: user.name, recordedById: user.id, at: new Date().toISOString() });
    if (!write(rsvpKey(school.id), list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'event:rsvp', childId, `${ctx.o.title} ${ctx.o.date}: ${response || 'cleared'}`);
    return settle({ ok: true });
  }
  // Consent needs the guardian who gave or refused it. It's separate from RSVP.
  function setEventConsent(user, occurrenceId, childId, status, guardianId = '') {
    const ctx = responseCtx(user, occurrenceId, childId);
    if (ctx.error) return settle({ ok: false, reason: ctx.error });
    if (!ctx.o.consent) return settle({ ok: false, reason: 'invalid', errors: { consent: 'This event doesn’t need consent.' } });
    if (status && !['granted', 'declined'].includes(status)) return settle({ ok: false, reason: 'invalid' });
    if (status && !(ctx.c.guardianLinks || []).some(l => l.guardianId === guardianId)) return settle({ ok: false, reason: 'invalid', errors: { guardianId: 'Choose the guardian who gave the answer.' } });
    const list = read(eventConsentKey(school.id), []).filter(r => !(r.occurrenceId === occurrenceId && r.childId === childId));
    if (status) list.push({ id: newId('ecs'), occurrenceId, seriesId: ctx.o.seriesId, childId, status, guardianId, recordedBy: user.name, recordedById: user.id, at: new Date().toISOString() });
    if (!write(eventConsentKey(school.id), list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'event:consent', childId, `${ctx.o.title} ${ctx.o.date}: ${status || 'cleared'}`);
    return settle({ ok: true });
  }

  /* Notification boundary: reminders and move notices are recorded per guardian. Swap the body of `deliver` for a
     real push/email/SMS service; until then nothing leaves this device and results say so. */
  const deliver = (guardian, app) => (accountOf(app, guardian.id).status === 'active' ? { ok: true, result: 'queued (demo — not delivered)' } : { ok: false, result: 'skipped: no active parent-app account' });
  function sendEventNotice(user, { occurrenceId, kind, previous = '' }) {
    const o = findOccurrence(occurrenceId);
    if (!o) return settle({ ok: false, reason: 'missing' });
    const resp = eventResponses(user, occurrenceId);
    if (!resp || !(canManageEvents(user) || resp.rows.length)) return settle({ ok: false, reason: 'forbidden' });
    if (kind === 'reminder' && !o.rsvp) return settle({ ok: false, reason: 'invalid' });
    const targets = kind === 'reminder' ? resp.rows.filter(r => !r.rsvp) : resp.rows;
    const app = getParentApp();
    const notices = read(noticesKey(school.id), []);
    const since = Date.now() - 30 * 60000;
    const seen = new Set();
    const results = [];
    targets.forEach(r => (r.child.guardianLinks || []).forEach(l => {
      if (seen.has(l.guardianId)) return;
      seen.add(l.guardianId);
      const g = guardianById(l.guardianId);
      if (!g) return;
      const dup = notices.some(n => n.occurrenceId === occurrenceId && n.kind === kind && n.guardianId === g.id && new Date(n.at).getTime() >= since && n.ok);
      const d = dup ? { ok: false, result: 'skipped: already sent in the last 30 minutes' } : deliver(g, app);
      results.push({ guardianId: g.id, childId: r.child.id, ...d });
    }));
    const record = results.map(x => ({ id: newId('nt'), occurrenceId, kind, previous, guardianId: x.guardianId, childId: x.childId, ok: x.ok, result: x.result, by: user.name, at: new Date().toISOString() }));
    if (record.length && !write(noticesKey(school.id), [...notices, ...record])) return settle({ ok: false, reason: 'storage' });
    logAudit(user, `event:notice-${kind}`, o.seriesId, `${o.title} ${o.date}: ${results.filter(x => x.ok).length} queued, ${results.filter(x => !x.ok).length} skipped`);
    return settle({ ok: true, queued: results.filter(x => x.ok).length, skipped: results.filter(x => !x.ok).length, reasons: [...new Set(results.filter(x => !x.ok).map(x => x.result))], families: seen.size });
  }

  const EVENT_FILE_TYPES = { 'application/pdf': 'PDF', 'image/jpeg': 'JPEG', 'image/png': 'PNG' };
  function addEventFile(user, { name, mime, size, data }) {
    if (!canManageEvents(user)) return settle({ ok: false, reason: 'forbidden' });
    if (!EVENT_FILE_TYPES[mime] || !String(data || '').startsWith(`data:${mime};base64,`)) return settle({ ok: false, reason: 'invalid', errors: { attachment: 'Attach a PDF, JPEG or PNG file.' } });
    if (!(Number(size) > 0) || Number(size) > 1024 * 1024) return settle({ ok: false, reason: 'invalid', errors: { attachment: 'Attach a file of 1 MB or less.' } });
    const f = { id: newId('ef'), name: clean(name).slice(0, 120) || 'Attachment', mime, size: Number(size), data, by: user.name, at: new Date().toISOString() };
    if (!write(eventFilesKey(school.id), [...read(eventFilesKey(school.id), []), f])) return settle({ ok: false, reason: 'storage', errors: { attachment: 'There isn’t room on this device for this file.' } });
    return settle({ ok: true, file: { id: f.id, name: f.name, mime: f.mime, size: f.size } });
  }
  const eventFileMeta = id => { const f = read(eventFilesKey(school.id), []).find(x => x.id === id); return f ? { id: f.id, name: f.name, mime: f.mime, size: f.size } : null; };
  function eventFile(user, occurrenceId, fileId) {
    const o = findOccurrence(occurrenceId);
    if (!o || !canSeeEvent(user, o) || !o.attachments.includes(fileId)) return null;
    return read(eventFilesKey(school.id), []).find(x => x.id === fileId) || null;
  }
  const getCalendarPrefs = user => read(calPrefsKey(user.id), {});
  const saveCalendarPrefs = (user, patch) => write(calPrefsKey(user.id), { ...getCalendarPrefs(user), ...patch });
  // Events for one child (their class + school-wide; staff meetings excluded) with their RSVP/consent for authorised staff.
  function childEvents(user, childId, days = 30) {
    const c = childById(childId);
    if (!c) return [];
    const clsId = classByName(c.cls)?.id;
    return eventsBetween(user, today(), daysFromToday(days))
      .filter(o => o.type !== 'meeting' && (!o.classIds.length || o.classIds.includes(clsId)))
      .map(o => {
        const see = canView(user, 'family') && (LEADERS.includes(user.role) || classScope(user).includes(c.cls));
        return { ...o, myRsvp: see && o.rsvp ? read(rsvpKey(school.id), []).find(r => r.occurrenceId === o.id && r.childId === childId) || null : undefined, myConsent: see && o.consent ? read(eventConsentKey(school.id), []).find(r => r.occurrenceId === o.id && r.childId === childId) || null : undefined };
      });
  }


  /* ---------------------------------------------------------------- Lesson planning & class timetable (lessons.js; S04 "Today's plan")
     Activities `nexora-activities:<school>` { id, title, area (LEARNING_AREAS), ages, objectives, materials[], prep, notes,
       outcomeIds[], status: 'active'|'archived', createdBy, createdAt, updatedAt } — seeded with demo Montessori presentations.
     Weekly plans `nexora-lesson-plans:<school>` { id, schoolId, classId, weekStart (Monday), status: 'draft'|'submitted'|
       'approved'|'changes', revision (number of submissions), entries: [{ id, activityId, day: 'mon'…, blockId, order, note }],
       approved: { revision, entries, by, at } | null, createdBy/At, updatedBy/At, submittedBy/At }
     Reviews `nexora-plan-reviews:<school>` { id, planId, revision, submittedBy, submittedById, submittedAt, reviewerId,
       decision: null|'approved'|'changes', comment, decidedBy, decidedAt } — never overwritten.
     Themes `nexora-themes:<school>` { id, classId, start, end, name, description, focusAreas[], vocabulary[], activityIds[], notes }.
     Reviewer `nexora-plan-settings:<school>` { reviewerId } (default: the Director account).
     Timetable = the class routine (`nexora-class-routines`); blocks have stable ids and optional weekdays. Plan entries point
     at block ids, so changing the timetable never silently moves planned activities.
     S24 framework outcomes: read through frameworkOutcomes() from `nexora-framework-outcomes:<school>`. That module isn't
     built yet, so no outcome exists and none is invented; activities can link outcomes once it does. */

  const activitiesKey = id => `nexora-activities:${id}`;
  const plansKey = id => `nexora-lesson-plans:${id}`;
  const reviewsKey = id => `nexora-plan-reviews:${id}`;
  const themesKey = id => `nexora-themes:${id}`;
  const planSettingsKey = id => `nexora-plan-settings:${id}`;
  const outcomesKey = id => `nexora-framework-outcomes:${id}`;
  const PLAN_STATUS = { draft: 'Draft', submitted: 'Submitted', approved: 'Approved', changes: 'Changes requested' };
  const PLAN_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const DAY_NAMES = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
  const ACTIVITY_SEED = [
    ['Pouring water', 'Practical life', '2–6', 'Control of movement; care of the environment.', ['Two small jugs', 'Tray', 'Sponge']],
    ['Polishing wood', 'Practical life', '3–6', 'Concentration, order and care of objects.', ['Polish', 'Cloths', 'Small wooden object', 'Mat']],
    ['Dressing frames: buttons', 'Practical life', '3–5', 'Independence in dressing; fine-motor coordination.', ['Button dressing frame']],
    ['Pink tower', 'Sensorial', '2–4', 'Visual discrimination of dimension.', ['Pink tower (10 cubes)', 'Floor mat']],
    ['Knobbed cylinders', 'Sensorial', '2–4', 'Size discrimination; pincer grip.', ['Cylinder block 1']],
    ['Colour tablets box 2', 'Sensorial', '3–5', 'Matching colours; colour names.', ['Colour box 2']],
    ['Sandpaper letters', 'Language', '3–5', 'Letter sounds through touch.', ['Sandpaper letters (selected set)']],
    ['Sound games (I spy)', 'Language', '2–5', 'Hearing beginning sounds.', ['Small objects basket']],
    ['Movable alphabet', 'Language', '4–6', 'Building words before writing.', ['Movable alphabet box', 'Small objects']],
    ['Number rods', 'Mathematics', '3–5', 'Quantity 1–10 and sequence.', ['Number rods', 'Floor mat']],
    ['Spindle box', 'Mathematics', '4–5', 'Zero and counting loose quantities.', ['Spindle box', '45 spindles']],
    ['Golden beads introduction', 'Mathematics', '4–6', 'Units, tens, hundreds, thousands.', ['Golden bead material', 'Tray']],
    ['Puzzle map: continents', 'Culture', '3–6', 'Names and shapes of the continents.', ['Continents puzzle map']],
    ['Land and water forms', 'Culture', '3–5', 'Island, lake and other land forms.', ['Land and water trays', 'Water jug']],
    ['Botany: parts of a leaf', 'Culture', '4–6', 'Naming leaf parts; observing real leaves.', ['Leaf puzzle', 'Fresh leaves']]
  ];
  const getActivities = () => seeded(activitiesKey(school.id), () => ACTIVITY_SEED.map(([title, area, ages, objectives, materials], i) => ({ id: `act-${i + 1}`, title, area, ages, objectives, materials, prep: '', notes: '', outcomeIds: [], status: 'active', demo: true, createdBy: 'Demo library', createdAt: atToday(9, 0, -90), updatedAt: null })));
  const activityById = id => getActivities().find(a => a.id === id) || null;
  // S24 adapter: the only place outcome records are read. Empty until the framework module exists.
  function frameworkOutcomes() {
    const list = read(outcomesKey(school.id), []);
    return { available: list.length > 0, outcomes: list };
  }
  const canPlan = (user, cls) => (LEADERS.includes(user.role) || user.role === 'Teacher') && classScope(user).includes(cls);
  function saveActivity(user, input, activityId = null) {
    if (!canAccess(user, 'lessons')) return settle({ ok: false, reason: 'forbidden' });
    const list = getActivities();
    const errors = {};
    const v = { title: clean(input.title).slice(0, 80), area: clean(input.area), ages: clean(input.ages).slice(0, 20), objectives: clean(input.objectives).slice(0, 600), materials: (input.materials || []).map(clean).filter(Boolean).slice(0, 20), prep: clean(input.prep).slice(0, 600), notes: clean(input.notes).slice(0, 600), outcomeIds: [...new Set(input.outcomeIds || [])] };
    if (!v.title) errors.title = 'Give the activity a title.';
    else if (list.some(a => a.id !== activityId && a.status === 'active' && a.title.toLowerCase() === v.title.toLowerCase())) errors.title = 'An activity with this title is already in the library.';
    if (!LEARNING_AREAS.includes(v.area)) errors.area = 'Choose a learning area.';
    const known = frameworkOutcomes().outcomes.map(o => o.id);
    if (v.outcomeIds.some(id => !known.includes(id))) errors.outcomeIds = 'One of the outcomes isn’t in the framework.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const now = new Date().toISOString();
    let a = activityId ? list.find(x => x.id === activityId) : null;
    if (activityId && !a) return settle({ ok: false, reason: 'missing' });
    if (a) Object.assign(a, v, { updatedAt: now, updatedBy: user.name });
    else { a = { id: newId('act'), ...v, status: 'active', createdBy: user.name, createdAt: now, updatedAt: null }; list.push(a); }
    if (!write(activitiesKey(school.id), list)) return settle({ ok: false, reason: 'storage' });
    return settle({ ok: true, activity: a });
  }

  // Timetable blocks (class routine) with stable ids. A block's `days` limits it to some weekdays (null = routine days).
  function routineFor(classId) {
    const all = getRoutines();
    const r = all[classId];
    if (!r) return null;
    let changed = false;
    r.blocks.forEach(b => { if (!b.id) { b.id = newId('rb'); changed = true; } if (b.days === undefined) { b.days = null; changed = true; } });
    if (changed) { try { localStorage.setItem(routinesKey(school.id), JSON.stringify(all)); } catch { /* in memory */ } }
    return r;
  }
  const blockDays = (r, b) => (b.days?.length ? b.days : r.days);
  function routineBlocks(classId) {
    const r = routineFor(classId);
    return r ? [...r.blocks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start)).map(b => ({ ...b, appliesTo: blockDays(r, b) })) : [];
  }
  const canEditTimetable = (user, classId) => { const c = classById(classId); return Boolean(c) && (LEADERS.includes(user.role) || (user.role === 'Teacher' && classScope(user).includes(c.name))); };
  function saveRoutineBlock(user, classId, input, blockId = null, { allowOverlap = false } = {}) {
    if (!canEditTimetable(user, classId)) return settle({ ok: false, reason: 'forbidden' });
    const all = getRoutines();
    if (!all[classId]) all[classId] = { days: SCHOOL_WEEK, blocks: [] };
    routineFor(classId);
    const r = all[classId];
    r.blocks.forEach(b => { if (!b.id) b.id = newId('rb'); if (b.days === undefined) b.days = null; });
    const errors = {};
    const v = { title: clean(input.title).slice(0, 60), start: clean(input.start), end: clean(input.end), description: clean(input.description).slice(0, 300), location: clean(input.location).slice(0, 80), activityId: clean(input.activityId) || null, days: [...new Set((input.days || []).filter(d => PLAN_DAYS.includes(d)))] };
    if (!v.title) errors.title = 'Name the block.';
    if (!isTime(v.start)) errors.start = 'Choose a start time.';
    if (!isTime(v.end)) errors.end = 'Choose an end time.';
    else if (!errors.start && toMinutes(v.end) <= toMinutes(v.start)) errors.end = 'The end time must be after the start time.';
    if (v.activityId && !activityById(v.activityId)) errors.activityId = 'Choose an activity from the library.';
    const days = v.days.length ? v.days : r.days;
    const others = r.blocks.filter(b => b.id !== blockId);
    if (!Object.keys(errors).length && others.some(b => b.title.toLowerCase() === v.title.toLowerCase() && b.start === v.start && b.end === v.end)) errors.title = 'This block is already in the timetable.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const clash = others.filter(b => blockDays(r, b).some(d => days.includes(d)) && toMinutes(b.start) < toMinutes(v.end) && toMinutes(v.start) < toMinutes(b.end));
    if (clash.length && !allowOverlap) return settle({ ok: false, reason: 'overlap', clash: clash.map(b => `${b.title} ${b.start}–${b.end}`) });
    const block = { ...v, days: v.days.length ? v.days : null };
    if (blockId) {
      const b = r.blocks.find(x => x.id === blockId);
      if (!b) return settle({ ok: false, reason: 'missing' });
      Object.assign(b, block);
    } else r.blocks.push({ id: newId('rb'), ...block });
    if (!write(routinesKey(school.id), all)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, blockId ? 'edit:timetable' : 'add:timetable', classId, `${v.title} ${v.start}–${v.end}`);
    return settle({ ok: true });
  }
  // Deleting a block that plans use needs confirmation; those entries stay (shown as "Routine removed"), never moved.
  function deleteRoutineBlock(user, classId, blockId, { confirmPlans = false } = {}) {
    if (!canEditTimetable(user, classId)) return settle({ ok: false, reason: 'forbidden' });
    const all = getRoutines();
    const r = all[classId];
    if (!r || !r.blocks.some(b => b.id === blockId)) return settle({ ok: false, reason: 'missing' });
    const used = getPlans().filter(p => p.classId === classId).reduce((n, p) => n + p.entries.filter(e => e.blockId === blockId).length, 0);
    if (used && !confirmPlans) return settle({ ok: false, reason: 'in-use', count: used });
    r.blocks = r.blocks.filter(b => b.id !== blockId);
    if (!write(routinesKey(school.id), all)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'delete:timetable', classId, blockId);
    return settle({ ok: true, kept: used });
  }

  const getPlans = () => read(plansKey(school.id), []);
  const getReviews = () => read(reviewsKey(school.id), []);
  const weekOf = date => dAdd(date, -((new Date(`${date}T12:00:00`).getDay() + 6) % 7));
  const planDays = () => PLAN_DAYS.filter(d => schoolDays().includes(d));
  function weeklyPlan(classId, weekStart) {
    const ws = weekOf(weekStart);
    const p = getPlans().find(x => x.classId === classId && x.weekStart === ws);
    return p || { id: null, classId, weekStart: ws, status: 'draft', revision: 0, entries: [], approved: null };
  }
  const getPlanSettings = () => ({ reviewerId: 'u-director', ...read(planSettingsKey(school.id), {}) });
  const planReviewer = () => { const u = users.find(x => x.id === getPlanSettings().reviewerId && x.schoolId === school.id); return u && LEADERS.includes(u.role) ? u : null; };
  function setPlanReviewer(user, reviewerId) {
    if (!LEADERS.includes(user.role)) return settle({ ok: false, reason: 'forbidden' });
    const u = users.find(x => x.id === reviewerId && x.schoolId === school.id && LEADERS.includes(x.role));
    if (reviewerId && !u) return settle({ ok: false, reason: 'invalid', errors: { reviewerId: 'Choose a school leader.' } });
    return settle(write(planSettingsKey(school.id), { reviewerId: reviewerId || null }) ? { ok: true } : { ok: false, reason: 'storage' });
  }
  const plannerCtx = (user, classId) => { const c = classById(classId); return c && c.status === 'active' && canPlan(user, c.name) ? c : null; };

  // Replaces the week's entries (the planner sends the whole grid after each change). Only drafts and plans with
  // changes requested can be edited; an approved plan needs startRevision() first.
  function savePlanEntries(user, { classId, weekStart, entries }) {
    const c = plannerCtx(user, classId);
    if (!c) return settle({ ok: false, reason: 'forbidden' });
    const ws = weekOf(weekStart);
    const list = getPlans();
    let p = list.find(x => x.classId === classId && x.weekStart === ws);
    if (p && p.status === 'submitted') return settle({ ok: false, reason: 'submitted' });
    if (p && p.status === 'approved') return settle({ ok: false, reason: 'approved' });
    const blocks = routineBlocks(classId);
    const seen = new Set();
    const clean2 = [];
    for (const e of entries || []) {
      const a = activityById(e.activityId);
      const b = blocks.find(x => x.id === e.blockId);
      if (!PLAN_DAYS.includes(e.day)) return settle({ ok: false, reason: 'invalid', errors: { entries: 'A day in the plan isn’t valid.' } });
      if (!a) return settle({ ok: false, reason: 'invalid', errors: { entries: 'An activity in the plan is no longer in the library.' } });
      if (b && !b.appliesTo.includes(e.day)) return settle({ ok: false, reason: 'invalid', errors: { entries: `${b.title} doesn’t run on ${DAY_NAMES[e.day]}.` } });
      if (!b && !(p?.entries || []).some(x => x.id === e.id && x.blockId === e.blockId)) return settle({ ok: false, reason: 'invalid', errors: { entries: 'Choose a timetable block for the activity.' } });
      const k = `${e.day}|${e.blockId}|${e.activityId}`;
      if (seen.has(k)) return settle({ ok: false, reason: 'invalid', errors: { entries: `${a.title} is already in that slot.` } });
      seen.add(k);
      clean2.push({ id: e.id || newId('pe'), activityId: a.id, day: e.day, blockId: e.blockId, order: Number(e.order) || 0, note: clean(e.note).slice(0, 300), flag: e.flag || null });
    }
    const now = new Date().toISOString();
    if (!p) { p = { id: newId('plan'), schoolId: school.id, classId, weekStart: ws, status: 'draft', revision: 0, entries: [], approved: null, createdBy: user.name, createdAt: now }; list.push(p); }
    Object.assign(p, { entries: clean2, updatedBy: user.name, updatedAt: now });
    if (!write(plansKey(school.id), list)) return settle({ ok: false, reason: 'storage' });
    return settle({ ok: true, plan: p });
  }

  function copyLastWeek(user, { classId, weekStart }) {
    const c = plannerCtx(user, classId);
    if (!c) return settle({ ok: false, reason: 'forbidden' });
    const ws = weekOf(weekStart);
    const src = weeklyPlan(classId, dAdd(ws, -7));
    if (!src.entries.length) return settle({ ok: false, reason: 'empty-source' });
    const dest = weeklyPlan(classId, ws);
    if (dest.status === 'submitted') return settle({ ok: false, reason: 'submitted' });
    if (dest.status === 'approved') return settle({ ok: false, reason: 'approved' });
    const blocks = routineBlocks(classId);
    const entries = src.entries.map(e => {
      const a = activityById(e.activityId);
      const b = blocks.find(x => x.id === e.blockId);
      const flag = !a || a.status !== 'active' ? 'activity-missing' : !b || !b.appliesTo.includes(e.day) ? 'block-missing' : null;
      return { id: newId('pe'), activityId: e.activityId, day: e.day, blockId: e.blockId, order: e.order, note: e.note, flag };
    });
    const list = getPlans();
    let p = list.find(x => x.classId === classId && x.weekStart === ws);
    const now = new Date().toISOString();
    if (!p) { p = { id: newId('plan'), schoolId: school.id, classId, weekStart: ws, status: 'draft', revision: 0, entries: [], approved: null, createdBy: user.name, createdAt: now }; list.push(p); }
    Object.assign(p, { entries, status: p.status === 'changes' ? 'changes' : 'draft', updatedBy: user.name, updatedAt: now, copiedFrom: src.id });
    if (!write(plansKey(school.id), list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'copy:plan', classId, `${src.weekStart} → ${ws}`);
    return settle({ ok: true, plan: p, flagged: entries.filter(e => e.flag).length });
  }

  // Editing an approved plan starts a new draft revision; the approved version is kept.
  function startRevision(user, planId) {
    const list = getPlans();
    const p = list.find(x => x.id === planId);
    if (!p || !plannerCtx(user, p.classId)) return settle({ ok: false, reason: p ? 'forbidden' : 'missing' });
    if (p.status !== 'approved') return settle({ ok: false, reason: 'invalid' });
    p.status = 'draft';
    p.updatedBy = user.name; p.updatedAt = new Date().toISOString();
    if (!write(plansKey(school.id), list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'revise:plan', p.classId, `${p.weekStart} revision after ${p.revision}`);
    return settle({ ok: true, plan: p });
  }

  function submitPlan(user, planId) {
    const list = getPlans();
    const p = list.find(x => x.id === planId);
    if (!p) return settle({ ok: false, reason: 'missing' });
    if (!plannerCtx(user, p.classId)) return settle({ ok: false, reason: 'forbidden' });
    if (!['draft', 'changes'].includes(p.status)) return settle({ ok: false, reason: 'invalid' });
    if (!p.entries.length) return settle({ ok: false, reason: 'invalid', errors: { plan: 'Add at least one activity before submitting.' } });
    if (p.entries.some(e => e.flag)) return settle({ ok: false, reason: 'invalid', errors: { plan: 'Resolve the flagged activities (missing activity or timetable block) first.' } });
    const reviewer = planReviewer();
    if (!reviewer) return settle({ ok: false, reason: 'no-reviewer' });
    if (reviewer.id === user.id) return settle({ ok: false, reason: 'self-review' });
    const now = new Date().toISOString();
    const reviews = getReviews();
    const review = { id: newId('rv'), planId: p.id, revision: p.revision + 1, submittedBy: user.name, submittedById: user.id, submittedAt: now, reviewerId: reviewer.id, decision: null, comment: '', decidedBy: null, decidedAt: null, entries: p.entries.map(e => ({ ...e })) };
    Object.assign(p, { status: 'submitted', revision: p.revision + 1, submittedBy: user.name, submittedById: user.id, submittedAt: now, updatedAt: now });
    if (!commit([{ key: plansKey(school.id), value: list }, { key: reviewsKey(school.id), value: [...reviews, review] }])) return settle({ ok: false, reason: 'storage' });
    const cls = classById(p.classId)?.name || '';
    notifyUsers({ module: 'lessons', kind: 'plan-submitted', title: `${cls} weekly plan to review`, body: `${user.name} submitted the plan for the week of ${p.weekStart} (revision ${p.revision}).`, recordType: 'plan', recordId: p.id, dedupeKey: `plan-submit:${p.id}:${p.revision}`, actorId: user.id }, { toUserIds: [reviewer.id] });
    logAudit(user, 'submit:plan', p.classId, `${p.weekStart} r${p.revision}`);
    return settle({ ok: true, plan: p, reviewer: reviewer.name });
  }

  function reviewPlan(user, planId, decision, comment = '') {
    const list = getPlans();
    const p = list.find(x => x.id === planId);
    if (!p) return settle({ ok: false, reason: 'missing' });
    const reviewer = planReviewer();
    if (!reviewer || reviewer.id !== user.id) return settle({ ok: false, reason: 'forbidden' });
    if (p.submittedById === user.id) return settle({ ok: false, reason: 'self-review' });
    if (p.status !== 'submitted') return settle({ ok: false, reason: 'invalid' });
    if (!['approved', 'changes'].includes(decision)) return settle({ ok: false, reason: 'invalid' });
    const text = clean(comment).slice(0, 1000);
    if (decision === 'changes' && text.length < 5) return settle({ ok: false, reason: 'invalid', errors: { comment: 'Explain what needs to change.' } });
    const reviews = getReviews();
    const r = [...reviews].reverse().find(x => x.planId === p.id && x.revision === p.revision && !x.decision);
    if (!r) return settle({ ok: false, reason: 'missing' });
    const now = new Date().toISOString();
    Object.assign(r, { decision, comment: text, decidedBy: user.name, decidedById: user.id, decidedAt: now });
    p.status = decision;
    p.updatedAt = now;
    if (decision === 'approved') p.approved = { revision: p.revision, entries: p.entries.map(e => ({ ...e })), by: user.name, at: now };
    if (!commit([{ key: plansKey(school.id), value: list }, { key: reviewsKey(school.id), value: reviews }])) return settle({ ok: false, reason: 'storage' });
    const cls = classById(p.classId)?.name || '';
    notifyUsers({ module: 'lessons', kind: decision === 'approved' ? 'plan-approved' : 'plan-changes', title: decision === 'approved' ? `${cls} plan approved` : `${cls} plan: changes requested`, body: decision === 'approved' ? `${user.name} approved the week of ${p.weekStart}.` : `${user.name}: ${text}`, recordType: 'plan', recordId: p.id, dedupeKey: `plan-review:${p.id}:${p.revision}`, actorId: user.id }, { toUserIds: [p.submittedById] });
    logAudit(user, `review:plan-${decision}`, p.classId, `${p.weekStart} r${p.revision}`);
    return settle({ ok: true, plan: p });
  }
  const planHistory = planId => getReviews().filter(r => r.planId === planId).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

  // Themes for a class overlapping a month ('YYYY-MM').
  const getThemes = () => read(themesKey(school.id), []);
  function themesFor(classId, month) {
    const first = `${month}-01`;
    const last = dAdd(isoDate(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1, 12)), -1);
    return getThemes().filter(t => t.classId === classId && t.start <= last && t.end >= first).sort((a, b) => a.start.localeCompare(b.start));
  }
  function saveTheme(user, classId, input, themeId = null) {
    const c = plannerCtx(user, classId);
    if (!c) return settle({ ok: false, reason: 'forbidden' });
    const errors = {};
    const v = { name: clean(input.name).slice(0, 80), start: clean(input.start), end: clean(input.end), description: clean(input.description).slice(0, 600), focusAreas: [...new Set(input.focusAreas || [])], vocabulary: [...new Set((input.vocabulary || []).map(clean).filter(Boolean))].slice(0, 30), activityIds: [...new Set(input.activityIds || [])], notes: clean(input.notes).slice(0, 1000) };
    if (!v.name) errors.name = 'Name the theme.';
    if (!isDate(v.start)) errors.start = 'Choose a start date.';
    if (!isDate(v.end)) errors.end = 'Choose an end date.';
    else if (!errors.start && v.end < v.start) errors.end = 'The end date can’t be before the start.';
    else if (!errors.start && dDiff(v.end, v.start) > 42) errors.end = 'A theme can run for up to six weeks.';
    if (v.focusAreas.some(a => !LEARNING_AREAS.includes(a))) errors.focusAreas = 'Choose focus areas from the list.';
    if (v.activityIds.some(id => !activityById(id))) errors.activityIds = 'A linked activity is no longer in the library.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const list = getThemes();
    const now = new Date().toISOString();
    let t = themeId ? list.find(x => x.id === themeId && x.classId === classId) : null;
    if (themeId && !t) return settle({ ok: false, reason: 'missing' });
    if (t) Object.assign(t, v, { updatedBy: user.name, updatedAt: now });
    else { t = { id: newId('th'), schoolId: school.id, classId, ...v, createdBy: user.name, createdAt: now }; list.push(t); }
    if (!write(themesKey(school.id), list)) return settle({ ok: false, reason: 'storage' });
    return settle({ ok: true, theme: t });
  }
  function deleteTheme(user, classId, themeId) {
    if (!plannerCtx(user, classId)) return settle({ ok: false, reason: 'forbidden' });
    const list = getThemes();
    if (!list.some(t => t.id === themeId && t.classId === classId)) return settle({ ok: false, reason: 'missing' });
    return settle(write(themesKey(school.id), list.filter(t => t.id !== themeId)) ? { ok: true } : { ok: false, reason: 'storage' });
  }

  // S04: today's planned activities for the user's classes, from the saved weekly plans.
  function todayPlan(user) {
    const d = weekdayOf(today());
    return classScope(user).map(name => {
      const c = classByName(name);
      const p = weeklyPlan(c.id, today());
      const blocks = routineBlocks(c.id);
      const items = p.entries.filter(e => e.day === d).map(e => ({ ...e, activity: activityById(e.activityId), block: blocks.find(b => b.id === e.blockId) || null }))
        .sort((a, b) => (a.block ? toMinutes(a.block.start) : 9999) - (b.block ? toMinutes(b.block.start) : 9999) || a.order - b.order);
      return { cls: name, classId: c.id, plan: p, items };
    });
  }

  /* ---------------------------------------------------------------- S23 Rooms & Resources (resources.js; class detail Room tab)
     Rooms `nexora-rooms:<school>` { id, schoolId, name, type, capacity, classId|null, notes, status } — seeded from the
       class rooms plus two shared spaces (demo capacities).
     Bookings `nexora-room-bookings:<school>` { id, roomId, date, start, end, title, classId|null, group, staffId,
       participants, notes, status: 'booked'|'cancelled', createdBy/At, updatedBy/At }. Two bookings clash when their times
       overlap (10:00–11:00 and 11:00–12:00 don't). The clash check reads every saved booking at save time.
     Materials `nexora-materials:<school>` { id, name, area (LEARNING_AREAS), classId|null, roomId|null, condition:
       'good'|'repair'|'missing', lastChecked, notes } · Repairs `nexora-repairs:<school>` { id, materialId, status:
       'open'|'progress'|'resolved', reportedAt, reportedBy, notes, history } — one open repair per material.
     Books `nexora-books:<school>` { id, title, author, ref, copies, cover (data URL ≤ 300 KB) } · Loans `nexora-loans:<school>`
       { id, bookId, copy, borrowerType: 'child'|'staff', borrowerId, loanDate, dueDate, status: 'active'|'returned',
       issuedBy, returnedAt, returnedBy } — availability is derived from active loans; copies are numbered.
     Inventory `nexora-inventory:<school>` { id, name, category, unit, qty, reorder, supplier, location, notes, alert } ·
       Movements `nexora-stock-movements:<school>` { id, itemId, before, change, after, direction, reason, notes, at, by }.
       Quantity only changes through adjustStock (or the opening quantity). Low/out alerts notify leaders once per
       episode (an episode ends when stock goes back above the reorder level).
     All writes check permissions here; production needs the same checks (and transactions) on a server. */

  const roomsKey = id => `nexora-rooms:${id}`;
  const bookingsKey = id => `nexora-room-bookings:${id}`;
  const materialsKey = id => `nexora-materials:${id}`;
  const repairsKey = id => `nexora-repairs:${id}`;
  const booksKey = id => `nexora-books:${id}`;
  const loansKey = id => `nexora-loans:${id}`;
  const inventoryKey = id => `nexora-inventory:${id}`;
  const movementsKey = id => `nexora-stock-movements:${id}`;
  const ROOM_TYPES = { classroom: 'Classroom', hall: 'Hall', outdoor: 'Outdoor', library: 'Library', other: 'Other' };
  const CONDITIONS = { good: 'Good', repair: 'Needs repair', missing: 'Missing pieces' };
  const REPAIR_STATUS = { open: 'Open', progress: 'In progress', resolved: 'Resolved' };
  const STOCK_REASONS = { received: 'New stock received', used: 'Used in classroom', damaged: 'Damaged', expired: 'Expired', count: 'Stock count correction', other: 'Other' };
  const STOCK_UNITS = ['pieces', 'packs', 'bottles', 'boxes', 'litres', 'rolls', 'sheets'];
  const LOAN_MAX_DAYS = 28;
  const canManageResources = user => LEADERS.includes(user.role);
  const canUseResources = user => canAccess(user, 'resources');

  function getRooms() {
    return seeded(roomsKey(school.id), () => {
      const rooms = getClassRegistry().filter(c => c.status === 'active' && c.room).map((c, i) => ({ id: `room-${i + 1}`, schoolId: school.id, name: c.room, type: 'classroom', capacity: Math.max(Number(c.capacity) || 0, 12) + 4, classId: c.id, notes: '', status: 'active', demo: true }));
      return [...rooms,
        { id: 'room-hall', schoolId: school.id, name: 'Activity hall', type: 'hall', capacity: 60, classId: null, notes: 'Music, movement and assemblies.', status: 'active', demo: true },
        { id: 'room-garden', schoolId: school.id, name: 'Garden', type: 'outdoor', capacity: 40, classId: null, notes: 'Outdoor work and gardening.', status: 'active', demo: true }];
    });
  }
  const roomById = id => getRooms().find(r => r.id === id) || null;
  const getBookings = () => seeded(bookingsKey(school.id), () => {
    const d = daysFromToday(1);
    const montA = getClassRegistry().find(c => c.name === 'Montessori A');
    const nur = getClassRegistry().find(c => c.name === 'Nursery');
    return [
      { id: newId('bk'), roomId: 'room-hall', date: d, start: '10:00', end: '11:00', title: 'Music and movement', classId: montA?.id || null, group: '', staffId: 'ed-lakshmi', participants: 14, notes: '', status: 'booked', createdBy: 'Mrs. Rao', createdAt: atToday(9, 0, -2), demo: true },
      { id: newId('bk'), roomId: 'room-garden', date: d, start: '11:00', end: '11:45', title: 'Planting seeds', classId: nur?.id || null, group: '', staffId: 'ed-priya', participants: 11, notes: '', status: 'booked', createdBy: 'Mrs. Rao', createdAt: atToday(9, 0, -2), demo: true }
    ];
  });
  // School hours from Settings bound bookings; without settings, 07:00–18:00.
  const roomHours = () => { const h = getSettings(school.id).hours; return { open: isTime(h.open) ? h.open : '07:00', close: isTime(h.close) ? h.close : '18:00' }; };
  const bookingGroup = b => (b.classId ? classById(b.classId)?.name : '') || b.group || 'Staff';
  function bookingsOn(roomId, date) {
    return getBookings().filter(b => b.status === 'booked' && b.roomId === roomId && b.date === date).sort((a, b) => a.start.localeCompare(b.start));
  }
  function saveRoom(user, input, roomId = null) {
    if (!canManageResources(user)) return settle({ ok: false, reason: 'forbidden' });
    const list = getRooms();
    const errors = {};
    const v = { name: clean(input.name).slice(0, 60), type: clean(input.type), capacity: Number(input.capacity), classId: clean(input.classId) || null, notes: clean(input.notes).slice(0, 300) };
    if (!v.name) errors.name = 'Name the room.';
    else if (list.some(r => r.id !== roomId && r.status === 'active' && r.name.toLowerCase() === v.name.toLowerCase())) errors.name = 'A room with this name already exists.';
    if (!ROOM_TYPES[v.type]) errors.type = 'Choose a room type.';
    if (!Number.isInteger(v.capacity) || v.capacity < 1 || v.capacity > 500) errors.capacity = 'Enter a capacity from 1 to 500.';
    if (v.classId && getClassRegistry().find(c => c.id === v.classId)?.status !== 'active') errors.classId = 'Choose an active class.';
    if (v.classId && list.some(r => r.id !== roomId && r.status === 'active' && r.classId === v.classId)) errors.classId = 'That class already has a room.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    let r = roomId ? list.find(x => x.id === roomId) : null;
    if (roomId && !r) return settle({ ok: false, reason: 'missing' });
    if (r) Object.assign(r, v, { updatedBy: user.name, updatedAt: new Date().toISOString() });
    else { r = { id: newId('room'), schoolId: school.id, ...v, status: 'active', createdBy: user.name, createdAt: new Date().toISOString() }; list.push(r); }
    if (!write(roomsKey(school.id), list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, roomId ? 'edit:room' : 'add:room', r.id, r.name);
    return settle({ ok: true, room: r });
  }

  // Book a room. Re-reads every saved booking for that room and date, so hidden or filtered bookings still clash.
  function saveBooking(user, input, bookingId = null) {
    if (!canUseResources(user)) return settle({ ok: false, reason: 'forbidden' });
    const room = roomById(clean(input.roomId));
    const errors = {};
    const v = { roomId: room?.id || '', title: clean(input.title).slice(0, 80), date: clean(input.date), start: clean(input.start), end: clean(input.end), classId: clean(input.classId) || null, group: clean(input.group).slice(0, 60), staffId: clean(input.staffId), participants: input.participants === '' || input.participants == null ? null : Number(input.participants), notes: clean(input.notes).slice(0, 300) };
    if (!room || room.status !== 'active') errors.roomId = 'Choose a room.';
    if (!v.title) errors.title = 'Say what the booking is for.';
    if (!isDate(v.date)) errors.date = 'Choose a date.';
    else if (v.date < today() && !bookingId) errors.date = 'Bookings can’t be made in the past.';
    else if (!schoolDay(v.date).open) errors.date = `The school is closed that day (${schoolDay(v.date).name}).`;
    if (!isTime(v.start)) errors.start = 'Choose a start time.';
    if (!isTime(v.end)) errors.end = 'Choose an end time.';
    else if (!errors.start && toMinutes(v.end) <= toMinutes(v.start)) errors.end = 'The end time must be after the start time.';
    const h = roomHours();
    if (!errors.start && !errors.end && (toMinutes(v.start) < toMinutes(h.open) || toMinutes(v.end) > toMinutes(h.close))) errors.start = `Rooms can be booked between ${h.open} and ${h.close}.`;
    if (v.classId && getClassRegistry().find(c => c.id === v.classId)?.status !== 'active') errors.classId = 'Choose an active class.';
    if (!v.classId && !v.group) errors.classId = 'Choose a class or name the group.';
    if (!educators.some(e => e.id === v.staffId)) errors.staffId = 'Choose who is responsible.';
    if (v.participants != null && (!Number.isInteger(v.participants) || v.participants < 1)) errors.participants = 'Enter a whole number of people.';
    else if (room && v.participants != null && v.participants > room.capacity) errors.participants = `${room.name} holds up to ${room.capacity} people.`;
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const list = getBookings();
    const before = bookingId ? list.find(b => b.id === bookingId && b.status === 'booked') : null;
    if (bookingId && !before) return settle({ ok: false, reason: 'missing' });
    const clash = list.find(b => b.id !== bookingId && b.status === 'booked' && b.roomId === v.roomId && b.date === v.date && toMinutes(b.start) < toMinutes(v.end) && toMinutes(v.start) < toMinutes(b.end));
    if (clash) return settle({ ok: false, reason: 'clash', clash: { start: clash.start, end: clash.end, group: bookingGroup(clash), title: clash.title } });
    const now = new Date().toISOString();
    let b = before;
    if (b) Object.assign(b, v, { updatedBy: user.name, updatedAt: now });
    else { b = { id: newId('bk'), ...v, status: 'booked', createdBy: user.name, createdById: user.id, createdAt: now }; list.push(b); }
    if (!write(bookingsKey(school.id), list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, bookingId ? 'edit:booking' : 'add:booking', b.roomId, `${room.name} ${v.date} ${v.start}–${v.end}`);
    return settle({ ok: true, booking: b });
  }
  function cancelBooking(user, bookingId) {
    const list = getBookings();
    const b = list.find(x => x.id === bookingId && x.status === 'booked');
    if (!b) return settle({ ok: false, reason: 'missing' });
    if (!(canManageResources(user) || b.createdById === user.id)) return settle({ ok: false, reason: 'forbidden' });
    Object.assign(b, { status: 'cancelled', cancelledBy: user.name, cancelledAt: new Date().toISOString() });
    if (!write(bookingsKey(school.id), list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'cancel:booking', b.roomId, `${b.date} ${b.start}–${b.end}`);
    return settle({ ok: true });
  }

  const MATERIAL_SEED = [
    ['Pouring jugs set', 'Practical life', 'Montessori A', 'good'], ['Dressing frames (6)', 'Practical life', 'Nursery', 'good'], ['Polishing tray', 'Practical life', 'LKG A', 'repair'],
    ['Pink tower', 'Sensorial', 'Montessori A', 'good'], ['Knobbed cylinders block 1', 'Sensorial', 'Nursery', 'missing'], ['Colour box 2', 'Sensorial', 'LKG A', 'good'],
    ['Sandpaper letters', 'Language', 'Montessori A', 'good'], ['Movable alphabet', 'Language', 'UKG A', 'good'], ['Metal insets', 'Language', 'UKG B', 'good'],
    ['Number rods', 'Mathematics', 'Montessori A', 'good'], ['Golden bead material', 'Mathematics', 'UKG A', 'good'], ['Spindle box', 'Mathematics', 'UKG B', 'repair'],
    ['Continents puzzle map', 'Culture', 'Montessori A', 'good'], ['Land and water forms', 'Culture', 'UKG B', 'good'], ['Botany cabinet', 'Culture', 'LKG A', 'good']
  ];
  const getMaterials = () => seeded(materialsKey(school.id), () => MATERIAL_SEED.map(([name, area, cls, condition], i) => ({ id: `mat-${i + 1}`, schoolId: school.id, name, area, classId: getClassRegistry().find(c => c.name === cls)?.id || null, roomId: null, condition, lastChecked: daysFromToday(-((i * 5) % 40) - 3), notes: condition === 'missing' ? 'Smallest cylinder missing.' : '', demo: true })));
  // Demo repairs come from the demo material list itself, not from whatever condition materials have now.
  const getRepairs = () => seeded(repairsKey(school.id), () => MATERIAL_SEED.map((x, i) => (x[3] === 'repair' ? `mat-${i + 1}` : null)).filter(Boolean).map(id => ({ id: newId('rp'), materialId: id, status: 'open', reportedAt: atToday(9, 0, -5), reportedBy: 'Mrs. Rao', notes: '', history: [{ at: atToday(9, 0, -5), by: 'Mrs. Rao', action: 'reported' }], demo: true })));
  const canEditMaterial = (user, m) => canManageResources(user) || (user.role === 'Teacher' && m?.classId && classScope(user).includes(classById(m.classId)?.name));
  // Add/edit a material. Moving to "Needs repair" opens (or reuses) one repair ticket and notifies leaders, in one save.
  function saveMaterial(user, input, materialId = null) {
    if (!canUseResources(user)) return settle({ ok: false, reason: 'forbidden' });
    getRepairs();
    const list = getMaterials();
    const before = materialId ? list.find(m => m.id === materialId) : null;
    if (materialId && !before) return settle({ ok: false, reason: 'missing' });
    const errors = {};
    const v = { name: clean(input.name).slice(0, 80), area: clean(input.area), classId: clean(input.classId) || null, roomId: clean(input.roomId) || null, condition: clean(input.condition), lastChecked: clean(input.lastChecked), notes: clean(input.notes).slice(0, 500) };
    if (!(before ? canEditMaterial(user, before) : canManageResources(user) || (v.classId && canEditMaterial(user, v)))) return settle({ ok: false, reason: 'forbidden' });
    if (!v.name) errors.name = 'Name the material.';
    if (!LEARNING_AREAS.includes(v.area)) errors.area = 'Choose a curriculum area.';
    if (!v.classId && !v.roomId) errors.classId = 'Choose the class or room it belongs to.';
    if (v.classId && !classById(v.classId)) errors.classId = 'Choose a class from the list.';
    if (v.roomId && !roomById(v.roomId)) errors.roomId = 'Choose a room from the list.';
    if (!CONDITIONS[v.condition]) errors.condition = 'Choose a condition.';
    if (!isDate(v.lastChecked)) errors.lastChecked = 'Enter when it was last checked.';
    else if (v.lastChecked > today()) errors.lastChecked = 'The check date can’t be in the future.';
    if (v.condition === 'missing' && !v.notes) errors.notes = 'Note which pieces are missing.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const now = new Date().toISOString();
    const prevCondition = before?.condition || null;
    let m = before;
    if (m) Object.assign(m, v, { updatedBy: user.name, updatedAt: now });
    else { m = { id: newId('mat'), schoolId: school.id, ...v, createdBy: user.name, createdAt: now }; list.push(m); }
    const writes = [{ key: materialsKey(school.id), value: list }];
    let repair = null;
    let newTicket = false;
    if (v.condition === 'repair' && prevCondition !== 'repair') {
      const repairs = getRepairs();
      repair = repairs.find(r => r.materialId === m.id && r.status !== 'resolved');
      if (repair) repair.history = [...repair.history, { at: now, by: user.name, action: 'reported again', detail: v.notes }];
      else { repair = { id: newId('rp'), materialId: m.id, status: 'open', reportedAt: now, reportedBy: user.name, reportedById: user.id, notes: v.notes, history: [{ at: now, by: user.name, action: 'reported', detail: v.notes }] }; repairs.push(repair); newTicket = true; }
      writes.push({ key: repairsKey(school.id), value: repairs });
    }
    if (!commit(writes)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, materialId ? 'edit:material' : 'add:material', m.id, `${m.name}: ${CONDITIONS[m.condition]}`);
    let notified = null;
    if (repair) {
      const where = m.classId ? classById(m.classId)?.name : roomById(m.roomId)?.name;
      notified = notifyUsers({ module: 'resources', kind: 'repair', title: `Repair needed: ${m.name}`, body: `${where || 'Unassigned'} · reported by ${user.name}${v.notes ? ` — ${v.notes}` : ''}`, recordType: 'repair', recordId: repair.id, dedupeKey: `repair:${repair.id}`, actorId: user.id }, { toRoles: STAFF_RATIO_ROLES, exclude: [user.id] });
    }
    return settle({ ok: true, material: m, repair, newTicket, notified });
  }
  function setRepairStatus(user, repairId, status, note = '') {
    if (!canManageResources(user)) return settle({ ok: false, reason: 'forbidden' });
    if (!REPAIR_STATUS[status]) return settle({ ok: false, reason: 'invalid' });
    const repairs = getRepairs();
    const r = repairs.find(x => x.id === repairId);
    if (!r) return settle({ ok: false, reason: 'missing' });
    const now = new Date().toISOString();
    Object.assign(r, { status, notes: clean(note) || r.notes, history: [...r.history, { at: now, by: user.name, action: REPAIR_STATUS[status].toLowerCase(), detail: clean(note) }] });
    if (status === 'resolved') Object.assign(r, { resolvedAt: now, resolvedBy: user.name });
    if (!write(repairsKey(school.id), repairs)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'repair:status', r.materialId, REPAIR_STATUS[status]);
    return settle({ ok: true, repair: r });
  }

  const BOOK_SEED = [['The Very Hungry Caterpillar', 'Eric Carle', 'LIB-001', 3], ['Where the Wild Things Are', 'Maurice Sendak', 'LIB-002', 2], ['Brown Bear, Brown Bear, What Do You See?', 'Bill Martin Jr.', 'LIB-003', 2], ['Goodnight Moon', 'Margaret Wise Brown', 'LIB-004', 1], ['The Snowy Day', 'Ezra Jack Keats', 'LIB-005', 2], ['Montessori: A Modern Approach (staff)', 'Paula Polk Lillard', 'LIB-006', 1]];
  const getBooks = () => seeded(booksKey(school.id), () => BOOK_SEED.map(([title, author, ref, copies], i) => ({ id: `book-${i + 1}`, schoolId: school.id, title, author, ref, copies, cover: null, demo: true })));
  const getLoans = () => read(loansKey(school.id), []);
  function bookStatus(bookId, loans = getLoans()) {
    const b = getBooks().find(x => x.id === bookId);
    if (!b) return null;
    const active = loans.filter(l => l.bookId === bookId && l.status === 'active');
    const overdue = active.filter(l => l.dueDate < today());
    return { book: b, active, available: Math.max(0, b.copies - active.length), overdue };
  }
  const borrowerName = l => (l.borrowerType === 'staff' ? educators.find(e => e.id === l.borrowerId)?.name : (() => { const c = childById(l.borrowerId); return c ? childName(c) : ''; })()) || 'Unknown';
  // Who a user may lend to: staff, and children in their classes (leaders: every active child).
  function borrowersFor(user) {
    const kids = getChildren().filter(c => c.status === 'active' && (LEADERS.includes(user.role) || classScope(user).includes(c.cls)));
    return { children: kids.map(c => ({ id: c.id, name: childName(c), cls: c.cls })), staff: educators.map(e => ({ id: e.id, name: e.name })) };
  }
  function saveBook(user, input, bookId = null) {
    if (!canManageResources(user)) return settle({ ok: false, reason: 'forbidden' });
    const list = getBooks();
    const errors = {};
    const v = { title: clean(input.title).slice(0, 160), author: clean(input.author).slice(0, 120), ref: clean(input.ref).slice(0, 40), copies: Number(input.copies) };
    if (input.cover !== undefined) {
      if (input.cover && !/^data:image\/(png|jpeg|webp);base64,/.test(input.cover)) errors.cover = 'Use a PNG, JPEG or WebP image.';
      else if (input.cover && input.cover.length > 400000) errors.cover = 'Use a cover image under 300 KB.';
      else v.cover = input.cover || null;
    }
    if (!v.title) errors.title = 'Enter the title.';
    if (!Number.isInteger(v.copies) || v.copies < 1 || v.copies > 100) errors.copies = 'Enter 1 to 100 copies.';
    if (v.ref && list.some(b => b.id !== bookId && b.ref.toLowerCase() === v.ref.toLowerCase())) errors.ref = 'Another book uses this reference.';
    if (bookId && !errors.copies) { const st = bookStatus(bookId); if (st && v.copies < st.active.length) errors.copies = `${st.active.length} copies are on loan; you can’t have fewer copies than that.`; }
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    let b = bookId ? list.find(x => x.id === bookId) : null;
    if (bookId && !b) return settle({ ok: false, reason: 'missing' });
    if (b) Object.assign(b, v, { updatedBy: user.name, updatedAt: new Date().toISOString() });
    else { b = { id: newId('book'), schoolId: school.id, cover: null, ...v, createdBy: user.name, createdAt: new Date().toISOString() }; list.push(b); }
    if (!write(booksKey(school.id), list)) return settle({ ok: false, reason: 'storage', errors: v.cover ? { cover: 'There isn’t room on this device for this cover.' } : undefined });
    return settle({ ok: true, book: b });
  }
  // Lend one copy. Re-reads loans at save time; the lowest free copy number is used, so one copy is never lent twice.
  function lendBook(user, { bookId, borrowerType, borrowerId, loanDate, dueDate, notes = '' }) {
    if (!canUseResources(user)) return settle({ ok: false, reason: 'forbidden' });
    const loans = getLoans();
    const st = bookStatus(bookId, loans);
    if (!st) return settle({ ok: false, reason: 'missing' });
    const errors = {};
    const allowed = borrowersFor(user);
    if (!['child', 'staff'].includes(borrowerType)) errors.borrowerType = 'Choose child or staff.';
    else if (!(borrowerType === 'child' ? allowed.children : allowed.staff).some(x => x.id === borrowerId)) errors.borrowerId = 'Choose a borrower from the list.';
    if (!isDate(loanDate) || loanDate > today()) errors.loanDate = 'The loan date must be today or earlier.';
    if (!isDate(dueDate)) errors.dueDate = 'Choose a due date.';
    else if (!errors.loanDate && dueDate < loanDate) errors.dueDate = 'The due date can’t be before the loan date.';
    else if (!errors.loanDate && dDiff(dueDate, loanDate) > LOAN_MAX_DAYS) errors.dueDate = `Loans can be up to ${LOAN_MAX_DAYS} days.`;
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    if (st.available < 1) return settle({ ok: false, reason: 'unavailable' });
    if (st.active.some(l => l.borrowerType === borrowerType && l.borrowerId === borrowerId)) return settle({ ok: false, reason: 'invalid', errors: { borrowerId: 'This borrower already has a copy of this book.' } });
    const used = new Set(st.active.map(l => l.copy));
    let copy = 1;
    while (used.has(copy)) copy += 1;
    const loan = { id: newId('loan'), bookId, copy, borrowerType, borrowerId, loanDate, dueDate, notes: clean(notes).slice(0, 300), status: 'active', issuedBy: user.name, issuedById: user.id, issuedAt: new Date().toISOString(), returnedAt: null, returnedBy: null };
    if (!write(loansKey(school.id), [...loans, loan])) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'lend:book', bookId, `${st.book.title} copy ${copy} → ${borrowerName(loan)}`);
    return settle({ ok: true, loan, available: st.available - 1 });
  }
  function returnBook(user, loanId) {
    if (!canUseResources(user)) return settle({ ok: false, reason: 'forbidden' });
    const loans = getLoans();
    const l = loans.find(x => x.id === loanId);
    if (!l) return settle({ ok: false, reason: 'missing' });
    if (l.status !== 'active') return settle({ ok: false, reason: 'returned' });
    Object.assign(l, { status: 'returned', returnedAt: new Date().toISOString(), returnedBy: user.name, returnedById: user.id });
    if (!write(loansKey(school.id), loans)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'return:book', l.bookId, `copy ${l.copy} from ${borrowerName(l)}`);
    return settle({ ok: true, loan: l });
  }

  const INVENTORY_SEED = [['Paper towels', 'Cleaning', 'rolls', 18, 6], ['Hand soap', 'Cleaning', 'bottles', 4, 4], ['Washable paint', 'Art', 'bottles', 9, 5], ['Drawing paper A4', 'Art', 'packs', 0, 3], ['Glue sticks', 'Art', 'pieces', 22, 10], ['Tissue boxes', 'Hygiene', 'boxes', 12, 6], ['Snack plates (compostable)', 'Kitchen', 'packs', 3, 4]];
  const getInventory = () => seeded(inventoryKey(school.id), () => INVENTORY_SEED.map(([name, category, unit, qty, reorder], i) => ({ id: `inv-${i + 1}`, schoolId: school.id, name, category, unit, qty, reorder, supplier: '', location: 'Store room', notes: '', alert: null, updatedAt: atToday(9, 0, -3), demo: true })));
  const getMovements = () => read(movementsKey(school.id), []);
  const stockStatus = it => (it.qty <= 0 ? 'out' : it.qty <= it.reorder ? 'low' : 'ok');
  // Low/out alerts from the saved quantity: one notification per episode (and one more if it then runs out).
  function stockAlert(user, it) {
    const status = stockStatus(it);
    if (status === 'ok') { it.alert = null; return null; }
    const prev = it.alert;
    if (prev && (prev.status === status || (prev.status === 'out' && status === 'low'))) { it.alert = { ...prev, status }; return null; }
    const episode = prev ? prev.episode : (it.alertEpisode || 0) + 1;
    it.alertEpisode = episode;
    it.alert = { status, since: new Date().toISOString(), episode };
    return { module: 'resources', kind: status === 'out' ? 'stock-out' : 'stock-low', title: status === 'out' ? `Out of stock: ${it.name}` : `Low stock: ${it.name}`, body: `${it.qty} ${it.unit} left · reorder level ${it.reorder}${status === 'out' ? ' · none left' : ''}`, recordType: 'stock', recordId: it.id, severity: status === 'out' ? 'critical' : 'normal', dedupeKey: `stock-${status}:${it.id}:${episode}`, actorId: user.id };
  }
  function saveInventoryItem(user, input, itemId = null) {
    if (!canManageResources(user)) return settle({ ok: false, reason: 'forbidden' });
    const list = getInventory();
    const errors = {};
    const v = { name: clean(input.name).slice(0, 80), category: clean(input.category).slice(0, 40), unit: clean(input.unit), reorder: Number(input.reorder), supplier: clean(input.supplier).slice(0, 80), location: clean(input.location).slice(0, 60), notes: clean(input.notes).slice(0, 300) };
    if (!v.name) errors.name = 'Name the item.';
    else if (list.some(x => x.id !== itemId && x.name.toLowerCase() === v.name.toLowerCase() && x.unit === v.unit)) errors.name = 'This item is already in the inventory.';
    if (!v.category) errors.category = 'Enter a category.';
    if (!STOCK_UNITS.includes(v.unit)) errors.unit = 'Choose a unit.';
    if (!Number.isInteger(v.reorder) || v.reorder < 0) errors.reorder = 'Enter a whole number of 0 or more.';
    let opening = 0;
    if (!itemId) { opening = Number(input.qty); if (!Number.isInteger(opening) || opening < 0) errors.qty = 'Enter a whole number of 0 or more.'; }
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const now = new Date().toISOString();
    let it = itemId ? list.find(x => x.id === itemId) : null;
    if (itemId && !it) return settle({ ok: false, reason: 'missing' });
    const writes = [];
    // Editing never changes the quantity; a new reorder level can still start or end an alert.
    if (it) Object.assign(it, v, { updatedAt: now, updatedBy: user.name });
    else {
      it = { id: newId('inv'), schoolId: school.id, ...v, qty: opening, alert: null, createdBy: user.name, createdAt: now, updatedAt: now };
      list.push(it);
      writes.push({ key: movementsKey(school.id), value: [...getMovements(), { id: newId('mv'), itemId: it.id, before: 0, change: opening, after: opening, direction: 'add', reason: 'opening', notes: 'Opening quantity', at: now, by: user.name, byId: user.id }] });
    }
    const alert = stockAlert(user, it);
    writes.unshift({ key: inventoryKey(school.id), value: list });
    if (!commit(writes)) return settle({ ok: false, reason: 'storage' });
    if (alert) notifyUsers(alert, { toRoles: STAFF_RATIO_ROLES });
    return settle({ ok: true, item: it, alert: Boolean(alert) });
  }
  function adjustStock(user, itemId, { direction, amount, reason, notes = '' }) {
    if (!canUseResources(user)) return settle({ ok: false, reason: 'forbidden' });
    const list = getInventory();
    const it = list.find(x => x.id === itemId);
    if (!it) return settle({ ok: false, reason: 'missing' });
    const n = Number(amount);
    const errors = {};
    if (!['add', 'remove'].includes(direction)) errors.direction = 'Choose add or remove.';
    if (!Number.isInteger(n) || n < 1) errors.amount = 'Enter a whole number of 1 or more.';
    if (!STOCK_REASONS[reason]) errors.reason = 'Choose a reason.';
    if (reason === 'other' && !clean(notes)) errors.notes = 'Explain the reason.';
    if (!errors.amount && direction === 'remove' && n > it.qty) errors.amount = `Only ${it.qty} ${it.unit} in stock.`;
    if (Object.keys(errors).length) return settle({ ok: false, reason: errors.amount?.startsWith('Only') ? 'insufficient' : 'invalid', errors });
    const before = it.qty;
    it.qty = direction === 'add' ? before + n : before - n;
    it.updatedAt = new Date().toISOString();
    it.updatedBy = user.name;
    const alert = stockAlert(user, it);
    const mv = { id: newId('mv'), itemId, before, change: n, after: it.qty, direction, reason, notes: clean(notes).slice(0, 300), at: it.updatedAt, by: user.name, byId: user.id };
    if (!commit([{ key: inventoryKey(school.id), value: list }, { key: movementsKey(school.id), value: [...getMovements(), mv] }])) return settle({ ok: false, reason: 'storage' });
    if (alert) notifyUsers(alert, { toRoles: STAFF_RATIO_ROLES });
    logAudit(user, 'adjust:stock', itemId, `${it.name}: ${before} → ${it.qty} (${STOCK_REASONS[reason]})`);
    return settle({ ok: true, item: it, movement: mv, status: stockStatus(it), alert: Boolean(alert) });
  }

  /* ---------------------------------------------------------------- Messages & Communications (inbox.js at ?page=messages)
     The S16 family message log (?page=messages&family=…) is unchanged; this is the two-way inbox.
     Conversations `nexora-conversations:<school>` { id, schoolId, type: 'family'|'staff'|'class', title, familyId,
       childIds, guardianIds, staffUserIds (members who can open it), classId, broadcast, demo, createdBy, createdAt,
       lastMessageAt } — only members can read or write.
     Messages `nexora-chat-messages:<school>` { id, conversationId, senderType: 'staff'|'guardian', senderId, body,
       attachments [fileId], status: 'sent'|'scheduled'|'cancelled', scheduledFor, createdAt, sentAt, clientId, demo,
       private (a family's reply in a class broadcast: staff see it, other families never would), translations }.
     Reads `nexora-chat-reads:<school>` { messageId, readerType: 'user'|'guardian', readerId, at, demo }.
     Files `nexora-chat-files:<school>` — images and PDFs checked by their content (not the name), ≤ 1 MB, device-local.
     Guardians have no app login in this prototype, so family replies only exist in DEMO MODE: a reply is queued
     (`nexora-chat-demo-queue`) ~3 s after a family message is sent, delivered by processMessaging() (run on every page),
     flagged demo and labelled in the UI. Staff ↔ staff threads are real between the demo accounts on this device.
     Scheduled messages are delivered by processMessaging() while the app is open — there is no server scheduler.
     Translation goes through translateMessage(); no translation service is configured, so only the demo replies'
     built-in translations (labelled as demo) can be shown — nothing else is ever invented. */

  const convKey = id => `nexora-conversations:${id}`;
  const chatMsgKey = id => `nexora-chat-messages:${id}`;
  const chatReadKey = id => `nexora-chat-reads:${id}`;
  const chatFilesKey = id => `nexora-chat-files:${id}`;
  const quickRepliesKey = id => `nexora-quick-replies:${id}`;
  const msgDemoKey = id => `nexora-messaging-demo:${id}`;
  const demoQueueKey = id => `nexora-chat-demo-queue:${id}`;
  const CONV_TYPES = { family: 'Family', staff: 'Staff', class: 'Class group' };
  const CHAT_FILE_SIGNATURES = { 'application/pdf': 'JVBERi0', 'image/png': 'iVBORw0KGgo', 'image/jpeg': '/9j/', 'image/webp': 'UklGR' };
  const DEFAULT_QUICK_REPLIES = ['Thank you for the update.', 'We will follow up shortly.', 'Please contact the school office.', 'Your message has been received.'];
  const DEMO_REPLIES = {
    en: [['Thank you, that’s helpful!'], ['Noted — we’ll bring it tomorrow.'], ['Thanks for letting us know.']],
    ta: [['நன்றி, தகவலுக்கு!', 'Thank you for the information!'], ['சரி, நாளை கொண்டு வருகிறோம்.', 'Okay, we’ll bring it tomorrow.']],
    hi: [['जानकारी के लिए धन्यवाद!', 'Thank you for the information!']],
    ar: [['شكراً على التحديث', 'Thank you for the update']]
  };
  const messagingDemo = () => read(msgDemoKey(school.id), { enabled: true }).enabled !== false;
  function setMessagingDemo(user, enabled) {
    if (!LEADERS.includes(user.role)) return settle({ ok: false, reason: 'forbidden' });
    if (!enabled) write(demoQueueKey(school.id), []);
    return settle(write(msgDemoKey(school.id), { enabled: Boolean(enabled) }) ? { ok: true } : { ok: false, reason: 'storage' });
  }
  const getConversations = () => seeded(convKey(school.id), () => {
    // Demo threads (flagged demo) so the inbox isn't empty in the prototype.
    const now = Date.now();
    const iso = ms => new Date(ms).toISOString();
    const fam = listFamilies().find(f => f.children.some(c => c.id === 's1'));
    const convs = [];
    if (fam) convs.push({ id: 'cv-demo-1', schoolId: school.id, type: 'family', title: fam.name, familyId: fam.id, childIds: fam.children.filter(c => c.status === 'active').map(c => c.id), guardianIds: fam.guardians.map(g => g.id), staffUserIds: ['u-teacher', 'u-director'], classId: null, broadcast: false, demo: true, createdBy: 'Ms. Lakshmi', createdAt: iso(now - 86400000 * 2), lastMessageAt: iso(now - 3600000 * 20) });
    convs.push({ id: 'cv-demo-2', schoolId: school.id, type: 'staff', title: '', familyId: null, childIds: [], guardianIds: [], staffUserIds: ['u-director', 'u-teacher'], classId: null, broadcast: false, demo: true, createdBy: 'Mrs. Rao', createdAt: iso(now - 86400000), lastMessageAt: iso(now - 3600000 * 3) });
    return convs;
  });
  const getChatMessages = () => seeded(chatMsgKey(school.id), () => {
    const now = Date.now();
    const iso = ms => new Date(ms).toISOString();
    const fam = getConversations().find(c => c.id === 'cv-demo-1');
    const g = fam?.guardianIds[0];
    const out = [];
    if (fam) out.push(
      { id: 'cm-demo-1', conversationId: 'cv-demo-1', senderType: 'staff', senderId: 'u-teacher', body: 'Aarav built the pink tower on his own today and counted every cube aloud.', attachments: [], status: 'sent', createdAt: iso(now - 3600000 * 22), sentAt: iso(now - 3600000 * 22), demo: true },
      { id: 'cm-demo-2', conversationId: 'cv-demo-1', senderType: 'guardian', senderId: g, body: 'நன்றி, தகவலுக்கு!', attachments: [], status: 'sent', createdAt: iso(now - 3600000 * 20), sentAt: iso(now - 3600000 * 20), demo: true, translations: { en: 'Thank you for the information!' }, lang: 'ta' });
    out.push(
      { id: 'cm-demo-3', conversationId: 'cv-demo-2', senderType: 'staff', senderId: 'u-director', body: 'Could you send me the Farm visit consent count by Thursday?', attachments: [], status: 'sent', createdAt: iso(now - 3600000 * 3), sentAt: iso(now - 3600000 * 3), demo: true });
    return out;
  });
  const getChatReads = () => read(chatReadKey(school.id), []);
  const getQuickReplies = () => read(quickRepliesKey(school.id), DEFAULT_QUICK_REPLIES);
  function saveQuickReplies(user, list) {
    if (!LEADERS.includes(user.role)) return settle({ ok: false, reason: 'forbidden' });
    const v = [...new Set((list || []).map(clean).filter(Boolean).map(s => s.slice(0, 200)))].slice(0, 12);
    if (!v.length) return settle({ ok: false, reason: 'invalid', errors: { replies: 'Add at least one quick reply.' } });
    return settle(write(quickRepliesKey(school.id), v) ? { ok: true, replies: v } : { ok: false, reason: 'storage' });
  }

  const isMember = (user, c) => Boolean(c) && c.schoolId === school.id && c.staffUserIds.includes(user.id) && canAccess(user, 'messages');
  const staffUser = id => users.find(u => u.id === id && u.schoolId === school.id) || null;
  function convTitle(user, c) {
    if (c.type === 'staff') return c.staffUserIds.filter(id => id !== user.id).map(id => staffUser(id)?.name).filter(Boolean).join(', ') || 'Staff';
    if (c.type === 'class') return `${classById(c.classId)?.name || 'Class'} families`;
    return c.title || 'Family';
  }
  // Everyone a message goes to, besides its sender (users read for real; guardians only through demo receipts).
  function recipientsOf(c, m) {
    const staff = c.staffUserIds.filter(id => !(m.senderType === 'staff' && m.senderId === id)).map(id => ({ type: 'user', id }));
    const fams = m.private ? [] : c.guardianIds.filter(id => !(m.senderType === 'guardian' && m.senderId === id)).map(id => ({ type: 'guardian', id }));
    return [...staff, ...fams];
  }
  const isRead = (reads, m, r) => reads.some(x => x.messageId === m.id && x.readerType === r.type && x.readerId === r.id);
  const unreadIn = (user, c, msgs = getChatMessages(), reads = getChatReads()) => msgs.filter(m => m.conversationId === c.id && m.status === 'sent' && !(m.senderType === 'staff' && m.senderId === user.id) && !isRead(reads, m, { type: 'user', id: user.id })).length;
  const totalChatUnread = user => { const msgs = getChatMessages(); const reads = getChatReads(); return getConversations().filter(c => isMember(user, c)).reduce((t, c) => t + unreadIn(user, c, msgs, reads), 0); };

  // The user's conversations, newest activity first. Search covers names, children and message text the user can read.
  function listConversations(user, { filter = 'all', q = '' } = {}) {
    const msgs = getChatMessages();
    const reads = getChatReads();
    const query = clean(q).toLowerCase();
    return getConversations().filter(c => isMember(user, c)).map(c => {
      const mine = msgs.filter(m => m.conversationId === c.id && m.status !== 'cancelled' && (m.status === 'sent' || (m.senderType === 'staff' && m.senderId === user.id)));
      const last = mine.filter(m => m.status === 'sent').sort((a, b) => (a.sentAt || a.createdAt).localeCompare(b.sentAt || b.createdAt)).pop() || null;
      const kids = c.childIds.map(id => childById(id)).filter(Boolean);
      return { conv: c, title: convTitle(user, c), children: kids.map(k => childName(k)), last, unread: unreadIn(user, c, msgs, reads), scheduled: mine.filter(m => m.status === 'scheduled').length, hay: [convTitle(user, c), ...kids.map(k => childName(k)), ...c.guardianIds.map(id => guardianById(id)?.name), ...mine.map(m => m.body)].join(' ').toLowerCase() };
    }).filter(r => (filter === 'all' || (filter === 'unread' && r.unread) || (filter === 'families' && r.conv.type === 'family') || (filter === 'staff' && r.conv.type === 'staff') || (filter === 'groups' && r.conv.type === 'class')) && (!query || r.hay.includes(query)))
      .sort((a, b) => (b.last?.sentAt || b.conv.lastMessageAt || b.conv.createdAt).localeCompare(a.last?.sentAt || a.conv.lastMessageAt || a.conv.createdAt));
  }
  function conversationView(user, convId) {
    const c = getConversations().find(x => x.id === convId);
    if (!c) return { error: 'missing' };
    if (!isMember(user, c)) return { error: 'forbidden' };
    const reads = getChatReads();
    const messages = getChatMessages().filter(m => m.conversationId === c.id && m.status !== 'cancelled' && (m.status === 'sent' || (m.senderType === 'staff' && m.senderId === user.id)))
      .sort((a, b) => (a.sentAt || a.scheduledFor || a.createdAt).localeCompare(b.sentAt || b.scheduledFor || b.createdAt))
      .map(m => {
        const mine = m.senderType === 'staff' && m.senderId === user.id;
        const rs = recipientsOf(c, m);
        const readers = rs.filter(r => isRead(reads, m, r));
        return { ...m, mine, receipt: mine && m.status === 'sent' ? { total: rs.length, read: readers.length, allRead: rs.length > 0 && readers.length === rs.length, demo: readers.some(r => r.type === 'guardian') } : null, senderName: m.senderType === 'staff' ? staffUser(m.senderId)?.name || 'Staff' : guardianById(m.senderId)?.name || 'Family' };
      });
    return { conv: c, title: convTitle(user, c), messages };
  }

  // Who the user may start a conversation with.
  function messageTargets(user) {
    const scope = classScope(user);
    const families = listFamilies().filter(f => f.children.some(c => c.status === 'active' && (LEADERS.includes(user.role) || scope.includes(c.cls))));
    return {
      families: families.map(f => ({ id: f.id, name: f.name, children: f.children.filter(c => c.status === 'active').map(c => ({ id: c.id, name: c.name, cls: c.cls })), guardians: f.guardians.map(g => ({ id: g.id, name: g.name })) })),
      staff: users.filter(u => u.schoolId === school.id && u.id !== user.id && canAccess(u, 'messages')).map(u => ({ id: u.id, name: u.name, role: u.role })),
      classes: getClassRegistry().filter(c => c.status === 'active' && (LEADERS.includes(user.role) || scope.includes(c.name))).map(c => ({ id: c.id, name: c.name, families: listFamilies().filter(f => f.children.some(k => k.cls === c.name && k.status === 'active')).length }))
    };
  }
  function startConversation(user, { type, familyId, staffUserId, classId }) {
    if (!canAccess(user, 'messages')) return settle({ ok: false, reason: 'forbidden' });
    const t = messageTargets(user);
    const list = getConversations();
    const now = new Date().toISOString();
    let c = null;
    if (type === 'family') {
      const f = t.families.find(x => x.id === familyId);
      if (!f) return settle({ ok: false, reason: 'invalid', errors: { target: 'Choose a family in your classes.' } });
      c = list.find(x => x.type === 'family' && x.familyId === f.id && x.staffUserIds.includes(user.id) && !x.demo);
      if (!c) { c = { id: newId('cv'), schoolId: school.id, type, title: f.name, familyId: f.id, childIds: f.children.map(k => k.id), guardianIds: f.guardians.map(g => g.id), staffUserIds: [user.id], classId: null, broadcast: false, demo: false, createdBy: user.name, createdAt: now, lastMessageAt: now }; list.push(c); }
    } else if (type === 'staff') {
      const s = t.staff.find(x => x.id === staffUserId);
      if (!s) return settle({ ok: false, reason: 'invalid', errors: { target: 'Choose a colleague.' } });
      c = list.find(x => x.type === 'staff' && x.staffUserIds.length === 2 && x.staffUserIds.includes(user.id) && x.staffUserIds.includes(s.id) && !x.demo);
      if (!c) { c = { id: newId('cv'), schoolId: school.id, type, title: '', familyId: null, childIds: [], guardianIds: [], staffUserIds: [user.id, s.id], classId: null, broadcast: false, demo: false, createdBy: user.name, createdAt: now, lastMessageAt: now }; list.push(c); }
    } else if (type === 'class') {
      const k = t.classes.find(x => x.id === classId);
      if (!k) return settle({ ok: false, reason: 'invalid', errors: { target: 'Choose one of your classes.' } });
      const cls = classById(k.id);
      const kids = getChildren().filter(ch => ch.cls === cls.name && ch.status === 'active');
      const teachers = educators.filter(e => e.userId && cls.staffIds.includes(e.id)).map(e => e.userId);
      c = list.find(x => x.type === 'class' && x.classId === cls.id && x.staffUserIds.includes(user.id));
      if (!c) { c = { id: newId('cv'), schoolId: school.id, type, title: `${cls.name} families`, familyId: null, childIds: kids.map(ch => ch.id), guardianIds: [...new Set(kids.flatMap(ch => (ch.guardianLinks || []).map(l => l.guardianId)))], staffUserIds: [...new Set([user.id, ...teachers])], classId: cls.id, broadcast: true, demo: false, createdBy: user.name, createdAt: now, lastMessageAt: now }; list.push(c); }
    } else return settle({ ok: false, reason: 'invalid', errors: { type: 'Choose who the conversation is with.' } });
    if (!write(convKey(school.id), list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'start:conversation', c.id, CONV_TYPES[c.type]);
    return settle({ ok: true, conversation: c });
  }

  function uploadChatFile(user, { name, mime, size, data }) {
    if (!canAccess(user, 'messages')) return settle({ ok: false, reason: 'forbidden' });
    const sig = CHAT_FILE_SIGNATURES[mime];
    const body = String(data || '').split(',')[1] || '';
    if (!sig || !String(data).startsWith(`data:${mime};base64,`) || !body.startsWith(sig)) return settle({ ok: false, reason: 'invalid', errors: { file: 'Attach an image (JPEG, PNG, WebP) or a PDF.' } });
    if (!(Number(size) > 0) || Number(size) > 1024 * 1024 || body.length > 1024 * 1024 * 1.4) return settle({ ok: false, reason: 'invalid', errors: { file: 'Attachments must be 1 MB or less.' } });
    const f = { id: newId('cf'), name: clean(name).slice(0, 120) || 'Attachment', mime, size: Number(size), data, uploadedBy: user.id, at: new Date().toISOString(), messageId: null };
    if (!write(chatFilesKey(school.id), [...read(chatFilesKey(school.id), []), f])) return settle({ ok: false, reason: 'storage', errors: { file: 'There isn’t room on this device for this file.' } });
    return settle({ ok: true, file: { id: f.id, name: f.name, mime: f.mime, size: f.size } });
  }
  function chatFile(user, fileId) {
    const f = read(chatFilesKey(school.id), []).find(x => x.id === fileId);
    if (!f) return null;
    if (!f.messageId) return f.uploadedBy === user.id ? f : null;
    const m = getChatMessages().find(x => x.id === f.messageId);
    const c = m && getConversations().find(x => x.id === m.conversationId);
    return isMember(user, c) ? f : null;
  }

  function notifyMembers(c, m, exceptUserId, demoReply = false) {
    const ids = c.staffUserIds.filter(id => id !== exceptUserId);
    if (!ids.length) return 0;
    const from = m.senderType === 'staff' ? staffUser(m.senderId)?.name : guardianById(m.senderId)?.name;
    // The notification names the sender and thread only — message text stays in Messages.
    return notifyUsers({ module: 'messages', kind: 'message', title: `New message from ${from || 'a family'}${demoReply ? ' (demo)' : ''}`, body: c.type === 'class' ? `${classById(c.classId)?.name || 'Class'} families` : c.type === 'family' ? c.title : 'Staff conversation', recordType: 'conversation', recordId: c.id, dedupeKey: `chat:${m.id}`, actorId: m.senderType === 'staff' ? m.senderId : undefined }, { toUserIds: ids });
  }

  function sendChatMessage(user, convId, { body = '', attachmentIds = [], clientId = '', scheduleAt = '' }) {
    const list = getConversations();
    const c = list.find(x => x.id === convId);
    if (!c) return settle({ ok: false, reason: 'missing' });
    if (!isMember(user, c)) return settle({ ok: false, reason: 'forbidden' });
    const msgs = getChatMessages();
    if (clientId) { const dup = msgs.find(m => m.clientId === clientId && m.senderId === user.id); if (dup) return settle({ ok: true, message: dup, repeated: true }); }
    const text = String(body || '').replace(/\r\n/g, '\n').trim();
    const files = read(chatFilesKey(school.id), []);
    const ids = [...new Set(attachmentIds)];
    if (ids.some(id => { const f = files.find(x => x.id === id); return !f || f.uploadedBy !== user.id || f.messageId; })) return settle({ ok: false, reason: 'invalid', errors: { file: 'An attachment is missing. Remove it and attach it again.' } });
    if (!text && !ids.length) return settle({ ok: false, reason: 'invalid', errors: { body: 'Write a message or attach a file.' } });
    if (text.length > 4000) return settle({ ok: false, reason: 'invalid', errors: { body: 'Keep the message under 4,000 characters.' } });
    let status = 'sent';
    let scheduledFor = null;
    if (scheduleAt) {
      const at = new Date(scheduleAt);
      if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now() + 60000) return settle({ ok: false, reason: 'invalid', errors: { schedule: 'Choose a time at least a minute from now.' } });
      status = 'scheduled';
      scheduledFor = at.toISOString();
    }
    const now = new Date().toISOString();
    const m = { id: newId('cm'), conversationId: c.id, senderType: 'staff', senderId: user.id, body: text, attachments: ids, status, scheduledFor, createdAt: now, sentAt: status === 'sent' ? now : null, clientId, demo: false };
    files.forEach(f => { if (ids.includes(f.id)) f.messageId = m.id; });
    if (status === 'sent') c.lastMessageAt = now;
    const writes = [{ key: chatMsgKey(school.id), value: [...msgs, m] }, { key: convKey(school.id), value: list }];
    if (ids.length) writes.push({ key: chatFilesKey(school.id), value: files });
    if (!commit(writes)) return settle({ ok: false, reason: 'storage' });
    if (status === 'sent') afterSend(user, c, m);
    return settle({ ok: true, message: m });
  }
  function afterSend(user, c, m) {
    notifyMembers(c, m, user.id);
    if (messagingDemo() && c.type === 'family' && c.guardianIds.length) {
      const q = read(demoQueueKey(school.id), []);
      if (!q.some(x => x.conversationId === c.id)) write(demoQueueKey(school.id), [...q, { id: newId('dq'), conversationId: c.id, replyTo: m.id, deliverAt: Date.now() + 3000 }]);
    }
  }
  function cancelScheduled(user, messageId) {
    const msgs = getChatMessages();
    const m = msgs.find(x => x.id === messageId);
    if (!m || m.senderId !== user.id || m.status !== 'scheduled') return settle({ ok: false, reason: 'missing' });
    m.status = 'cancelled';
    m.cancelledAt = new Date().toISOString();
    return settle(write(chatMsgKey(school.id), msgs) ? { ok: true } : { ok: false, reason: 'storage' });
  }
  function markConversationRead(user, convId) {
    const c = getConversations().find(x => x.id === convId);
    if (!isMember(user, c)) return 0;
    const reads = getChatReads();
    const fresh = getChatMessages().filter(m => m.conversationId === c.id && m.status === 'sent' && !(m.senderType === 'staff' && m.senderId === user.id) && !isRead(reads, m, { type: 'user', id: user.id }));
    if (fresh.length) write(chatReadKey(school.id), [...reads, ...fresh.map(m => ({ messageId: m.id, readerType: 'user', readerId: user.id, at: new Date().toISOString() }))]);
    const notes = listNotifications(user).filter(n => n.recordType === 'conversation' && n.recordId === c.id && !n.read).map(n => n.id);
    if (notes.length) setNotificationsRead(user, notes, true);
    return fresh.length;
  }

  // Runs on every page: delivers due scheduled messages and (demo mode) queued family replies. Returns what arrived.
  function processMessaging() {
    const arrived = [];
    const msgs = getChatMessages();
    const convs = getConversations();
    let changed = false;
    msgs.filter(m => m.status === 'scheduled' && new Date(m.scheduledFor).getTime() <= Date.now()).forEach(m => {
      const c = convs.find(x => x.id === m.conversationId);
      const sender = staffUser(m.senderId);
      // Re-check at send time: the sender must still be a member who can use Messages.
      if (!c || !sender || !isMember(sender, c)) { m.status = 'failed'; m.failReason = 'Sender no longer has access'; changed = true; return; }
      m.status = 'sent'; m.sentAt = new Date().toISOString(); c.lastMessageAt = m.sentAt; changed = true;
      arrived.push({ conversationId: c.id, message: m, scheduled: true });
    });
    let queue = read(demoQueueKey(school.id), []);
    const due = messagingDemo() ? queue.filter(x => x.deliverAt <= Date.now()) : [];
    const reads = getChatReads();
    const newReads = [];
    due.forEach(x => {
      const c = convs.find(k => k.id === x.conversationId);
      if (!c || !c.guardianIds.length) return;
      const g = guardianById(c.guardianIds[0]);
      const lang = guardianLanguage(g);
      const pool = DEMO_REPLIES[lang] || DEMO_REPLIES.en;
      const [text, en] = pool[msgs.filter(m => m.conversationId === c.id && m.senderType === 'guardian').length % pool.length];
      const at = new Date().toISOString();
      // The family "reads" what staff sent before replying — demo receipts, flagged as such.
      msgs.filter(m => m.conversationId === c.id && m.senderType === 'staff' && m.status === 'sent' && !isRead(reads, m, { type: 'guardian', id: g.id })).forEach(m => newReads.push({ messageId: m.id, readerType: 'guardian', readerId: g.id, at, demo: true }));
      const m = { id: newId('cm'), conversationId: c.id, senderType: 'guardian', senderId: g.id, body: text, attachments: [], status: 'sent', createdAt: at, sentAt: at, demo: true, lang, translations: en ? { en } : {} };
      msgs.push(m);
      c.lastMessageAt = at;
      changed = true;
      arrived.push({ conversationId: c.id, message: m, demo: true });
    });
    if (due.length) queue = queue.filter(x => !due.includes(x));
    if (!changed && !due.length) return [];
    const writes = [{ key: chatMsgKey(school.id), value: msgs }, { key: convKey(school.id), value: convs }, { key: demoQueueKey(school.id), value: queue }];
    if (newReads.length) writes.push({ key: chatReadKey(school.id), value: [...reads, ...newReads] });
    if (!commit(writes)) return [];
    arrived.forEach(a => { const c = convs.find(k => k.id === a.conversationId); if (c) notifyMembers(c, a.message, a.scheduled ? a.message.senderId : null, a.demo); });
    return arrived;
  }

  // Translation boundary. No service is configured: only a demo reply's built-in translation can be returned.
  function translateMessage(user, messageId, target = 'en') {
    const m = getChatMessages().find(x => x.id === messageId);
    const c = m && getConversations().find(x => x.id === m.conversationId);
    if (!isMember(user, c)) return settle({ ok: false, reason: 'forbidden' });
    const text = m.translations?.[target];
    if (text && m.demo) return settle({ ok: true, text, target, demo: true, source: m.lang || '' });
    return settle({ ok: false, reason: 'no-service' });
  }
  // What the context panel may show: children (with alerts only where the role allows), languages, staff details.
  function conversationContext(user, convId) {
    const c = getConversations().find(x => x.id === convId);
    if (!isMember(user, c)) return null;
    const scope = classScope(user);
    const children = c.childIds.map(id => childById(id)).filter(Boolean).map(k => {
      const mayOpen = canAccess(user, 'children') && scope.includes(k.cls);
      const alerts = mayOpen ? k.alerts.filter(a => canView(user, a.type === 'custody' ? 'custody' : 'medical')).map(a => ({ type: a.type, label: ALERT_TYPES[a.type] })) : [];
      return { id: k.id, name: childName(k), cls: k.cls, photo: k.photo || null, mayOpen, alerts };
    });
    const guardians = c.guardianIds.map(id => guardianById(id)).filter(Boolean).map(g => ({ id: g.id, name: g.name, language: GUARDIAN_LANGUAGES[guardianLanguage(g)] }));
    const staff = c.staffUserIds.map(id => staffUser(id)).filter(Boolean).map(u => ({ id: u.id, name: u.name, role: u.role, email: u.email }));
    return { conv: c, children: c.type === 'class' ? [] : children, childCount: children.length, guardians: c.type === 'class' ? [] : guardians, familyCount: c.type === 'class' ? new Set(c.guardianIds).size : 0, staff, cls: c.classId ? classById(c.classId) : null };
  }

  /* S17 class operations. Enrolled = active + starting-soon children (the same count S14 uses for
     capacity); present today = present + late marks in today's S19 register. */
  const canManageClasses = user => MANAGE_PLAN_ROLES.includes(user.role);
  const enrolledIn = name => getChildren().filter(c => c.cls === name && ['active', 'starting'].includes(c.status));
  // Capacity bar: below 90% neutral, 90% to under 100% amber, 100% or more red. Never divides by zero.
  const capacityState = (enrolled, capacity) => {
    if (!Number.isInteger(capacity) || capacity <= 0) return { pct: null, tone: 'unknown' };
    const pct = (enrolled / capacity) * 100;
    return { pct, tone: pct >= 100 ? 'full' : pct >= 90 ? 'near' : 'ok' };
  };

  function classCards() {
    const register = getRegister();
    const staff = getStaffAttendance();
    return activeClasses().map(c => {
      const enrolled = enrolledIn(c.name).length;
      const view = attendanceView(c.name);
      const entry = view.day.open ? register[c.name] : null;
      // Present today = attended (in now, or already collected).
      const present = entry ? view.counts.in + view.counts.out : null;
      // duty: today's staff attendance ('present' | 'absent' | undefined = not recorded); countedIn: the class their ratio counts in.
      const team = staffOf(c.name).map(e => ({ id: e.id, name: e.name, duty: staff[e.id], countedIn: countedClassOf(e.id) }));
      return { ...c, staff: team, enrolled, capacityInfo: capacityState(enrolled, c.capacity), present, onRegister: entry ? view.counts.expected : null, attendanceTakenAt: entry?.takenAt || null, ratioToday: classRatio(c.name, { register, staff }) };
    });
  }

  function validateClass(input, list, classId) {
    const int = v => (String(v ?? '').trim() === '' ? NaN : Number(v));
    const v = {
      name: clean(input.name).replace(/\s+/g, ' '), level: clean(input.level), colour: clean(input.colour), room: clean(input.room).slice(0, 60),
      ageMin: int(input.ageMin), ageMax: int(input.ageMax), mixedAge: Boolean(input.mixedAge), capacity: int(input.capacity),
      ratio: { adults: int(input.ratioAdults), children: int(input.ratioChildren) },
      staffIds: [...new Set((input.staffIds || []).filter(Boolean))]
    };
    const errors = {};
    if (!v.name) errors.name = 'Enter the class name.';
    else if (v.name.length > 60) errors.name = 'Keep the name under 60 characters.';
    else {
      const clash = list.find(c => c.id !== classId && c.name.toLowerCase() === v.name.toLowerCase());
      if (clash) errors.name = clash.status === 'archived' ? `An archived class is already called “${clash.name}”. Choose another name so its history stays clear.` : `A class called “${clash.name}” already exists.`;
    }
    if (!CLASS_LEVELS.includes(v.level)) errors.level = 'Choose a level.';
    if (!CLASS_COLOURS[v.colour]) errors.colour = 'Choose a colour tag.';
    if (!v.room) errors.room = 'Enter the room.';
    if (!Number.isInteger(v.ageMin) || v.ageMin < 0 || v.ageMin > 12) errors.ageMin = 'Enter a whole number of years from 0 to 12.';
    if (!Number.isInteger(v.ageMax) || v.ageMax < 1 || v.ageMax > 12) errors.ageMax = 'Enter a whole number of years from 1 to 12.';
    else if (Number.isInteger(v.ageMin) && v.ageMax <= v.ageMin) errors.ageMax = 'The oldest age must be greater than the youngest.';
    if (!Number.isInteger(v.capacity) || v.capacity <= 0) errors.capacity = 'Capacity must be a whole number of at least 1.';
    else if (v.capacity > 200) errors.capacity = 'Capacity looks too high. Enter 200 or fewer.';
    if (!Number.isInteger(v.ratio.adults) || v.ratio.adults <= 0) errors.ratioAdults = 'Enter a whole number of adults (at least 1).';
    if (!Number.isInteger(v.ratio.children) || v.ratio.children <= 0) errors.ratioChildren = 'Enter a whole number of children (at least 1).';
    if (v.staffIds.some(id => !educators.some(e => e.id === id))) errors.staffIds = 'One of the selected staff is no longer on record.';
    return { v, errors };
  }

  // Create (no id) or edit. A rename moves children, today's register and the waitlist in the same commit.
  function saveClass(user, input, classId = null) {
    if (!canManageClasses(user)) return settle({ ok: false, reason: 'forbidden' });
    const list = getClassRegistry();
    const before = classId ? list.find(c => c.id === classId && c.status === 'active') : null;
    if (classId && !before) return settle({ ok: false, reason: 'missing' });
    const { v, errors } = validateClass(input, list, classId);
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const enrolled = before ? enrolledIn(before.name).length : 0;
    // Lowering capacity below enrolment needs an explicit confirmation; nobody is moved or removed.
    if (before && v.capacity < enrolled && !input.confirmOverCapacity) return settle({ ok: false, reason: 'over-capacity', enrolled, capacity: v.capacity });

    const now = new Date().toISOString();
    const writes = [];
    let cls;
    if (before) {
      const oldName = before.name;
      Object.assign(before, v, { updatedAt: now });
      cls = before;
      if (oldName !== v.name) {
        const children = getChildren();
        children.forEach(c => { if (c.cls === oldName) { c.cls = v.name; c.history = [...c.history, stamp(user, 'edited', `Class renamed from ${oldName} to ${v.name}`)]; } });
        writes.push({ key: childrenKey(school.id), value: children });
        const reg = getRegister();
        if (reg[oldName]) { reg[v.name] = reg[oldName]; delete reg[oldName]; writes.push({ key: registerKey(school.id, today()), value: reg }); }
        const wl = getWaitlist();
        if (wl.some(w => w.cls === oldName)) { wl.forEach(w => { if (w.cls === oldName) w.cls = v.name; }); writes.push({ key: waitlistKey(school.id), value: wl }); }
      }
    } else {
      cls = { id: newId('cl'), ...v, status: 'active', createdAt: now, updatedAt: now, archivedAt: null };
      list.push(cls);
    }
    writes.unshift({ key: classRegistryKey(school.id), value: list });
    if (!commit(writes)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, classId ? 'edit:class' : 'add:class', cls.id, cls.name);
    return settle({ ok: true, cls });
  }

  // Archive: only with no active or starting-soon children, checked here at the moment of archiving.
  function archiveClass(user, classId) {
    if (!canManageClasses(user)) return settle({ ok: false, reason: 'forbidden' });
    const list = getClassRegistry();
    const c = list.find(x => x.id === classId);
    if (!c) return settle({ ok: false, reason: 'missing' });
    if (c.status === 'archived') return settle({ ok: false, reason: 'archived' });
    const kids = enrolledIn(c.name);
    if (kids.length) return settle({ ok: false, reason: 'has-children', count: kids.length, cls: c.name });
    Object.assign(c, { status: 'archived', archivedAt: new Date().toISOString(), archivedBy: user.name });
    if (!write(classRegistryKey(school.id), list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'archive:class', c.id, c.name);
    return settle({ ok: true, cls: c });
  }

  /* ---------------------------------------------------------------- S17 class detail: shifts, cover, routine, transfers
     Shifts `nexora-staff-shifts:<school>` { [educatorId]: { start, end, days } } — demo roster configuration.
     A relief educator's shift is the hours they're available to cover.
     Cover `nexora-substitutes:<school>` [{ id, classId, date, replacingId, substituteId, start, end,
       status: 'active'|'cancelled', createdAt, createdBy, cancelledAt?, cancelledBy? }] — never deleted.
     Routines `nexora-class-routines:<school>` { [classId]: { days, blocks: [{ start, end, title, description, location }] } }.
     All rules are checked here at save time; production needs the same checks on the server. */

  const shiftsKey = id => `nexora-staff-shifts:${id}`;
  const subsKey = id => `nexora-substitutes:${id}`;
  const routinesKey = id => `nexora-class-routines:${id}`;
  const SCHOOL_WEEK = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const SEED_SHIFTS = {
    'ed-lakshmi': ['08:30', '15:30'], 'ed-deepa': ['08:30', '13:00'], 'ed-arjun': ['08:30', '15:30'], 'ed-kavitha': ['08:30', '15:30'],
    'ed-sunita': ['08:30', '15:30'], 'ed-priya': ['08:00', '15:00'], 'ed-anjali': ['12:00', '17:00'], 'ed-revathi': ['08:00', '17:00'], 'ed-joseph': ['08:30', '13:30']
  };
  function getStaffShifts() {
    const saved = seeded(shiftsKey(school.id), () => Object.fromEntries(Object.entries(SEED_SHIFTS).map(([id, [start, end]]) => [id, { start, end, days: SCHOOL_WEEK }])));
    // Educators added after the shifts were first saved (the relief staff) join with their demo shift.
    educators.forEach(e => { if (!saved[e.id] && SEED_SHIFTS[e.id]) saved[e.id] = { start: SEED_SHIFTS[e.id][0], end: SEED_SHIFTS[e.id][1], days: SCHOOL_WEEK }; });
    return saved;
  }
  const weekdayOf = date => WEEKDAYS[(new Date(`${date}T00:00:00`).getDay() + 6) % 7];
  const shiftOf = (staffId, date) => { const s = getStaffShifts()[staffId]; return s && s.days.includes(weekdayOf(date)) ? { start: s.start, end: s.end } : null; };
  const toMinutes = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  const overlaps = (a, b) => toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
  const staffRoleIn = (cls, staffId) => (cls.staffIds[0] === staffId ? 'Lead teacher' : 'Assistant');

  const getSubstitutes = () => read(subsKey(school.id), []);
  const substitutesOn = date => getSubstitutes().filter(s => s.status === 'active' && s.date === date);

  // Who can cover `replacingId` in a class on a date. Available = working hours span the shift, not away
  // that day, and not committed to their own class or another cover during it. Returns every educator
  // outside the class with eligible + reason, so the UI can list the eligible ones and explain the rest.
  function substituteOptions(classId, date, replacingId) {
    const cls = classById(classId);
    const window = cls && replacingId ? shiftOf(replacingId, date) : null;
    if (!cls || !window) return { window: null, options: [] };
    const att = date === today() ? getStaffAttendance() : {};
    const covers = substitutesOn(date);
    const options = educators.filter(e => e.id !== replacingId && !cls.staffIds.includes(e.id)).map(e => {
      const base = { id: e.id, name: e.name, relief: Boolean(e.relief), shift: shiftOf(e.id, date) };
      const no = reason => ({ ...base, eligible: false, reason });
      if (att[e.id] === 'absent') return no('Away today');
      if (covers.some(s => s.replacingId === e.id)) return no('Being covered that day');
      if (!base.shift) return no('Not working that day');
      const home = activeClasses().find(c => c.staffIds.includes(e.id));
      if (home) return no(`Teaching ${home.name} ${base.shift.start}–${base.shift.end}`);
      if (toMinutes(base.shift.start) > toMinutes(window.start) || toMinutes(base.shift.end) < toMinutes(window.end)) return no(`Works ${base.shift.start}–${base.shift.end} only`);
      const clash = covers.find(s => s.substituteId === e.id && overlaps(s, window));
      if (clash) return no(`Already covering ${classById(clash.classId)?.name || 'another class'}`);
      return { ...base, eligible: true, reason: date === today() && !att[e.id] ? 'Not signed in yet today' : '' };
    });
    return { window, options };
  }

  function assignSubstitute(user, input) {
    if (!canManageClasses(user)) return settle({ ok: false, reason: 'forbidden' });
    const cls = classById(input.classId);
    if (!cls || cls.status !== 'active') return settle({ ok: false, reason: 'missing' });
    const date = clean(input.date);
    const errors = {};
    if (!isDate(date)) errors.date = 'Choose the date of the cover.';
    else if (date < today()) errors.date = 'Cover can’t be arranged for a past date.';
    else if (date > daysFromToday(60)) errors.date = 'Choose a date within the next 60 days.';
    else if (!schoolDays().includes(weekdayOf(date))) errors.date = 'The school is closed that day.';
    if (!cls.staffIds.includes(input.replacingId)) errors.replacingId = 'Choose someone assigned to this class.';
    else if (!errors.date && !shiftOf(input.replacingId, date)) errors.replacingId = 'They aren’t rostered on that day, so there’s nothing to cover.';
    else if (!errors.date) {
      const existing = substitutesOn(date).find(s => s.classId === cls.id && s.replacingId === input.replacingId);
      if (existing) errors.replacingId = `Already covered by ${educators.find(e => e.id === existing.substituteId)?.name || 'someone'} that day.`;
    }
    if (!input.substituteId) errors.substituteId = 'Choose who will cover.';
    else if (!Object.keys(errors).length) {
      const pick = substituteOptions(cls.id, date, input.replacingId).options.find(o => o.id === input.substituteId);
      if (!pick) errors.substituteId = 'Choose someone from the list.';
      else if (!pick.eligible) errors.substituteId = `${pick.name} isn’t available: ${pick.reason}.`;
    }
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const shift = shiftOf(input.replacingId, date);
    const sub = { id: newId('sub'), classId: cls.id, date, replacingId: input.replacingId, substituteId: input.substituteId, start: shift.start, end: shift.end, status: 'active', createdAt: new Date().toISOString(), createdBy: user.name };
    if (!write(subsKey(school.id), [...getSubstitutes(), sub])) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'assign:substitute', cls.id, `${cls.name} ${date}`);
    if (date === today()) events.ratio(cls.name);
    return settle({ ok: true, substitute: sub });
  }

  function cancelSubstitute(user, subId) {
    if (!canManageClasses(user)) return settle({ ok: false, reason: 'forbidden' });
    const list = getSubstitutes();
    const s = list.find(x => x.id === subId);
    if (!s || s.status !== 'active') return settle({ ok: false, reason: 'missing' });
    Object.assign(s, { status: 'cancelled', cancelledAt: new Date().toISOString(), cancelledBy: user.name });
    if (!write(subsKey(school.id), list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'cancel:substitute', s.classId, s.date);
    if (s.date === today()) { const c = classById(s.classId); if (c) events.ratio(c.name); }
    return settle({ ok: true });
  }

  const ROUTINE_SEED = {
    base: [['08:30', '09:00', 'Arrival & greeting', 'Families hand over at the door; children hang bags and choose a first work.', ''], ['09:00', '11:30', 'Montessori work cycle', 'Uninterrupted three-hour work period with individual presentations.', ''], ['11:30', '12:00', 'Outdoor play', 'Garden, sandpit and gross-motor work.', 'Garden'], ['12:00', '12:45', 'Lunch', 'Children set the table and serve themselves.', ''], ['12:45', '14:30', 'Afternoon work & stories', 'Quiet work, read-aloud and group songs.', ''], ['14:30', '15:00', 'Snack & departure', 'Snack, tidy-up and collection by authorised adults.', '']],
    Nursery: [['08:00', '08:45', 'Arrival & settling in', 'Gentle handover; a familiar adult greets each child.', ''], ['08:45', '10:15', 'Montessori work cycle', 'Short work cycle with practical life and sensorial materials.', ''], ['10:15', '10:30', 'Snack', 'Fruit and milk at the snack table.', ''], ['10:30', '11:15', 'Outdoor play', '', 'Garden'], ['11:15', '12:00', 'Lunch', '', ''], ['12:00', '13:30', 'Nap / rest', 'Children rest on their own mats; sleep times go in the diary.', 'Rest corner'], ['13:30', '14:30', 'Afternoon activities', 'Music, movement and stories.', ''], ['14:30', '15:00', 'Departure', 'Collection by authorised adults only.', '']]
  };
  function getRoutines() {
    return seeded(routinesKey(school.id), () => {
      const out = {};
      getClassRegistry().filter(c => /^cl-\d+$/.test(c.id)).forEach(c => {
        out[c.id] = { days: SCHOOL_WEEK, blocks: (ROUTINE_SEED[c.level] || ROUTINE_SEED.base).map(([start, end, title, description, location]) => ({ start, end, title, description, location })) };
      });
      return out;
    });
  }
  // { configured, schoolDay, blocks (sorted by start) } for one class on one date.
  function classRoutine(classId, date = today()) {
    const r = routineFor(classId);
    if (!r || !r.blocks?.length) return { configured: false, schoolDay: schoolDays().includes(weekdayOf(date)), blocks: [] };
    const wd = weekdayOf(date);
    // A block with its own weekdays runs only on those days; others follow the routine's days.
    const blocks = r.blocks.filter(b => (b.days?.length ? b.days : r.days).includes(wd));
    return { configured: true, schoolDay: blocks.length > 0, blocks: blocks.sort((a, b) => toMinutes(a.start) - toMinutes(b.start)) };
  }

  // Seats left = capacity − enrolled (active + starting soon) − moves already scheduled into the class. null = capacity not set.
  function seatsLeft(name) {
    const c = classByName(name);
    if (!c || !Number.isInteger(c.capacity) || c.capacity <= 0) return null;
    const incoming = getChildren().filter(k => k.pendingMove?.cls === name && ['active', 'starting'].includes(k.status)).length;
    return c.capacity - enrolledIn(name).length - incoming;
  }

  // Move one child from their class to another, today or from a future date (applied when that date arrives).
  // The record is kept (same ID); attendance, diary and learning stay where they are; history records the move.
  function transferChild(user, childId, target, date) {
    if (!canManageChildren(user)) return settle({ ok: false, reason: 'forbidden' });
    const list = getChildren();
    const c = list.find(x => x.id === childId);
    if (!c || !classScope(user).includes(c.cls)) return settle({ ok: false, reason: 'missing' });
    if (!['active', 'starting'].includes(c.status)) return settle({ ok: false, reason: 'closed' });
    const errors = {};
    const to = classByName(target);
    if (!to || to.status !== 'active') errors.target = 'Choose a class to move to.';
    else if (to.name === c.cls) errors.target = `${childName(c)} is already in ${c.cls}.`;
    else if (c.pendingMove) errors.target = `A move to ${c.pendingMove.cls} on ${c.pendingMove.date} is already scheduled.`;
    if (!isDate(clean(date))) errors.date = 'Choose the date the move takes effect.';
    else if (date < today()) errors.date = 'The move can’t take effect in the past.';
    else if (date > daysFromToday(365)) errors.date = 'Choose a date within the next year.';
    if (!errors.target) {
      const seats = seatsLeft(to.name);
      if (seats !== null && seats <= 0) return settle({ ok: false, reason: 'full', errors: { target: `${to.name} is full (${to.capacity} places). Choose another class or add the child to the waitlist.` } });
    }
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const from = c.cls;
    if (date === today()) applyMove(user, c, to.name);
    else {
      c.pendingMove = { cls: to.name, date, by: user.name, at: new Date().toISOString() };
      c.history = [...c.history, stamp(user, 'move-scheduled', `Move from ${from} to ${to.name} scheduled for ${date}`)];
    }
    if (!saveChildren(list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'move:child', c.id, `${from} → ${to.name} (${date})`);
    return settle({ ok: true, child: c, from, to: to.name, date, immediate: date === today() });
  }

  /* Admissions pipeline (admissions.js at ?page=admissions; S07 applicant details at ?page=admissions&applicant=<id>)
     The existing `nexora-admission-enquiries:<school>` records, extended — one per prospective child:
       { id, child, dob, parent, phone, phoneNorm, email, emailNorm, programme (class level), preferredStart, source, notes,
         ownerId, stage: enquiry|tour|applied|offer|enrolled|lost, stageAt, tourAt, followUp, lost: { reason, detail, at, by },
         familyId, childId, createdAt, createdBy, createdById, updatedAt, clientId,
         history: [{ id, at, by, byId, type, from, to, detail }] (append-only), status (legacy mirror for older readers) }
     Older records (status new/contacted/visit/enrolled/closed) are migrated once. Enrolled is only ever set by
     completeEnquiryEnrolment(), which S14 calls after it has saved the child — opening S14 doesn't change the stage.
     Every check runs in this store; a server would also need to enforce duplicates and stage changes atomically. */
  const ENQUIRY_STATUSES = { new: 'New', contacted: 'Contacted', visit: 'Visit booked', enrolled: 'Enrolled', closed: 'Closed' };
  const ENQUIRY_STAGES = { enquiry: 'Enquiry', tour: 'Tour booked', applied: 'Applied', offer: 'Offer sent', enrolled: 'Enrolled', lost: 'Lost' };
  const ENQUIRY_SOURCES = { website: 'Website', walkin: 'Walk-in', referral: 'Referral', social: 'Social', event: 'Event', other: 'Other' };
  const LOST_REASONS = { other_school: 'Chose another school', fees: 'Fees', location: 'Location', no_response: 'No response', other: 'Other' };
  const STAGE_STATUS = { enquiry: 'new', tour: 'visit', applied: 'contacted', offer: 'contacted', enrolled: 'enrolled', lost: 'closed' };
  const admissionsKey = id => `nexora-admission-enquiries:${id}`;
  const normPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d.length > 10 ? d.slice(-10) : d; };
  const normEmail = e => String(e || '').trim().toLowerCase();
  const sameName = (a, b) => String(a || '').trim().toLowerCase().replace(/\s+/g, ' ') === String(b || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const userIdByName = n => users.find(u => u.name === n)?.id || '';
  const admissionsOwners = () => users.filter(u => u.schoolId === school.id && canAccess(u, 'admissions')).map(u => ({ id: u.id, name: u.name, role: u.role }));
  const histEvent = (user, type, extra = {}) => ({ id: newId('eh'), at: new Date().toISOString(), by: user?.name || 'System', byId: user?.id || '', type, ...extra });

  function seedEnquiries() {
    const own = { 'Ms. Fernandes': 'u-admin', 'Mrs. Rao': 'u-director' };
    const mk = (id, child, dobAgo, parent, phone, email, programme, stage, createdDays, stageDays, extra = {}) => {
      const createdAt = atToday(10, 0, -createdDays);
      const by = extra.by || 'Ms. Fernandes';
      const startIn = extra.startIn ?? 60;
      const dob = new Date(); dob.setMonth(dob.getMonth() - dobAgo);
      const history = [{ id: `${id}-h1`, at: createdAt, by, byId: own[by], type: 'created', to: 'enquiry', detail: 'Enquiry created' }];
      if (stage !== 'enquiry') history.push({ id: `${id}-h2`, at: atToday(11, 0, -stageDays), by, byId: own[by], type: 'stage', from: 'enquiry', to: stage, detail: extra.lostReason ? `Reason: ${LOST_REASONS[extra.lostReason]}` : '' });
      return { id, child, dob: isoDay(dob), parent, phone, email, programme, preferredStart: daysFromToday(startIn), source: extra.source || 'website', notes: extra.notes || '', ownerId: own[by], stage, stageAt: stage === 'enquiry' ? createdAt : atToday(11, 0, -stageDays), tourAt: extra.tourAt || null, followUp: extra.followUp ?? '', lost: extra.lostReason ? { reason: extra.lostReason, detail: '', at: atToday(11, 0, -stageDays), by } : null, familyId: null, childId: null, createdAt, createdBy: by, createdById: own[by], updatedAt: createdAt, history, demo: true };
    };
    const list = [
      mk('ae1', 'Advika Nair', 30, 'Lakshmi Nair', '+91 98450 10101', 'lakshmi.nair@example.com', 'Nursery', 'enquiry', 1, 1, { followUp: daysFromToday(0), notes: 'Asked about the June start.' }),
      mk('ae2', 'Rehan Kapoor', 44, 'Sonal Kapoor', '+91 98450 20202', 'sonal.k@example.com', 'LKG', 'enquiry', 9, 9, { by: 'Mrs. Rao', followUp: daysFromToday(-1), notes: 'Wants a call back about transport.', source: 'referral' }),
      mk('ae3', 'Mira Thomas', 36, 'Anil Thomas', '+91 98450 30303', '', 'Montessori', 'tour', 6, 3, { followUp: daysFromToday(2), notes: 'School visit booked.', tourAt: `${daysFromToday(2)}T10:30`, source: 'walkin' }),
      mk('ae4', 'Aditi Rao', 52, 'Kiran Rao', '+91 98450 40404', 'kiran.rao@example.com', 'UKG', 'applied', 16, 15, { followUp: daysFromToday(1), source: 'social', startIn: 45 }),
      mk('ae5', 'Sameer Khan', 30, 'Farah Khan', '+91 98450 50505', '', 'Nursery', 'offer', 20, 8, { by: 'Mrs. Rao', notes: 'Offer for next term.', startIn: 50, source: 'event' }),
      mk('ae6', 'Zoya Ali', 46, 'Imran Ali', '+91 98450 60606', '', 'LKG', 'lost', 25, 20, { by: 'Mrs. Rao', notes: 'Moved city.', lostReason: 'location' }),
      mk('ae7', 'Kabir Menon', 40, 'Divya Menon', '+91 98450 70707', 'divya.m@example.com', 'LKG', 'enrolled', 120, 90, { source: 'referral', startIn: -60 }),
      mk('ae8', 'Ira Joshi', 34, 'Neha Joshi', '+91 98450 80808', '', 'Nursery', 'lost', 95, 80, { lostReason: 'fees' }),
      mk('ae9', 'Vihaan Shetty', 50, 'Rahul Shetty', '+91 98450 90909', 'rahul.s@example.com', 'UKG', 'enrolled', 70, 50, { by: 'Mrs. Rao', source: 'website', startIn: -20 }),
      mk('ae10', 'Anvi Gupta', 28, 'Pooja Gupta', '+91 98451 01010', '', 'Toddler', 'lost', 60, 40, { lostReason: 'no_response', source: 'social' }),
      mk('ae11', 'Arjun Pillai', 38, 'Meera Pillai', '+91 98451 11111', 'meera.p@example.com', 'Montessori', 'lost', 45, 35, { lostReason: 'other_school' })
    ];
    const task = (e, title, due, time, by) => { const t = { id: `${e.id}-t${(e.tasks || []).length + 1}`, title, due, time, assigneeId: e.ownerId, status: 'open', createdAt: e.createdAt, createdBy: by, createdById: e.ownerId, doneAt: null, doneBy: null }; e.tasks = [...(e.tasks || []), t]; e.history.push({ id: `${t.id}-h`, at: e.createdAt, by, byId: e.ownerId, type: 'task', action: 'created', taskId: t.id, detail: `Follow-up created: ${title} — due ${dLabel(due)}${time ? ` ${time}` : ''}` }); };
    task(list[2], 'Confirm tour time with Anil', daysFromToday(1), '11:00', 'Ms. Fernandes');
    task(list[1], 'Send transport route details', daysFromToday(-2), '', 'Mrs. Rao');
    list.forEach(e => e.history.sort((x, y) => x.at.localeCompare(y.at)));
    return list;
  }
  // Older records (status-based) become pipeline records once; their history starts with what was known.
  function migrateEnquiry(e) {
    if (e.stage) return e;
    const stage = { new: 'enquiry', contacted: 'enquiry', visit: 'tour', enrolled: 'enrolled', closed: 'lost' }[e.status] || 'enquiry';
    const byId = userIdByName(e.createdBy);
    return { ...e, dob: e.dob || '', preferredStart: e.preferredStart || '', source: e.source || 'other', ownerId: e.assignedTo || byId, stage, stageAt: e.createdAt, tourAt: null, lost: stage === 'lost' ? { reason: 'other', detail: e.notes || 'Closed before the pipeline', at: e.createdAt, by: e.createdBy } : null, familyId: null, childId: null, createdById: byId, updatedAt: e.createdAt,
      history: [{ id: `${e.id}-h0`, at: e.createdAt, by: e.createdBy, byId, type: 'created', to: stage, detail: `Enquiry created${stage !== 'enquiry' ? ` (imported as ${ENQUIRY_STAGES[stage]})` : ''}` }] };
  }
  function getAdmissionEnquiries(schoolId = school.id) {
    const list = seeded(admissionsKey(schoolId), seedEnquiries);
    let changed = false;
    const out = list.map(e => {
      let x = e;
      if (!x.stage) { x = migrateEnquiry(x); changed = true; }
      if (x.phoneNorm === undefined || x.status !== STAGE_STATUS[x.stage]) { x = { ...x, phoneNorm: normPhone(x.phone), emailNorm: normEmail(x.email), status: STAGE_STATUS[x.stage] }; changed = true; }
      return x;
    });
    if (changed) { try { localStorage.setItem(admissionsKey(schoolId), JSON.stringify(out)); } catch { /* in memory */ } }
    return out;
  }
  const saveEnquiries = list => write(admissionsKey(school.id), list);
  const isOpenEnquiry = e => !['enrolled', 'lost'].includes(e.stage || STAGE_STATUS[e.status]);
  const followUpDue = e => isOpenEnquiry(e) && Boolean(nextFollowUp(e)) && nextFollowUp(e) <= today();
  // Age at a date (default today), as { years, months }; null when the birth date is missing or after the date.
  function ageAt(dob, at) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob || '') || !/^\d{4}-\d{2}-\d{2}$/.test(at || '')) return null;
    const b = new Date(`${dob}T12:00:00`);
    const a = new Date(`${at}T12:00:00`);
    if (Number.isNaN(b.getTime()) || Number.isNaN(a.getTime()) || b > a) return null;
    let m = (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
    if (a.getDate() < b.getDate()) m -= 1;
    return { years: Math.floor(m / 12), months: m % 12 };
  }
  const daysInStage = (e, now = Date.now()) => Math.max(0, Math.floor((now - new Date(e.stageAt || e.createdAt).getTime()) / 864e5));

  // Possible duplicates by normalised phone / email: other enquiries and existing family guardians.
  function enquiryDuplicates(input, excludeId = null) {
    const p = normPhone(input.phone);
    const m = normEmail(input.email);
    const hit = (ph, em) => (p.length >= 7 && normPhone(ph) === p) || (m && normEmail(em) === m);
    const enquiries = getAdmissionEnquiries().filter(e => e.id !== excludeId && hit(e.phone, e.email)).map(e => ({ id: e.id, child: e.child, parent: e.parent, stage: e.stage, sameChild: sameName(e.child, input.child) }));
    const families = listFamilies().filter(f => f.guardians.some(g => hit(g.phone, g.email))).map(f => ({ id: f.id, name: f.name, children: f.children.map(c => c.name), sameChild: f.children.some(c => sameName(c.name, input.child)) }));
    return { enquiries, families };
  }
  function enquiryValues(input, { editing = null } = {}) {
    const errors = {};
    const v = {
      child: clean(input.child).replace(/\s+/g, ' ').slice(0, 80), parent: clean(input.parent).replace(/\s+/g, ' ').slice(0, 80),
      phone: clean(input.phone).replace(/\s+/g, ' ').slice(0, 24), email: clean(input.email).toLowerCase().slice(0, 120),
      dob: clean(input.dob), programme: clean(input.programme), preferredStart: clean(input.preferredStart),
      source: ENQUIRY_SOURCES[input.source] ? input.source : 'other', notes: String(input.notes || '').trim().slice(0, 1000),
      ownerId: clean(input.ownerId), followUp: clean(input.followUp),
      contactMethod: CONTACT_METHODS[input.contactMethod] ? input.contactMethod : '', language: clean(input.language).slice(0, 60), address: String(input.address || '').trim().slice(0, 300),
      previousSchool: clean(input.previousSchool).slice(0, 120), childNotes: String(input.childNotes || '').trim().slice(0, 1000)
    };
    if (!v.parent) errors.parent = 'Enter the parent or guardian’s name.';
    if (!v.child) errors.child = 'Enter the child’s name.';
    const digits = v.phone.replace(/\D/g, '');
    if (!v.phone) errors.phone = 'Enter a phone number.';
    else if (!/^\+?[\d\s().-]+$/.test(v.phone) || digits.length < 7 || digits.length > 15) errors.phone = 'Enter a phone number using digits (7 to 15), with an optional + and spaces.';
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) errors.email = 'Enter an email address like name@example.com, or leave it empty.';
    if (!CLASS_LEVELS.includes(v.programme)) errors.programme = 'Choose a programme.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.preferredStart) || Number.isNaN(new Date(`${v.preferredStart}T12:00:00`).getTime())) errors.preferredStart = 'Choose the preferred start date.';
    else if (v.preferredStart < today() && !(editing && editing.preferredStart === v.preferredStart)) errors.preferredStart = 'The preferred start can’t be in the past.';
    else if (v.preferredStart > daysFromToday(730)) errors.preferredStart = 'Choose a start within the next two years.';
    if (v.dob) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.dob) || Number.isNaN(new Date(`${v.dob}T12:00:00`).getTime())) errors.dob = 'Enter a valid date of birth.';
      else if (v.dob > today()) errors.dob = 'The date of birth can’t be in the future.';
      else if (v.dob < daysFromToday(-365 * 10)) errors.dob = 'Check the date of birth — that’s more than 10 years ago.';
    }
    if (v.followUp && (!/^\d{4}-\d{2}-\d{2}$/.test(v.followUp) || Number.isNaN(new Date(`${v.followUp}T12:00:00`).getTime()))) errors.followUp = 'Enter a valid follow-up date.';
    const owners = admissionsOwners();
    if (v.ownerId && !owners.some(o => o.id === v.ownerId)) errors.ownerId = 'Choose someone on the admissions team.';
    return { v, errors };
  }

  // Duplicate rules: the same child (name) at the same contact is always blocked — open the existing record instead.
  // A different child at a known contact (a sibling) needs explicit confirmation; it's then linked to that family.
  function createEnquiry(user, input = {}, { confirmSibling = false, clientId = '' } = {}) {
    if (!can(user, 'admissions')) return settle({ ok: false, reason: 'forbidden' });
    const list = getAdmissionEnquiries();
    if (clientId) { const again = list.find(e => e.clientId === clientId); if (again) return settle({ ok: true, enquiry: again, repeated: true }); }
    const { v, errors } = enquiryValues(input);
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const dup = enquiryDuplicates(v);
    const blocking = dup.enquiries.find(e => e.sameChild) || dup.families.find(f => f.sameChild);
    if (blocking) return settle({ ok: false, reason: 'duplicate', blocking: true, duplicates: dup });
    if ((dup.enquiries.length || dup.families.length) && !confirmSibling) return settle({ ok: false, reason: 'duplicate', blocking: false, duplicates: dup });
    const now = new Date().toISOString();
    const ownerId = v.ownerId || (admissionsOwners().some(o => o.id === user.id) ? user.id : admissionsOwners()[0]?.id || '');
    const e = { id: newId('ae'), ...v, ownerId, phoneNorm: normPhone(v.phone), emailNorm: normEmail(v.email), stage: 'enquiry', status: 'new', stageAt: now, tourAt: null, lost: null, familyId: dup.families[0]?.id || null, childId: null, createdAt: now, createdBy: user.name, createdById: user.id, updatedAt: now, clientId: clientId || newId('cl'),
      history: [histEvent(user, 'created', { to: 'enquiry', detail: `Enquiry created · source: ${ENQUIRY_SOURCES[v.source]}${dup.families[0] ? ` · linked to the ${dup.families[0].name}` : dup.enquiries[0] ? ` · sibling of ${dup.enquiries[0].child}` : ''}` })] };
    if (ownerId) e.history.push(histEvent(user, 'owner', { detail: `Owner assigned: ${users.find(u => u.id === ownerId)?.name || 'Admissions team'}` }));
    if (v.followUp) e.history.push(histEvent(user, 'followup', { detail: `Follow-up set for ${dLabel(v.followUp)}` }));
    if (!saveEnquiries([e, ...list])) return settle({ ok: false, reason: 'storage' });
    if (ownerId) notifyUsers({ module: 'admissions', kind: 'enquiry', title: `New enquiry: ${e.child} — ${e.programme}`, body: `${e.parent} · ${ENQUIRY_SOURCES[e.source]} · ref ${e.id}`, recordType: 'enquiry', recordId: e.id, dedupeKey: `enquiry:${e.id}`, actorId: user.id }, { toUserIds: [ownerId] });
    logAudit(user, 'create:enquiry', '', `${e.child} (${e.programme})`);
    return settle({ ok: true, enquiry: e });
  }
  function updateEnquiry(user, id, input = {}) {
    if (!can(user, 'admissions')) return settle({ ok: false, reason: 'forbidden' });
    const list = getAdmissionEnquiries();
    const e = list.find(x => x.id === id);
    if (!e) return settle({ ok: false, reason: 'missing' });
    if (input.updatedAt && input.updatedAt !== e.updatedAt) return settle({ ok: false, reason: 'stale' });
    const { v, errors } = enquiryValues({ ...e, ...input }, { editing: e });
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const dup = enquiryDuplicates(v, id);
    const blocking = dup.enquiries.find(x => x.sameChild && x.stage !== 'lost');
    if (blocking) return settle({ ok: false, reason: 'duplicate', blocking: true, duplicates: { enquiries: [blocking], families: [] } });
    const events_ = [];
    if (v.ownerId !== e.ownerId) events_.push(histEvent(user, 'owner', { detail: `Owner changed: ${users.find(u => u.id === v.ownerId)?.name || 'Unassigned'}` }));
    if (v.followUp !== (e.followUp || '')) events_.push(histEvent(user, 'followup', { detail: v.followUp ? `Follow-up set for ${dLabel(v.followUp)}` : 'Follow-up cleared' }));
    if (v.preferredStart !== e.preferredStart) events_.push(histEvent(user, 'edit', { detail: `Preferred start changed: ${e.preferredStart || '—'} → ${v.preferredStart}` }));
    const other = ['child', 'parent', 'phone', 'email', 'dob', 'programme', 'source', 'notes', 'contactMethod', 'language', 'address', 'previousSchool', 'childNotes'].filter(k => (v[k] || '') !== (e[k] || ''));
    if (other.length) events_.push(histEvent(user, 'edit', { detail: `Details updated: ${other.join(', ')}` }));
    if (!events_.length) return settle({ ok: true, enquiry: e, unchanged: true });
    Object.assign(e, v, { phoneNorm: normPhone(v.phone), emailNorm: normEmail(v.email), updatedAt: new Date().toISOString() });
    e.history = [...e.history, ...events_];
    if (!saveEnquiries(list)) return settle({ ok: false, reason: 'storage' });
    if (v.ownerId && events_.some(x => x.type === 'owner') && v.ownerId !== user.id) notifyUsers({ module: 'admissions', kind: 'mention', title: `${user.name} assigned you an enquiry`, body: `${e.child} — ${e.programme}`, recordType: 'enquiry', recordId: e.id, mentions: [v.ownerId], dedupeKey: `assign:${e.id}:${v.ownerId}:${e.updatedAt}`, actorId: user.id }, { toUserIds: [v.ownerId] });
    return settle({ ok: true, enquiry: e });
  }
  function setEnquiryFollowUp(user, id, date) {
    if (!can(user, 'admissions')) return settle({ ok: false, reason: 'forbidden' });
    const list = getAdmissionEnquiries();
    const e = list.find(x => x.id === id);
    if (!e) return settle({ ok: false, reason: 'missing' });
    const d = clean(date);
    if (d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(new Date(`${d}T12:00:00`).getTime()))) return settle({ ok: false, reason: 'invalid', errors: { followUp: 'Enter a valid follow-up date.' } });
    if (d === (e.followUp || '')) return settle({ ok: true, enquiry: e, unchanged: true });
    e.followUp = d;
    e.updatedAt = new Date().toISOString();
    e.history = [...e.history, histEvent(user, 'followup', { detail: d ? `Follow-up set for ${dLabel(d)}` : 'Follow-up cleared' })];
    return settle(saveEnquiries(list) ? { ok: true, enquiry: e } : { ok: false, reason: 'storage' });
  }
  // Moves between pipeline stages. Lost needs a reason; Enrolled only comes from S14 (completeEnquiryEnrolment).
  // `from` is the stage the person saw — if the record has moved since, nothing is overwritten.
  let movingEnquiry = '';
  function moveEnquiry(user, id, to, { from = null, reason = '', detail = '', tourAt = null } = {}) {
    if (!can(user, 'admissions')) return settle({ ok: false, reason: 'forbidden' });
    if (!ENQUIRY_STAGES[to]) return settle({ ok: false, reason: 'invalid' });
    if (to === 'enrolled') return settle({ ok: false, reason: 'enrol-via-s14' });
    if (to === 'offer') return settle({ ok: false, reason: 'offer-via-send' });
    if (movingEnquiry === id) return settle({ ok: false, reason: 'busy' });
    const list = getAdmissionEnquiries();
    const e = list.find(x => x.id === id);
    if (!e) return settle({ ok: false, reason: 'missing' });
    if (from && e.stage !== from) return settle({ ok: false, reason: 'stale', stage: e.stage });
    if (e.stage === to) return settle({ ok: true, enquiry: e, unchanged: true });
    if (e.stage === 'enrolled') return settle({ ok: false, reason: 'locked' });
    const errors = {};
    if (to === 'lost') {
      if (!LOST_REASONS[reason]) errors.reason = 'Choose a reason.';
      else if (reason === 'other' && !clean(detail)) errors.detail = 'Say why the enquiry was lost.';
    }
    if (to === 'tour' && tourAt && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(tourAt) || Number.isNaN(new Date(tourAt).getTime()))) errors.tourAt = 'Enter a valid tour date and time.';
    else if (to === 'tour' && tourAt && new Date(tourAt).getTime() < Date.now()) errors.tourAt = 'The tour can’t be in the past.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    movingEnquiry = id;
    const now = new Date().toISOString();
    const prev = e.stage;
    Object.assign(e, { stage: to, status: STAGE_STATUS[to], stageAt: now, updatedAt: now });
    if (to === 'lost') e.lost = { reason, detail: clean(detail).slice(0, 300), at: now, by: user.name };
    if (to === 'tour') e.tourAt = tourAt || null;
    e.history = [...e.history, histEvent(user, to === 'lost' ? 'lost' : 'stage', { from: prev, to, detail: to === 'lost' ? `Reason: ${LOST_REASONS[reason]}${clean(detail) ? ` — ${clean(detail)}` : ''}` : to === 'tour' && tourAt ? `Tour on ${tourAt.replace('T', ' ')}` : prev === 'lost' ? 'Reopened' : '' })];
    const ok = saveEnquiries(list);
    movingEnquiry = '';
    if (!ok) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'stage:enquiry', '', `${e.child}: ${ENQUIRY_STAGES[prev]} → ${ENQUIRY_STAGES[to]}`);
    return settle({ ok: true, enquiry: e, from: prev });
  }
  // What S14 needs before it can start; records that enrolment was started (once a day) without changing the stage.
  function startEnquiryEnrolment(user, id) {
    if (!can(user, 'admissions') || !canManageChildren(user)) return settle({ ok: false, reason: 'forbidden' });
    const list = getAdmissionEnquiries();
    const e = list.find(x => x.id === id);
    if (!e) return settle({ ok: false, reason: 'missing' });
    if (e.stage === 'enrolled') return settle({ ok: false, reason: 'locked' });
    const errors = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.dob || '')) errors.dob = 'Add the child’s date of birth first — enrolment needs it.';
    if (e.child.trim().split(/\s+/).length < 2) errors.child = 'Add the child’s last name first — enrolment needs a first and last name.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const last = e.history[e.history.length - 1];
    if (!(last?.type === 'enrol-started' && last.at.slice(0, 10) === new Date().toISOString().slice(0, 10))) {
      e.history = [...e.history, histEvent(user, 'enrol-started', { detail: 'Enrolment started in S14 (not enrolled yet)' })];
      e.updatedAt = new Date().toISOString();
      if (!saveEnquiries(list)) return settle({ ok: false, reason: 'storage' });
    }
    return settle({ ok: true, enquiry: e });
  }
  // Prefill for the S14 wizard: names split into first/last, the guardian contact, class level → an active class.
  function enquiryPrefill(user, id) {
    if (!can(user, 'admissions')) return null;
    const e = getAdmissionEnquiries().find(x => x.id === id);
    if (!e || e.stage === 'enrolled') return null;
    const parts = e.child.trim().split(/\s+/);
    const cls = activeClasses().find(c => c.level === e.programme) || activeClasses().find(c => c.name.startsWith(e.programme));
    const fam = e.familyId ? listFamilies().find(f => f.id === e.familyId) : null;
    const relationOf = gid => getChildren().map(c => c.guardianLinks?.find(l => l.guardianId === gid)).find(Boolean)?.relation || '';
    const family = fam ? { id: fam.id, name: fam.name, householdIds: fam.householdIds.slice(), guardians: fam.guardians.map(g => ({ id: g.id, name: g.name, phone: g.phone || '', email: g.email || '', relation: relationOf(g.id), household: Math.max(1, fam.households.findIndex(h => h.guardianIds.includes(g.id)) + 1), primary: fam.primary?.id === g.id })) } : null;
    return { enquiryId: e.id, child: { firstName: parts.slice(0, -1).join(' ') || parts[0], lastName: parts.length > 1 ? parts[parts.length - 1] : '', dob: e.dob || '' }, guardian: { name: e.parent, phone: e.phone, email: e.email }, cls: cls?.name || '', startDate: e.preferredStart && e.preferredStart >= today() ? e.preferredStart : today(), familyId: e.familyId, family, documents: Object.entries(e.documents || {}).map(([k, d]) => ({ label: APPLICANT_DOCS[k], name: d.name })) };
  }
  // Called by S14 after the child is saved: the only way an enquiry becomes Enrolled. Safe to call twice.
  function completeEnquiryEnrolment(user, id, childId) {
    const list = getAdmissionEnquiries();
    const e = list.find(x => x.id === id);
    const c = childById(childId);
    if (!e || !c) return { ok: false, reason: 'missing' };
    if (e.stage === 'enrolled' && e.childId === childId) return { ok: true, enquiry: e, repeated: true };
    const fam = listFamilies().find(f => f.children.some(k => k.id === childId));
    const now = new Date().toISOString();
    const prev = e.stage;
    Object.assign(e, { stage: 'enrolled', status: 'enrolled', stageAt: now, updatedAt: now, childId, familyId: fam?.id || e.familyId, preferredStart: c.startDate || e.preferredStart });
    e.history = [...e.history, histEvent(user, 'enrolled', { from: prev, to: 'enrolled', detail: `Enrolled — S14 enrolment completed (${c.cls}, starts ${c.startDate})${fam ? ` · family: ${fam.name}` : ''}` })];
    // Uploaded applicant documents are copied to the child's Documents once (unverified, like any new upload).
    const writes = [{ key: admissionsKey(school.id), value: list }];
    if (e.docsCopiedTo !== childId && Object.keys(e.documents || {}).length) {
      const files = read(admissionFilesKey(school.id), []);
      const now2 = new Date().toISOString();
      const docs = Object.entries(e.documents).map(([k, d]) => { const f = files.find(x => x.id === d.fileId); return f ? { id: newId('doc'), childId, name: APPLICANT_DOCS[k], category: DOC_TO_CHILD[k], expiry: '', fileName: f.name, mime: f.mime, size: f.size, data: f.data, status: 'unverified', uploadedAt: now2, uploadedBy: `${user.name} (from admissions)` } : null; }).filter(Boolean);
      if (docs.length) { writes.push({ key: docsKey(school.id), value: [...read(docsKey(school.id), []), ...docs] }); e.docsCopiedTo = childId; e.history.push(histEvent(user, 'document', { detail: `${docs.length} document${docs.length === 1 ? '' : 's'} copied to ${e.child}’s record` })); }
    }
    if (!commit(writes)) return { ok: false, reason: 'storage' };
    logAudit(user, 'enrol:enquiry', childId, `${e.child} from enquiry ${e.id}`);
    return { ok: true, enquiry: e };
  }
  /* KPIs, from the stored records:
     - New this week: created Monday–Sunday of this week (school's local time).
     - Tours booked: in Tour booked with a tour date/time still to come.
     - Applications / Offers out: currently in Applied / Offer sent.
     - Conversion rate: of enquiries created 30–365 days ago (a mature cohort: newer ones haven't had time to decide),
       the share now Enrolled. Shown as "—" until at least 5 enquiries are in that cohort.
     - Expected starts: Offer sent or Enrolled with a start date from today up to the same day three months ahead. */
  function admissionsKpis(list = getAdmissionEnquiries()) {
    const now = new Date();
    const mon = new Date(now); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(sun.getDate() + 7);
    const newWeek = list.filter(e => { const t = new Date(e.createdAt); return t >= mon && t < sun; }).length;
    const toursList = list.filter(e => e.stage === 'tour');
    const tours = toursList.filter(e => e.tourAt && new Date(e.tourAt) > now).length;
    const cohortFrom = new Date(now.getTime() - 365 * 864e5);
    const cohortTo = new Date(now.getTime() - 30 * 864e5);
    const cohort = list.filter(e => { const t = new Date(e.createdAt); return t >= cohortFrom && t <= cohortTo; });
    const enrolled = cohort.filter(e => e.stage === 'enrolled').length;
    const end = new Date(now); end.setMonth(end.getMonth() + 3);
    const endIso = isoDay(end);
    const starts = list.filter(e => ['offer', 'enrolled'].includes(e.stage) && e.preferredStart && e.preferredStart >= today() && e.preferredStart <= endIso);
    return { newWeek, tours, toursNoDate: toursList.length - tours, applications: list.filter(e => e.stage === 'applied').length, offers: list.filter(e => e.stage === 'offer').length, conversion: cohort.length >= 5 ? Math.round((enrolled / cohort.length) * 100) : null, cohort: cohort.length, cohortEnrolled: enrolled, starts: starts.length, startsTo: endIso };
  }
  // The dashboard quick action: same rules as the pipeline's Add enquiry.
  async function addAdmissionEnquiry(user, data) {
    const r = await createEnquiry(user, { child: data.child, parent: data.parent, phone: data.phone, email: data.email, programme: data.programme, preferredStart: data.preferredStart, followUp: data.followUp, ownerId: data.assignedTo || '', notes: data.notes, source: data.source || 'other' });
    if (r.reason === 'duplicate') return { ok: false, reason: 'invalid', message: `This family may already be in admissions (${[...r.duplicates.enquiries.map(x => x.child), ...r.duplicates.families.map(x => x.name)].join(', ')}). Add it from the Admissions page to review the match.` };
    return r;
  }

  /* S07 applicant activity — on the same enquiry record:
       documents: { birth|immunisation|photo|report: { fileId, name, mime, size, at, by } }  (files in nexora-admission-files)
       tasks: [{ id, title, due, time, assigneeId, status: open|done, createdAt, createdBy, doneAt, doneBy }]
       siblingIds: [childId]  (explicitly linked existing children; children of the linked family are listed too)
       offers: [{ id, status: draft|sent|failed, template, body, recipient, values, missing, delivery, at, by }]
     Every action appends to `history`; an action repeated with the same clientId is recorded once.
     There is no email service: emails and offers are recorded as "not sent" / "demo — not delivered". */
  const admissionFilesKey = id => `nexora-admission-files:${id}`;
  const APPLICANT_DOCS = { birth: 'Birth certificate', immunisation: 'Immunisation record', photo: 'Child photo', report: 'Previous school report' };
  const APPLICANT_DOC_TYPES = { birth: ['application/pdf', 'image/jpeg', 'image/png'], immunisation: ['application/pdf', 'image/jpeg', 'image/png'], photo: ['image/jpeg', 'image/png'], report: ['application/pdf', 'image/jpeg', 'image/png'] };
  const DOC_TO_CHILD = { birth: 'Birth certificate', immunisation: 'Immunisation record', photo: 'Other', report: 'Other' };
  const CALL_OUTCOMES = { answered: 'Answered', no_answer: 'No answer', voicemail: 'Voicemail' };
  const CONTACT_METHODS = { phone: 'Phone call', whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email' };
  const OFFER_TEMPLATE = 'Dear Family,\n\nWe are pleased to offer {{child_name}} a place in our Montessori programme, with a proposed start date of {{start_date}}.\n\nThe applicable fees are {{fees}}.\n\nPlease contact the school if you have questions about the offer or the next steps.\n\nWarm regards,\nAdmissions Team';
  const NOT_SENT = 'not sent — no email service is connected';
  const dLabel = d => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const taskDueAt = t => new Date(`${t.due}T${t.time || '23:59'}:00`);
  const taskOverdue = (t, now = Date.now()) => t.status === 'open' && Boolean(t.due) && taskDueAt(t).getTime() < now;
  const openTasks = e => (e.tasks || []).filter(t => t.status === 'open');
  // The pipeline's "next follow-up": the earlier of the follow-up date and the earliest open task.
  const nextFollowUp = e => [e.followUp, ...openTasks(e).map(t => t.due)].filter(Boolean).sort()[0] || '';
  const withEnquiry = (user, id) => { if (!can(user, 'admissions')) return { error: 'forbidden' }; const list = getAdmissionEnquiries(); const e = list.find(x => x.id === id); return e ? { list, e } : { error: 'missing' }; };
  // Appends once per clientId, so a retried save doesn't duplicate the timeline.
  const already = (e, clientId) => clientId && e.history.some(h => h.clientId === clientId);
  const pushEvent = (e, user, type, extra, clientId) => { e.history = [...e.history, histEvent(user, type, { ...extra, clientId: clientId || undefined })]; e.updatedAt = new Date().toISOString(); };

  function logEnquiryNote(user, id, { text, clientId } = {}) {
    const r = withEnquiry(user, id);
    if (r.error) return settle({ ok: false, reason: r.error });
    if (already(r.e, clientId)) return settle({ ok: true, enquiry: r.e, repeated: true });
    const body = String(text || '').trim().slice(0, 2000);
    if (!body) return settle({ ok: false, reason: 'invalid', errors: { text: 'Write the note.' } });
    pushEvent(r.e, user, 'note', { detail: body }, clientId);
    return settle(saveEnquiries(r.list) ? { ok: true, enquiry: r.e } : { ok: false, reason: 'storage' });
  }
  function addTaskTo(e, user, { title, due, time = '', assigneeId }) {
    const t = { id: newId('at'), title: clean(title).slice(0, 200), due, time, assigneeId, status: 'open', createdAt: new Date().toISOString(), createdBy: user.name, createdById: user.id, doneAt: null, doneBy: null };
    e.tasks = [...(e.tasks || []), t];
    return t;
  }
  function taskErrors({ title, due, time, assigneeId }, { needTitle = true } = {}) {
    const errors = {};
    if (needTitle && !clean(title)) errors.title = 'Describe the follow-up.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due || '') || Number.isNaN(new Date(`${due}T12:00:00`).getTime())) errors.due = 'Choose a due date.';
    if (time && !/^\d{2}:\d{2}$/.test(time)) errors.time = 'Enter a valid time.';
    if (!admissionsOwners().some(o => o.id === assigneeId)) errors.assigneeId = 'Choose someone on the admissions team.';
    return errors;
  }
  const notifyTask = (user, e, t, verb = 'assigned you a follow-up') => { if (t.assigneeId && t.assigneeId !== user.id) notifyUsers({ module: 'admissions', kind: 'mention', title: `${user.name} ${verb}`, body: `${t.title} · ${e.child} · due ${dLabel(t.due)}${t.time ? ` ${t.time}` : ''}`, recordType: 'enquiry', recordId: e.id, mentions: [t.assigneeId], dedupeKey: `adm-task-assign:${t.id}:${t.assigneeId}:${t.due}`, actorId: user.id }, { toUserIds: [t.assigneeId] }); };
  function logEnquiryCall(user, id, { outcome, notes = '', followUp = '', followUpTime = '', assigneeId = '', clientId } = {}) {
    const r = withEnquiry(user, id);
    if (r.error) return settle({ ok: false, reason: r.error });
    if (already(r.e, clientId)) return settle({ ok: true, enquiry: r.e, repeated: true });
    const errors = {};
    if (!CALL_OUTCOMES[outcome]) errors.outcome = 'Choose the call outcome.';
    if (followUp) Object.assign(errors, Object.fromEntries(Object.entries(taskErrors({ title: 'x', due: followUp, time: followUpTime, assigneeId: assigneeId || r.e.ownerId || user.id })).map(([k, v]) => [k === 'due' ? 'followUp' : k === 'time' ? 'followUpTime' : k, v])));
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    pushEvent(r.e, user, 'call', { outcome, detail: String(notes).trim().slice(0, 2000) }, clientId);
    let task = null;
    if (followUp) {
      task = addTaskTo(r.e, user, { title: `Follow up after call (${CALL_OUTCOMES[outcome].toLowerCase()})`, due: followUp, time: followUpTime, assigneeId: assigneeId || r.e.ownerId || user.id });
      pushEvent(r.e, user, 'task', { action: 'created', taskId: task.id, detail: `Follow-up created: ${task.title} — due ${dLabel(task.due)}${task.time ? ` ${task.time}` : ''}, ${users.find(u => u.id === task.assigneeId)?.name || ''}` });
    }
    if (!saveEnquiries(r.list)) return settle({ ok: false, reason: 'storage' });
    if (task) notifyTask(user, r.e, task);
    return settle({ ok: true, enquiry: r.e, task });
  }
  function logEnquiryEmail(user, id, { to, subject, body, clientId } = {}) {
    const r = withEnquiry(user, id);
    if (r.error) return settle({ ok: false, reason: r.error });
    if (already(r.e, clientId)) return settle({ ok: true, enquiry: r.e, repeated: true });
    const errors = {};
    const rcpt = clean(to).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rcpt)) errors.to = 'Enter a valid email address.';
    if (!clean(subject)) errors.subject = 'Add a subject.';
    if (!String(body || '').trim()) errors.body = 'Write the message.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    pushEvent(r.e, user, 'email', { to: rcpt, subject: clean(subject).slice(0, 200), detail: String(body).trim().slice(0, 4000), delivery: NOT_SENT }, clientId);
    return settle(saveEnquiries(r.list) ? { ok: true, enquiry: r.e, delivery: NOT_SENT } : { ok: false, reason: 'storage' });
  }
  function addEnquiryTask(user, id, input = {}) {
    const r = withEnquiry(user, id);
    if (r.error) return settle({ ok: false, reason: r.error });
    if (already(r.e, input.clientId)) return settle({ ok: true, enquiry: r.e, repeated: true });
    const errors = taskErrors(input);
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const t = addTaskTo(r.e, user, input);
    pushEvent(r.e, user, 'task', { action: 'created', taskId: t.id, detail: `Follow-up created: ${t.title} — due ${dLabel(t.due)}${t.time ? ` ${t.time}` : ''}, ${users.find(u => u.id === t.assigneeId)?.name || ''}` }, input.clientId);
    if (!saveEnquiries(r.list)) return settle({ ok: false, reason: 'storage' });
    notifyTask(user, r.e, t);
    return settle({ ok: true, enquiry: r.e, task: t });
  }
  // Edit (title, due, time, assignee) or complete / reopen a follow-up. Changes are logged one by one.
  function updateEnquiryTask(user, id, taskId, patch = {}) {
    const r = withEnquiry(user, id);
    if (r.error) return settle({ ok: false, reason: r.error });
    const t = (r.e.tasks || []).find(x => x.id === taskId);
    if (!t) return settle({ ok: false, reason: 'missing' });
    const logs = [];
    if ('status' in patch) {
      const done = patch.status === 'done';
      if ((t.status === 'done') === done) return settle({ ok: true, enquiry: r.e, unchanged: true });
      Object.assign(t, { status: done ? 'done' : 'open', doneAt: done ? new Date().toISOString() : null, doneBy: done ? user.name : null });
      logs.push(done ? `Follow-up completed: ${t.title}` : `Follow-up reopened: ${t.title}`);
    } else {
      const next = { title: patch.title ?? t.title, due: patch.due ?? t.due, time: patch.time ?? t.time, assigneeId: patch.assigneeId ?? t.assigneeId };
      const errors = taskErrors(next);
      if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
      if (next.title !== t.title) logs.push(`Follow-up renamed: ${next.title}`);
      if (next.due !== t.due || next.time !== t.time) logs.push(`Follow-up due date changed: ${dLabel(t.due)}${t.time ? ` ${t.time}` : ''} → ${dLabel(next.due)}${next.time ? ` ${next.time}` : ''}`);
      if (next.assigneeId !== t.assigneeId) logs.push(`Follow-up reassigned to ${users.find(u => u.id === next.assigneeId)?.name || ''}`);
      const reassigned = next.assigneeId !== t.assigneeId;
      Object.assign(t, next);
      if (!logs.length) return settle({ ok: true, enquiry: r.e, unchanged: true });
      if (reassigned) setTimeout(() => notifyTask(user, r.e, t, 'reassigned a follow-up to you'), 0);
    }
    logs.forEach(detail => pushEvent(r.e, user, 'task', { action: 'updated', taskId: t.id, detail }));
    return settle(saveEnquiries(r.list) ? { ok: true, enquiry: r.e, task: t } : { ok: false, reason: 'storage' });
  }
  // Ticker: one notification per overdue open task (per due date), to its assignee.
  function processAdmissions() {
    const list = read(admissionsKey(school.id), null);
    if (!list) return 0;
    let n = 0;
    list.forEach(e => (e.tasks || []).forEach(t => { if (taskOverdue(t) && t.assigneeId) n += notifyUsers({ module: 'admissions', kind: 'enquiry', title: 'Follow-up overdue', body: `${t.title} · ${e.child} · was due ${dLabel(t.due)}${t.time ? ` ${t.time}` : ''}`, recordType: 'enquiry', recordId: e.id, dedupeKey: `adm-task-overdue:${t.id}:${t.due}:${t.time}` }, { toUserIds: [t.assigneeId] }); }));
    return n;
  }

  // Documents: PDF / JPEG / PNG (the photo: JPEG / PNG), 1 MB or less, checked by file content. Device-local.
  function uploadApplicantDocument(user, id, docKey, { name, mime, size, data, clientId } = {}) {
    const r = withEnquiry(user, id);
    if (r.error) return settle({ ok: false, reason: r.error });
    if (!APPLICANT_DOCS[docKey]) return settle({ ok: false, reason: 'invalid' });
    if (already(r.e, clientId)) return settle({ ok: true, enquiry: r.e, repeated: true });
    const types = APPLICANT_DOC_TYPES[docKey];
    const sig = CHAT_FILE_SIGNATURES[mime];
    const body = String(data || '').split(',')[1] || '';
    if (!types.includes(mime) || !sig || !String(data).startsWith(`data:${mime};base64,`) || !body.startsWith(sig)) return settle({ ok: false, reason: 'invalid', errors: { file: docKey === 'photo' ? 'Choose a JPEG or PNG photo.' : 'Choose a PDF, JPEG or PNG file.' } });
    if (!(Number(size) > 0) || Number(size) > DOC_MAX || body.length > DOC_MAX * 1.4) return settle({ ok: false, reason: 'invalid', errors: { file: 'Files must be 1 MB or less.' } });
    const files = read(admissionFilesKey(school.id), []);
    const prev = r.e.documents?.[docKey];
    const f = { id: newId('af'), enquiryId: id, docKey, name: clean(name).slice(0, 120) || APPLICANT_DOCS[docKey], mime, size: Number(size), data, at: new Date().toISOString(), by: user.name };
    const meta = { fileId: f.id, name: f.name, mime, size: f.size, at: f.at, by: user.name };
    r.e.documents = { ...(r.e.documents || {}), [docKey]: meta };
    pushEvent(r.e, user, 'document', { docKey, detail: `${prev ? 'Replaced' : 'Uploaded'} ${APPLICANT_DOCS[docKey]}: ${f.name}` }, clientId);
    const ok = commit([{ key: admissionFilesKey(school.id), value: [...files.filter(x => x.id !== prev?.fileId), f] }, { key: admissionsKey(school.id), value: r.list }]);
    if (!ok) return settle({ ok: false, reason: 'storage', errors: { file: 'There isn’t room on this device for this file. Nothing was saved.' } });
    return settle({ ok: true, enquiry: r.e, document: meta });
  }
  function removeApplicantDocument(user, id, docKey) {
    const r = withEnquiry(user, id);
    if (r.error) return settle({ ok: false, reason: r.error });
    const prev = r.e.documents?.[docKey];
    if (!prev) return settle({ ok: false, reason: 'missing' });
    const docs = { ...r.e.documents };
    delete docs[docKey];
    r.e.documents = docs;
    pushEvent(r.e, user, 'document', { docKey, detail: `Removed ${APPLICANT_DOCS[docKey]}: ${prev.name}` });
    const ok = commit([{ key: admissionFilesKey(school.id), value: read(admissionFilesKey(school.id), []).filter(x => x.id !== prev.fileId) }, { key: admissionsKey(school.id), value: r.list }]);
    return settle(ok ? { ok: true, enquiry: r.e } : { ok: false, reason: 'storage' });
  }
  const applicantFile = (user, fileId) => (can(user, 'admissions') ? read(admissionFilesKey(school.id), []).find(f => f.id === fileId) || null : null);

  // Siblings: children of the linked family, plus existing children linked explicitly. Never matched by name.
  function enquirySiblings(e) {
    const fam = e.familyId ? listFamilies().find(f => f.id === e.familyId) : null;
    const ids = [...new Set([...(fam?.children || []).map(c => c.id), ...(e.siblingIds || [])])].filter(cid => cid !== e.childId);
    return ids.map(cid => childById(cid)).filter(Boolean).map(c => ({ id: c.id, name: childName(c), cls: c.cls, status: c.status, dob: c.dob, viaFamily: Boolean(fam?.children.some(k => k.id === c.id)) }));
  }
  function linkSibling(user, id, childId) {
    const r = withEnquiry(user, id);
    if (r.error) return settle({ ok: false, reason: r.error });
    const c = childById(childId);
    if (!c) return settle({ ok: false, reason: 'missing' });
    if (childId === r.e.childId || enquirySiblings(r.e).some(s => s.id === childId)) return settle({ ok: false, reason: 'invalid', errors: { child: `${childName(c)} is already linked.` } });
    const fam = listFamilies().find(f => f.children.some(k => k.id === childId));
    if (r.e.familyId && fam && fam.id !== r.e.familyId) return settle({ ok: false, reason: 'invalid', errors: { child: `${childName(c)} belongs to the ${fam.name}, not this applicant’s family. Check the family before linking.` } });
    const joinsFamily = !r.e.familyId && fam;
    r.e.siblingIds = [...(r.e.siblingIds || []), childId];
    if (joinsFamily) r.e.familyId = fam.id;
    pushEvent(r.e, user, 'sibling', { detail: `Sibling linked: ${childName(c)} (${c.cls})${joinsFamily ? ` · applicant linked to the ${fam.name}` : ''}` });
    return settle(saveEnquiries(r.list) ? { ok: true, enquiry: r.e } : { ok: false, reason: 'storage' });
  }
  function unlinkSibling(user, id, childId) {
    const r = withEnquiry(user, id);
    if (r.error) return settle({ ok: false, reason: r.error });
    if (!(r.e.siblingIds || []).includes(childId)) return settle({ ok: false, reason: 'missing' });
    r.e.siblingIds = r.e.siblingIds.filter(x => x !== childId);
    pushEvent(r.e, user, 'sibling', { detail: `Sibling link removed: ${childName(childById(childId) || { firstName: 'child', lastName: '' })}` });
    return settle(saveEnquiries(r.list) ? { ok: true, enquiry: r.e } : { ok: false, reason: 'storage' });
  }

  // Offer letters: only {{child_name}}, {{start_date}} and {{fees}}. Values come from the record and the fee table;
  // anything missing stays visibly unresolved and blocks sending.
  function offerValues(e, override = {}) {
    const fee = FEE_BY_LEVEL[e.programme];
    const start = override.start_date || (e.preferredStart ? new Date(`${e.preferredStart}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
    return { child_name: e.child || '', start_date: start, fees: override.fees || (fee ? `₹${fee.toLocaleString('en-IN')} per term (${TERM})` : '') };
  }
  function renderOffer(template, values) {
    const missing = new Set();
    const unknown = new Set();
    const text = String(template || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => { if (!(k in values)) { unknown.add(k); return m; } if (!values[k]) { missing.add(k); return m; } return values[k]; });
    return { text, missing: [...missing], unknown: [...unknown] };
  }
  const canOffer = e => ['enquiry', 'tour', 'applied', 'offer'].includes(e.stage);
  function saveOfferDraft(user, id, { template, values = {}, clientId } = {}) {
    const r = withEnquiry(user, id);
    if (r.error) return settle({ ok: false, reason: r.error });
    if (already(r.e, clientId)) return settle({ ok: true, enquiry: r.e, repeated: true });
    const v = offerValues(r.e, values);
    const out = renderOffer(template, v);
    r.e.offers = [...(r.e.offers || []), { id: newId('of'), status: 'draft', template: String(template).slice(0, 6000), body: out.text, recipient: r.e.email || '', values: v, missing: out.missing, delivery: 'draft', at: new Date().toISOString(), by: user.name }];
    pushEvent(r.e, user, 'offer', { action: 'drafted', detail: 'Offer letter saved as a draft (not sent)' }, clientId);
    return settle(saveEnquiries(r.list) ? { ok: true, enquiry: r.e } : { ok: false, reason: 'storage' });
  }
  // `fail` is a test hook for the failure path. With no email service the send is recorded as a labelled demo send.
  function sendOffer(user, id, { template, values = {}, recipient, clientId, fail = false } = {}) {
    const r = withEnquiry(user, id);
    if (r.error) return settle({ ok: false, reason: r.error });
    if (already(r.e, clientId)) return settle({ ok: true, enquiry: r.e, repeated: true });
    if (!canOffer(r.e)) return settle({ ok: false, reason: 'locked' });
    const v = offerValues(r.e, values);
    const out = renderOffer(template, v);
    const errors = {};
    const to = clean(recipient).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) errors.recipient = 'Enter the family’s email address.';
    if (out.missing.length) errors.template = `Fill in: ${out.missing.map(k => `{{${k}}}`).join(', ')}.`;
    if (out.unknown.length) errors.template = `Unknown variable: ${out.unknown.map(k => `{{${k}}}`).join(', ')}. Use {{child_name}}, {{start_date}} or {{fees}}.`;
    if (!String(template || '').trim()) errors.template = 'The letter is empty.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const now = new Date().toISOString();
    if (fail) {
      r.e.offers = [...(r.e.offers || []), { id: newId('of'), status: 'failed', template: String(template).slice(0, 6000), body: out.text, recipient: to, values: v, missing: [], delivery: 'failed', at: now, by: user.name }];
      pushEvent(r.e, user, 'offer', { action: 'failed', detail: `Offer send failed to ${to} — stage not changed` }, clientId);
      saveEnquiries(r.list);
      return settle({ ok: false, reason: 'send-failed' });
    }
    const prev = r.e.stage;
    r.e.offers = [...(r.e.offers || []), { id: newId('of'), status: 'sent', template: String(template).slice(0, 6000), body: out.text, recipient: to, values: v, missing: [], delivery: 'demo — not delivered (no email service)', at: now, by: user.name }];
    pushEvent(r.e, user, 'offer', { action: 'sent', to, detail: `Offer recorded as sent to ${to} — demo, not delivered (no email service)` }, clientId);
    if (prev !== 'offer') { Object.assign(r.e, { stage: 'offer', status: STAGE_STATUS.offer, stageAt: now }); pushEvent(r.e, user, 'stage', { from: prev, to: 'offer', detail: 'After the offer was sent' }); }
    if (!saveEnquiries(r.list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'offer:enquiry', '', `${r.e.child} → ${to}`);
    return settle({ ok: true, enquiry: r.e, moved: prev !== 'offer' });
  }

  /* School tours (tours.js at ?page=tours) — every booking belongs to an admissions enquiry.
     Patterns `nexora-tour-patterns:<school>` { id, name, days[], start, end, duration, capacity, guideId, from, to, status }
     Slots `nexora-tour-slots:<school>` { id, patternId, date, start, end, capacity, guideId, status: active|cancelled }
       — generated from a pattern, never outside its date range; with no end date, eight weeks ahead.
     Bookings `nexora-tours:<school>` { id, slotId, enquiryId, date, start, end, guideId, status: booked|attended|no_show|
       cancelled, notes, moves: [{ from: { slotId, date, start, end, guideId }, at, by, reason }], followTaskId, clientId,
       createdAt, createdBy, attendedAt/By, noShowAt/By, cancelledAt/By, cancelReason }
     Capacity: only status "booked" occupies a slot; cancelled bookings never do, and finished tours aren't offered.
     A guide can't have two overlapping slots, and can't have two booked tours at the same time.
     All checks and writes happen in one synchronous store step (safe within this browser). Real multi-user protection
     needs a server-side transaction — documented in docs/tours.md. */
  const tourPatternsKey = id => `nexora-tour-patterns:${id}`;
  const tourSlotsKey = id => `nexora-tour-slots:${id}`;
  const toursKey = id => `nexora-tours:${id}`;
  const TOUR_DURATIONS = [15, 30, 45, 60];
  const TOUR_STATUSES = { booked: 'Booked', attended: 'Attended', no_show: 'No-show', cancelled: 'Cancelled' };
  const tourGuides = () => admissionsOwners();
  const canManageTours = user => can(user, 'tours');
  const slotStartAt = s => new Date(`${s.date}T${s.start}:00`);
  const slotEndAt = s => new Date(`${s.date}T${s.end}:00`);
  const sameTime = (a, b) => a.date === b.date && toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);

  function seedTours() {
    const now = new Date().toISOString();
    const from = daysFromToday(-21);
    const to = daysFromToday(35);
    const pattern = { id: 'tp-demo', name: 'Morning tours', days: ['tue', 'thu'], start: '10:00', end: '11:30', duration: 30, capacity: 3, guideId: 'u-admin', from, to, status: 'active', createdBy: 'Mrs. Rao', createdAt: now, demo: true };
    const slots = planPatternSlots(pattern, [], { includePast: true }).slots.map((s, i) => ({ id: `ts-demo-${i}`, patternId: pattern.id, ...s, status: 'active', demo: true }));
    const list = getAdmissionEnquiries();
    const fut = slots.filter(s => slotStartAt(s) > new Date());
    const past = slots.filter(s => slotEndAt(s) < new Date());
    const bookings = [];
    const book = (id, slot, enquiryId, status, extra = {}) => bookings.push({ id, slotId: slot.id, enquiryId, date: slot.date, start: slot.start, end: slot.end, guideId: slot.guideId, status, notes: '', moves: [], followTaskId: null, clientId: id, createdAt: now, createdBy: 'Ms. Fernandes', demo: true, ...extra });
    const e3 = list.find(e => e.id === 'ae3');
    if (e3 && fut[1]) { book('tb-demo-1', fut[1], 'ae3', 'booked', { notes: 'Interested in the garden and lunch routine.' }); e3.tourAt = `${fut[1].date}T${fut[1].start}`; e3.tourId = 'tb-demo-1'; }
    if (past.length >= 2) {
      book('tb-demo-2', past[past.length - 1], 'ae4', 'booked');
      book('tb-demo-3', past[past.length - 2], 'ae5', 'attended', { attendedAt: now, attendedBy: 'Ms. Fernandes' });
    }
    try { localStorage.setItem(admissionsKey(school.id), JSON.stringify(list)); } catch { /* in memory */ }
    return { patterns: [pattern], slots, bookings };
  }
  function toursData() {
    const saved = read(tourSlotsKey(school.id), null);
    if (saved) return { patterns: read(tourPatternsKey(school.id), []), slots: saved, bookings: read(toursKey(school.id), []) };
    const s = seedTours();
    try {
      localStorage.setItem(tourPatternsKey(school.id), JSON.stringify(s.patterns));
      localStorage.setItem(tourSlotsKey(school.id), JSON.stringify(s.slots));
      localStorage.setItem(toursKey(school.id), JSON.stringify(s.bookings));
    } catch { /* in memory */ }
    return s;
  }
  const bookedOn = (slotId, bookings) => bookings.filter(b => b.slotId === slotId && b.status === 'booked');
  // Open / partial / full while it's still ahead; completed once it has ended; cancelled if the slot was removed.
  function slotStatus(s, bookings, now = Date.now()) {
    if (s.status === 'cancelled') return 'cancelled';
    if (slotEndAt(s).getTime() <= now) return 'completed';
    const n = bookedOn(s.id, bookings).length;
    return n >= s.capacity ? 'full' : n > 0 ? 'partial' : 'open';
  }
  function tourSlots(user, { from, to } = {}) {
    if (!can(user, 'tours')) return [];
    const { slots, bookings } = toursData();
    return slots.filter(s => (!from || s.date >= from) && (!to || s.date <= to)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
      .map(s => { const bs = bookings.filter(b => b.slotId === s.id && b.status !== 'cancelled'); return { ...s, state: slotStatus(s, bookings), booked: bookedOn(s.id, bookings).length, bookings: bs }; });
  }
  const tourBookings = user => (can(user, 'tours') ? toursData().bookings.slice().sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)) : []);

  // One generator for the preview and for saving. Existing identical slots are skipped; overlaps with the same guide's
  // other slots are reported as conflicts (with date, time and guide) and never overwritten.
  function planPatternSlots(p, existing, { includePast = false } = {}) {
    const out = [];
    const conflicts = [];
    let duplicates = 0;
    let closed = 0;
    let past = 0;
    const hardTo = p.to || addDaysIso(p.from > today() ? p.from : today(), 56);
    for (let d = p.from; d <= hardTo; d = addDaysIso(d, 1)) {
      if (!p.days.includes(weekdayOf(d))) continue;
      if (!schoolDay(d).open) { closed += 1; continue; }
      for (let t = toMinutes(p.start); t + p.duration <= toMinutes(p.end); t += p.duration) {
        const s = { date: d, start: ptmTime(t), end: ptmTime(t + p.duration), capacity: p.capacity, guideId: p.guideId };
        if (!includePast && slotStartAt(s).getTime() <= Date.now()) { past += 1; continue; }
        const same = existing.find(x => x.status === 'active' && x.guideId === s.guideId && x.date === d && x.start === s.start && x.end === s.end);
        if (same) { duplicates += 1; continue; }
        const clash = existing.find(x => x.status === 'active' && x.guideId === s.guideId && sameTime(x, s));
        if (clash) { conflicts.push({ date: d, start: s.start, end: s.end, with: `${clash.start}–${clash.end}`, guide: users.find(u => u.id === s.guideId)?.name || 'Guide' }); continue; }
        out.push(s);
      }
    }
    return { slots: out, conflicts, duplicates, closed, past, to: hardTo };
  }
  function patternValues(user, input) {
    const errors = {};
    const p = { name: clean(input.name).slice(0, 60), days: [...new Set((input.days || []).filter(d => WEEKDAYS.includes(d)))], start: clean(input.start), end: clean(input.end), duration: Number(input.duration), capacity: Number(input.capacity), guideId: clean(input.guideId), from: clean(input.from), to: clean(input.to) };
    if (!p.days.length) errors.days = 'Choose at least one day.';
    if (!/^\d{2}:\d{2}$/.test(p.start)) errors.start = 'Choose a start time.';
    if (!/^\d{2}:\d{2}$/.test(p.end)) errors.end = 'Choose an end time.';
    else if (!errors.start && toMinutes(p.end) <= toMinutes(p.start)) errors.end = 'The end time must be later than the start time.';
    if (!TOUR_DURATIONS.includes(p.duration)) errors.duration = 'Choose 15, 30, 45 or 60 minutes.';
    else if (!errors.end && !errors.start && toMinutes(p.end) - toMinutes(p.start) < p.duration) errors.duration = 'The time range is shorter than one tour.';
    if (!Number.isInteger(p.capacity) || p.capacity < 1 || p.capacity > 20) errors.capacity = 'Enter a whole number from 1 to 20.';
    if (!tourGuides().some(g => g.id === p.guideId)) errors.guideId = 'Choose a guide.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.from)) errors.from = 'Choose the first date.';
    if (p.to && !/^\d{4}-\d{2}-\d{2}$/.test(p.to)) errors.to = 'Enter a valid end date.';
    else if (p.to && !errors.from && p.to < p.from) errors.to = 'The end date must be on or after the start date.';
    else if (p.to && p.from && (new Date(`${p.to}T12:00:00`) - new Date(`${p.from}T12:00:00`)) / 864e5 > 366) errors.to = 'Choose a range of one year or less.';
    return { p, errors };
  }
  function previewTourPattern(user, input) {
    const { p, errors } = patternValues(user, input);
    if (Object.keys(errors).length) return { errors, slots: [], conflicts: [] };
    const plan = planPatternSlots(p, toursData().slots);
    const existingDup = toursData().patterns.find(x => x.status === 'active' && x.guideId === p.guideId && x.start === p.start && x.end === p.end && x.duration === p.duration && x.from === p.from && (x.to || '') === (p.to || '') && x.days.join() === p.days.join());
    return { errors: {}, ...plan, duplicatePattern: Boolean(existingDup) };
  }
  // Saves the pattern and its new slots. Conflicts block saving unless the user explicitly chooses to skip them.
  function saveTourPattern(user, input, { skipConflicts = false } = {}) {
    if (!canManageTours(user)) return settle({ ok: false, reason: 'forbidden' });
    const { p, errors } = patternValues(user, input);
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const data = toursData();
    const plan = planPatternSlots(p, data.slots);
    if (plan.conflicts.length && !skipConflicts) return settle({ ok: false, reason: 'conflict', conflicts: plan.conflicts });
    if (!plan.slots.length) return settle({ ok: false, reason: 'invalid', errors: { form: plan.duplicates ? 'These slots already exist — nothing new to create.' : 'No slots fall in this date range and time window.' } });
    const now = new Date().toISOString();
    const pattern = { id: newId('tp'), ...p, status: 'active', createdBy: user.name, createdAt: now };
    const made = plan.slots.map(s => ({ id: newId('ts'), patternId: pattern.id, ...s, status: 'active' }));
    if (!commit([{ key: tourPatternsKey(school.id), value: [...data.patterns, pattern] }, { key: tourSlotsKey(school.id), value: [...data.slots, ...made] }])) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'create:tour-pattern', '', `${made.length} slots, ${p.days.join('/')} ${p.start}–${p.end}`);
    return settle({ ok: true, pattern, created: made.length, skipped: { conflicts: plan.conflicts.length, duplicates: plan.duplicates, closed: plan.closed } });
  }
  // Removing a pattern cancels its future empty slots. Future slots with bookings need an explicit decision:
  // keep them (they stay bookable-as-booked) or cancel those tours too.
  function tourPatternImpact(id) {
    const { slots, bookings } = toursData();
    const fut = slots.filter(s => s.patternId === id && s.status === 'active' && slotStartAt(s) > new Date());
    const withBookings = fut.filter(s => bookedOn(s.id, bookings).length);
    return { empty: fut.length - withBookings.length, booked: withBookings.map(s => ({ slotId: s.id, date: s.date, start: s.start, families: bookedOn(s.id, bookings).length })) };
  }
  function removeTourPattern(user, id, { bookedSlots = null } = {}) {
    if (!canManageTours(user)) return settle({ ok: false, reason: 'forbidden' });
    const data = toursData();
    const pat = data.patterns.find(x => x.id === id && x.status === 'active');
    if (!pat) return settle({ ok: false, reason: 'missing' });
    const impact = tourPatternImpact(id);
    if (impact.booked.length && !['keep', 'cancel'].includes(bookedSlots)) return settle({ ok: false, reason: 'decision', impact });
    const now = new Date().toISOString();
    pat.status = 'removed';
    pat.removedAt = now;
    const list = getAdmissionEnquiries();
    data.slots.forEach(s => {
      if (s.patternId !== id || s.status !== 'active' || slotStartAt(s) <= new Date()) return;
      const bs = bookedOn(s.id, data.bookings);
      if (!bs.length) { s.status = 'cancelled'; return; }
      if (bookedSlots === 'cancel') {
        s.status = 'cancelled';
        bs.forEach(b => { cancelInPlace(user, b, list, 'Tour slots withdrawn'); });
      } else s.patternId = null;
    });
    if (!commit([{ key: tourPatternsKey(school.id), value: data.patterns }, { key: tourSlotsKey(school.id), value: data.slots }, { key: toursKey(school.id), value: data.bookings }, { key: admissionsKey(school.id), value: list }])) return settle({ ok: false, reason: 'storage' });
    return settle({ ok: true, cancelledSlots: impact.empty + (bookedSlots === 'cancel' ? impact.booked.length : 0), keptSlots: bookedSlots === 'keep' ? impact.booked.length : 0 });
  }

  const tourWhen = b => `${new Date(`${b.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} ${b.start}–${b.end}`;
  function guideClash(bookings, slots, slot, exceptId = null) {
    const busy = bookings.filter(b => b.id !== exceptId && b.status === 'booked' && b.guideId === slot.guideId && b.slotId !== slot.id);
    return busy.find(b => sameTime(b, slot)) || null;
  }
  function slotChecks(user, data, slotId, exceptBookingId = null) {
    const s = data.slots.find(x => x.id === slotId);
    if (!s) return { error: 'missing' };
    if (s.status !== 'active') return { error: 'cancelled', message: 'This slot has been withdrawn. Choose another time.' };
    if (slotStartAt(s).getTime() <= Date.now()) return { error: 'past', message: 'This slot has already started. Choose another time.' };
    const used = bookedOn(s.id, data.bookings).filter(b => b.id !== exceptBookingId).length;
    if (used >= s.capacity) return { error: 'full', message: 'This tour slot is full. Choose another available time to continue.' };
    const clash = guideClash(data.bookings, data.slots, s, exceptBookingId);
    if (clash) return { error: 'guide', message: `${users.find(u => u.id === s.guideId)?.name || 'The guide'} already has a tour at ${tourWhen(clash)}. Choose another slot or guide.` };
    return { slot: s, used };
  }
  const tourNote = (user, e, text, extra = {}) => { e.history = [...e.history, histEvent(user, 'tour', { detail: text, ...extra })]; e.updatedAt = new Date().toISOString(); };
  const notifyTour = (user, e, b, title, key) => { const ids = [...new Set([b.guideId, e.ownerId].filter(id => id && id !== user.id))]; if (ids.length) notifyUsers({ module: 'admissions', kind: 'enquiry', title, body: `${e.child} · ${tourWhen(b)}`, recordType: 'enquiry', recordId: e.id, dedupeKey: `${key}:${b.id}:${b.date}:${b.start}`, actorId: user.id }, { toUserIds: ids }); };

  function bookTour(user, { slotId, enquiryId, notes = '', clientId = '' } = {}) {
    if (!canManageTours(user)) return settle({ ok: false, reason: 'forbidden' });
    const data = toursData();
    if (clientId) { const again = data.bookings.find(b => b.clientId === clientId); if (again) return settle({ ok: true, booking: again, repeated: true }); }
    const chk = slotChecks(user, data, slotId);
    if (chk.error) return settle({ ok: false, reason: chk.error, message: chk.message });
    const list = getAdmissionEnquiries();
    const e = list.find(x => x.id === enquiryId);
    if (!e) return settle({ ok: false, reason: 'invalid', errors: { enquiry: 'Choose an enquiry to link.' } });
    if (e.stage === 'enrolled') return settle({ ok: false, reason: 'invalid', errors: { enquiry: `${e.child} is already enrolled.` } });
    if (e.stage === 'lost') return settle({ ok: false, reason: 'invalid', errors: { enquiry: `${e.child}’s enquiry is marked Lost. Reopen it in Admissions first.` } });
    const open = data.bookings.find(b => b.enquiryId === e.id && b.status === 'booked' && slotEndAt(b) > new Date());
    if (open) return settle({ ok: false, reason: 'invalid', errors: { enquiry: `${e.child} already has a tour on ${tourWhen(open)}. Reschedule that tour instead.` } });
    const s = chk.slot;
    const now = new Date().toISOString();
    const b = { id: newId('tb'), slotId: s.id, enquiryId: e.id, date: s.date, start: s.start, end: s.end, guideId: s.guideId, status: 'booked', notes: String(notes || '').trim().slice(0, 500), moves: [], followTaskId: null, clientId: clientId || newId('cl'), createdAt: now, createdBy: user.name, createdById: user.id };
    const prev = e.stage;
    e.tourAt = `${s.date}T${s.start}`;
    e.tourId = b.id;
    tourNote(user, e, `Tour booked: ${tourWhen(b)} with ${users.find(u => u.id === s.guideId)?.name || 'guide'}`, { action: 'booked', tourId: b.id });
    if (prev === 'enquiry') { Object.assign(e, { stage: 'tour', status: STAGE_STATUS.tour, stageAt: now }); e.history.push(histEvent(user, 'stage', { from: prev, to: 'tour', detail: `Tour on ${tourWhen(b)}` })); }
    if (!commit([{ key: toursKey(school.id), value: [...data.bookings, b] }, { key: admissionsKey(school.id), value: list }])) return settle({ ok: false, reason: 'storage' });
    notifyTour(user, e, b, `Tour booked: ${e.child}`, 'tour-booked');
    logAudit(user, 'book:tour', '', `${e.child} ${tourWhen(b)}`);
    return settle({ ok: true, booking: b, moved: prev === 'enquiry' });
  }
  function withBooking(user, id) {
    if (!canManageTours(user)) return { error: 'forbidden' };
    const data = toursData();
    const b = data.bookings.find(x => x.id === id);
    if (!b) return { error: 'missing' };
    const list = getAdmissionEnquiries();
    return { data, b, list, e: list.find(x => x.id === b.enquiryId) };
  }
  function markTourAttended(user, id) {
    const r = withBooking(user, id);
    if (r.error) return settle({ ok: false, reason: r.error });
    if (r.b.status === 'attended') return settle({ ok: true, booking: r.b, repeated: true });
    if (r.b.status !== 'booked') return settle({ ok: false, reason: 'locked' });
    if (r.b.date > today()) return settle({ ok: false, reason: 'early', message: 'Attendance can be recorded from the day of the tour.' });
    Object.assign(r.b, { status: 'attended', attendedAt: new Date().toISOString(), attendedBy: user.name });
    if (r.e) tourNote(user, r.e, `Attended school tour (${tourWhen(r.b)})`, { action: 'attended', tourId: r.b.id });
    if (!commit([{ key: toursKey(school.id), value: r.data.bookings }, { key: admissionsKey(school.id), value: r.list }])) return settle({ ok: false, reason: 'storage' });
    return settle({ ok: true, booking: r.b });
  }
  // No-show creates exactly one follow-up task (re-running returns the same one).
  function markTourNoShow(user, id, { due = '', assigneeId = '' } = {}) {
    const r = withBooking(user, id);
    if (r.error) return settle({ ok: false, reason: r.error });
    if (r.b.status === 'no_show') return settle({ ok: true, booking: r.b, repeated: true });
    if (r.b.status !== 'booked') return settle({ ok: false, reason: 'locked' });
    if (r.b.date > today()) return settle({ ok: false, reason: 'early', message: 'A no-show can be recorded from the day of the tour.' });
    const assignee = assigneeId || r.e?.ownerId || user.id;
    const errors = taskErrors({ title: 'x', due, assigneeId: assignee });
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    Object.assign(r.b, { status: 'no_show', noShowAt: new Date().toISOString(), noShowBy: user.name });
    let task = null;
    if (r.e) {
      tourNote(user, r.e, `Did not attend school tour (${tourWhen(r.b)})`, { action: 'no_show', tourId: r.b.id });
      if (!r.b.followTaskId || !(r.e.tasks || []).some(t => t.id === r.b.followTaskId)) {
        task = addTaskTo(r.e, user, { title: 'Follow up after missed school tour', due, assigneeId: assignee });
        r.b.followTaskId = task.id;
        r.e.history.push(histEvent(user, 'task', { action: 'created', taskId: task.id, detail: `Follow-up created: ${task.title} — due ${dLabel(due)}, ${users.find(u => u.id === assignee)?.name || ''}` }));
      }
    }
    if (!commit([{ key: toursKey(school.id), value: r.data.bookings }, { key: admissionsKey(school.id), value: r.list }])) return settle({ ok: false, reason: 'storage' });
    if (task) notifyTask(user, r.e, task, 'needs you to follow up a missed tour');
    return settle({ ok: true, booking: r.b, task });
  }
  // The new slot is checked and taken in the same step that releases the old one; if the check fails nothing changes.
  function rescheduleTour(user, id, { slotId, reason = '' } = {}) {
    const r = withBooking(user, id);
    if (r.error) return settle({ ok: false, reason: r.error });
    if (r.b.status !== 'booked') return settle({ ok: false, reason: 'locked' });
    if (slotId === r.b.slotId) return settle({ ok: false, reason: 'invalid', message: 'Choose a different slot.' });
    const chk = slotChecks(user, r.data, slotId, r.b.id);
    if (chk.error) return settle({ ok: false, reason: chk.error, message: chk.message });
    const s = chk.slot;
    const from = { slotId: r.b.slotId, date: r.b.date, start: r.b.start, end: r.b.end, guideId: r.b.guideId };
    r.b.moves = [...(r.b.moves || []), { from, at: new Date().toISOString(), by: user.name, reason: clean(reason).slice(0, 200) }];
    Object.assign(r.b, { slotId: s.id, date: s.date, start: s.start, end: s.end, guideId: s.guideId });
    if (r.e) { if (r.e.tourId === r.b.id || !r.e.tourId) { r.e.tourAt = `${s.date}T${s.start}`; r.e.tourId = r.b.id; } tourNote(user, r.e, `Tour rescheduled: ${tourWhen(from)} → ${tourWhen(r.b)}${clean(reason) ? ` (${clean(reason)})` : ''}`, { action: 'rescheduled', tourId: r.b.id }); }
    if (!commit([{ key: toursKey(school.id), value: r.data.bookings }, { key: admissionsKey(school.id), value: r.list }])) return settle({ ok: false, reason: 'storage' });
    if (r.e) notifyTour(user, r.e, r.b, `Tour rescheduled: ${r.e.child}`, 'tour-moved');
    return settle({ ok: true, booking: r.b });
  }
  function cancelInPlace(user, b, list, reason) {
    Object.assign(b, { status: 'cancelled', cancelledAt: new Date().toISOString(), cancelledBy: user.name, cancelReason: reason });
    const e = list.find(x => x.id === b.enquiryId);
    if (e) { if (e.tourId === b.id) { e.tourAt = null; e.tourId = null; } tourNote(user, e, `Tour cancelled: ${tourWhen(b)}${reason ? ` — ${reason}` : ''}`, { action: 'cancelled', tourId: b.id }); }
    return e;
  }
  // Cancelling keeps the booking (as Cancelled) and frees the place. The enquiry's stage isn't changed.
  function cancelTour(user, id, { reason = '' } = {}) {
    const r = withBooking(user, id);
    if (r.error) return settle({ ok: false, reason: r.error });
    if (r.b.status === 'cancelled') return settle({ ok: true, booking: r.b, repeated: true });
    if (r.b.status !== 'booked') return settle({ ok: false, reason: 'locked' });
    const e = cancelInPlace(user, r.b, r.list, clean(reason).slice(0, 200));
    if (!commit([{ key: toursKey(school.id), value: r.data.bookings }, { key: admissionsKey(school.id), value: r.list }])) return settle({ ok: false, reason: 'storage' });
    if (e) notifyTour(user, e, r.b, `Tour cancelled: ${e.child}`, 'tour-cancel');
    return settle({ ok: true, booking: r.b });
  }

  /* Fees: one term invoice per child, and the payments recorded against it. Amounts in rupees. */
  const TERM = 'Term 2 · 2026–27';
  const FEE_BY_LEVEL = { Nursery: 15000, LKG: 16500, UKG: 18000, Montessori: 21000 };
  const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank transfer', 'Cheque', 'Card'];
  const invoicesKey = id => `nexora-invoices:${id}`;
  const paymentsKey = id => `nexora-payments:${id}`;
  const UNPAID = ['r3', 'r14', 'r22', 'r30', 'r38', 's4'];
  const PART_PAID = ['s3', 'r9', 'r41'];
  const getInvoices = (schoolId = school.id) => seeded(invoicesKey(schoolId), () => rosterSeed.map(s => ({
    id: `inv-${s.id}`, studentId: s.id, term: TERM, amount: FEE_BY_LEVEL[classByName(s.cls).level], dueDate: daysFromToday(-4)
  })));
  const getPayments = (schoolId = school.id) => seeded(paymentsKey(schoolId), () => getInvoices(schoolId)
    .filter(inv => !UNPAID.includes(inv.studentId))
    .map((inv, i) => ({
      id: `pay-${inv.studentId}`, invoiceId: inv.id, studentId: inv.studentId,
      amount: PART_PAID.includes(inv.studentId) ? inv.amount / 2 : inv.amount,
      method: PAYMENT_METHODS[i % 3], date: daysFromToday(-(i % 12) - 2), reference: '', recordedBy: 'Mr. Iyer', createdAt: atToday(10, 0, -(i % 12) - 2)
    })));
  function feeLedger() {
    const payments = getPayments();
    return getInvoices().map(inv => {
      const paid = payments.filter(p => p.invoiceId === inv.id).reduce((sum, p) => sum + p.amount, 0);
      const balance = Math.max(0, inv.amount - paid);
      return { ...inv, student: studentById(inv.studentId), paid, balance, overdue: balance > 0 && inv.dueDate < today() };
    });
  }
  function recordPayment(user, data) {
    if (!can(user, 'fees')) return settle({ ok: false, reason: 'forbidden' });
    const line = feeLedger().find(l => l.id === data.invoiceId);
    const amount = Math.round(Number(data.amount) * 100) / 100;
    if (!line || !PAYMENT_METHODS.includes(data.method) || !data.date) return settle({ ok: false, reason: 'invalid' });
    if (!(amount > 0) || amount > line.balance) return settle({ ok: false, reason: 'amount', balance: line.balance });
    const p = { id: newId('pay'), invoiceId: line.id, studentId: line.studentId, amount, method: data.method, date: data.date, reference: String(data.reference || '').trim().slice(0, 60), recordedBy: user.name, createdAt: new Date().toISOString() };
    if (!write(paymentsKey(school.id), [...getPayments(), p])) return settle({ ok: false, reason: 'storage' });
    events.payment(user, p);
    return settle({ ok: true, payment: p, balance: line.balance - amount });
  }

  /* Incidents (Health, Safety & Safeguarding module) */
  const INCIDENT_TYPES = ['Injury', 'Illness', 'Behaviour', 'Safeguarding concern', 'Other'];
  const SEVERITIES = ['Low', 'Medium', 'High'];
  const incidentsKey = id => `nexora-incidents:${id}`;
  const getIncidents = (schoolId = school.id) => seeded(incidentsKey(schoolId), () => [
    { id: 'in1', studentId: 's3', type: 'Injury', severity: 'Low', occurredAt: atToday(10, 20), description: 'Scraped knee in the garden. Cleaned and plaster applied.', action: 'First aid given.', parentInformed: false, status: 'open', createdBy: 'Ms. Sunita', createdAt: atToday(10, 35) },
    { id: 'in2', studentId: 'r12', type: 'Illness', severity: 'Medium', occurredAt: atToday(11, 45, -1), description: 'Temperature of 38.4°C after lunch.', action: 'Parent collected at 12:30.', parentInformed: true, status: 'open', createdBy: 'Mr. Arjun', createdAt: atToday(12, 0, -1) },
    { id: 'in3', studentId: 'r6', type: 'Behaviour', severity: 'Low', occurredAt: atToday(9, 30, -3), description: 'Pushed a friend during outdoor time.', action: 'Talked it through together.', parentInformed: true, status: 'resolved', createdBy: 'Ms. Lakshmi', createdAt: atToday(9, 45, -3), resolvedAt: atToday(15, 0, -3) }
  ]);
  function logIncident(user, data) {
    if (!can(user, 'safeguarding')) return settle({ ok: false, reason: 'forbidden' });
    const i = {
      id: newId('in'), studentId: data.studentId, type: data.type, severity: data.severity,
      occurredAt: data.occurredAt, description: String(data.description || '').trim().slice(0, 1000),
      action: String(data.action || '').trim().slice(0, 500), parentInformed: Boolean(data.parentInformed),
      status: 'open', createdBy: user.name, createdAt: new Date().toISOString()
    };
    if (!studentById(i.studentId) || !INCIDENT_TYPES.includes(i.type) || !SEVERITIES.includes(i.severity) || !i.occurredAt || !i.description) return settle({ ok: false, reason: 'invalid' });
    if (!write(incidentsKey(school.id), [i, ...getIncidents()])) return settle({ ok: false, reason: 'storage' });
    events.incident(user, i);
    return settle({ ok: true, incident: i });
  }
  function resolveIncident(user, id) {
    if (!can(user, 'safeguarding')) return settle({ ok: false, reason: 'forbidden' });
    const list = getIncidents().map(i => (i.id === id ? { ...i, status: 'resolved', resolvedAt: new Date().toISOString() } : i));
    return settle(write(incidentsKey(school.id), list) ? { ok: true } : { ok: false, reason: 'storage' });
  }

  /* Announcements & emergency broadcasts (announcements.js at ?page=communication)
     `nexora-announcements:<school>` holds every announcement:
       { id, title, body, category, type: 'normal'|'emergency', emergencyType, status: 'draft'|'scheduled'|'sending'|'sent'|
         'failed'|'cancelled', audienceSpec: { mode: 'all'|'classes'|'families'|'staff', classIds, familyIds, staffIds },
         audience (label, kept for older readers), channels, requireAck, scheduledAt, sentAt, createdBy, createdById, createdAt,
         updatedAt, attachments, recipients: [{ id: 'fam:<familyId>'|'staff:<userId>', kind, name, familyId, userId, children,
         classes, delivery: { app }, readAt, readDemo, ackAt, ackDemo, reminders: [{ at, by, result }] }], reminders }
     Older records (title/body/audience string) are read as sent announcements to that audience.
     One recipient per family (so a family with children in two selected classes is counted once) or per staff member.
     Delivery: only the in-app channel exists. Staff get a real Nexora notification; families have no app yet, so a family
     with an active parent-app account is recorded "queued (demo — not delivered)" and others "skipped". Email and SMS
     have no provider and can't be selected. Family reads/acknowledgements only come from the labelled demo simulation;
     staff reads/acknowledgements are real. Scheduled sends happen in processAnnouncements() while Nexora is open. */
  const audiences = () => ['All families', 'All staff', ...activeClasses().map(c => c.name)];
  const announcementsKey = id => `nexora-announcements:${id}`;
  const ANN_CATEGORIES = { general: 'General', event: 'Event', reminder: 'Reminder', learning: 'Learning', closure: 'Closure', safety: 'Safety' };
  const EMERGENCY_TYPES = { safety: 'Safety', evacuation: 'Evacuation', closure: 'Closure', medical: 'Medical', other: 'Other' };
  const ANN_CHANNELS = { app: { label: 'In-app', available: true }, email: { label: 'Email', available: false, note: 'No email provider is configured' }, sms: { label: 'SMS', available: false, note: 'No SMS provider is configured' } };
  const EMERGENCY_PHRASE = 'SEND EMERGENCY BROADCAST';
  const canAnnounce = user => can(user, 'communication');
  const canEmergency = user => can(user, 'communication') && MANAGE_PLAN_ROLES.includes(user.role);
  const annPlural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  // Everyone an audience can reach, as this user is allowed to address them. Families are deduplicated.
  function announcementTargets(user) {
    const lead = LEADERS.includes(user.role);
    const scope = classScope(user);
    const fams = listFamilies().map(f => ({ ...f, active: f.children.filter(c => c.status === 'active') })).filter(f => f.active.length && (lead || f.active.some(c => scope.includes(c.cls))));
    return {
      classes: activeClasses().filter(c => lead || scope.includes(c.name)).map(c => ({ id: c.id, name: c.name, families: fams.filter(f => f.active.some(k => k.cls === c.name)).length })),
      families: fams.map(f => ({ id: f.id, name: f.name, children: f.active.map(c => c.name), classes: [...new Set(f.active.map(c => c.cls))] })),
      staff: lead ? users.filter(u => u.schoolId === school.id && u.id !== user.id).map(u => ({ id: u.id, name: u.name, role: u.role })) : [],
      canAll: lead
    };
  }
  const familyRecipient = f => { const kids = f.children.filter(c => c.status === 'active'); return { id: `fam:${f.id}`, kind: 'family', name: f.name, familyId: f.id, children: kids.map(c => c.name), classes: [...new Set(kids.map(c => c.cls))], guardianIds: f.guardians.map(g => g.id) }; };
  function resolveAudience(user, spec = {}) {
    const t = announcementTargets(user);
    const fams = listFamilies();
    const mode = spec.mode;
    let familyIds = [];
    let staffIds = [];
    if (mode === 'all' && t.canAll) familyIds = t.families.map(f => f.id);
    else if (mode === 'classes') { const names = (spec.classIds || []).map(id => t.classes.find(c => c.id === id)?.name).filter(Boolean); familyIds = t.families.filter(f => f.classes.some(c => names.includes(c))).map(f => f.id); }
    else if (mode === 'families') familyIds = (spec.familyIds || []).filter(id => t.families.some(f => f.id === id));
    else if (mode === 'staff') staffIds = (spec.staffIds || []).filter(id => t.staff.some(s => s.id === id));
    familyIds = [...new Set(familyIds)];
    const recipients = [
      ...familyIds.map(id => familyRecipient(fams.find(x => x.id === id))),
      ...[...new Set(staffIds)].map(id => { const u = staffUser(id); return { id: `staff:${id}`, kind: 'staff', name: u.name, userId: id, role: u.role, children: [], classes: [] }; })
    ];
    const classNames = mode === 'classes' ? (spec.classIds || []).map(id => t.classes.find(c => c.id === id)?.name).filter(Boolean) : [];
    const count = recipients.length;
    const unit = mode === 'staff' ? annPlural(count, 'staff member', 'staff members') : annPlural(count, 'family', 'families');
    const label = mode === 'all' ? `All families · ${unit}` : mode === 'classes' ? `${classNames.join(' + ') || 'No classes'} · ${unit}` : mode === 'families' ? `Selected families · ${unit}` : mode === 'staff' ? `Selected staff · ${unit}` : 'No audience';
    return { recipients, label, count, classNames };
  }
  const appDelivery = (r, app) => (r.kind === 'staff' ? 'notified' : r.guardianIds.some(g => accountOf(app, g).status === 'active') ? 'queued (demo — not delivered)' : 'skipped: no parent-app account');

  // Older records become sent announcements to the audience they named.
  function normaliseAnnouncement(a) {
    if (a.status) return a;
    const fams = listFamilies().filter(f => f.children.some(c => c.status === 'active'));
    const cls = activeClasses().find(c => c.name === a.audience);
    let recipients;
    let spec = { mode: 'all', classIds: [], familyIds: [], staffIds: [] };
    if (a.audience === 'All staff') {
      const staff = users.filter(u => u.schoolId === school.id);
      spec = { ...spec, mode: 'staff', staffIds: staff.map(u => u.id) };
      recipients = staff.map(u => ({ id: `staff:${u.id}`, kind: 'staff', name: u.name, userId: u.id, role: u.role, children: [], classes: [] }));
    } else {
      if (cls) spec = { ...spec, mode: 'classes', classIds: [cls.id] };
      recipients = (cls ? fams.filter(f => f.children.some(c => c.status === 'active' && c.cls === cls.name)) : fams).map(familyRecipient);
    }
    const app = getParentApp();
    recipients.forEach(r => Object.assign(r, { delivery: { app: appDelivery(r, app) }, readAt: null, ackAt: null, reminders: [] }));
    return { ...a, category: 'general', type: 'normal', status: 'sent', audienceSpec: spec, audience: a.audience, channels: ['app'], requireAck: false, sentAt: a.createdAt, updatedAt: a.createdAt, attachments: [], recipients, reminders: [], legacy: true };
  }
  function getAnnouncements(schoolId = school.id) {
    const list = seeded(announcementsKey(schoolId), () => [
      { id: 'an1', title: 'Diwali celebration on Friday', body: 'Children may come in traditional clothes. Please send a small diya for the class display.', audience: 'All families', createdBy: 'Mrs. Rao', createdAt: atToday(16, 0, -1) },
      { id: 'an2', title: 'Parent–teacher meetings next week', body: 'Slots open on Monday. Each meeting is 15 minutes.', audience: 'All families', createdBy: 'Ms. Fernandes', createdAt: atToday(11, 0, -3) }
    ]);
    if (list.some(a => !a.status)) {
      const next = list.map(normaliseAnnouncement);
      try { localStorage.setItem(announcementsKey(schoolId), JSON.stringify(next)); } catch { /* in memory */ }
      return next;
    }
    return list;
  }
  const sentAnnouncements = () => getAnnouncements().filter(a => a.status === 'sent').sort((a, b) => (b.sentAt || '').localeCompare(a.sentAt || ''));
  // For class pages: a sent announcement reaches a class if it went to all families or included that class.
  const announcementReachesClass = (a, clsName) => a.status === 'sent' && (a.audienceSpec?.mode === 'all' || (a.audienceSpec?.mode === 'classes' && a.audienceSpec.classIds.some(id => classById(id)?.name === clsName)));
  function announcementStats(a) {
    const rs = a.recipients || [];
    const total = new Set(rs.map(r => r.id)).size;
    const read = new Set(rs.filter(r => r.readAt).map(r => r.id)).size;
    const ack = new Set(rs.filter(r => r.ackAt).map(r => r.id)).size;
    return { total, read, ack, pct: total ? Math.round((read / total) * 100) : 0, ackPct: total ? Math.round((ack / total) * 100) : 0 };
  }
  const canManageAnn = (user, a) => LEADERS.includes(user.role) || a.createdById === user.id;
  const annList = () => getAnnouncements();
  const saveAnnList = list => write(announcementsKey(school.id), list);

  function annValues(user, input, { forSend = false, emergency = false } = {}) {
    const errors = {};
    const spec = input.audienceSpec || {};
    const v = {
      title: clean(input.title).slice(0, 120), body: String(input.body || '').replace(/\r\n/g, '\n').trim().slice(0, 4000),
      category: ANN_CATEGORIES[input.category] ? input.category : 'general',
      audienceSpec: { mode: clean(spec.mode), classIds: [...new Set(spec.classIds || [])], familyIds: [...new Set(spec.familyIds || [])], staffIds: [...new Set(spec.staffIds || [])] },
      channels: [...new Set((input.channels || []).filter(c => ANN_CHANNELS[c]))], requireAck: Boolean(input.requireAck),
      attachments: [...new Set(input.attachments || [])], emergencyType: emergency ? (EMERGENCY_TYPES[input.emergencyType] ? input.emergencyType : 'other') : null
    };
    const aud = resolveAudience(user, v.audienceSpec);
    if (forSend) {
      if (!aud.count) errors.audience = 'Choose who should receive this — no one is selected.';
      if (!v.title) errors.title = 'Give the announcement a title.';
      if (!v.body) errors.body = 'Write the message.';
      if (!v.channels.length) errors.channels = 'Choose at least one delivery channel.';
      else if (v.channels.some(c => !ANN_CHANNELS[c].available)) errors.channels = `${v.channels.filter(c => !ANN_CHANNELS[c].available).map(c => ANN_CHANNELS[c].label).join(', ')} isn’t configured, so it can’t be used.`;
    }
    const files = read(chatFilesKey(school.id), []);
    if (v.attachments.some(id => !files.some(f => f.id === id))) errors.attachments = 'An attachment is missing. Remove it and attach it again.';
    return { v, aud, errors };
  }
  function upsertAnnouncement(user, id, patch) {
    const list = annList();
    const now = new Date().toISOString();
    let a = id ? list.find(x => x.id === id) : null;
    if (id && !a) return { error: 'missing' };
    if (a && !canManageAnn(user, a)) return { error: 'forbidden' };
    if (a && ['sent', 'sending', 'cancelled'].includes(a.status)) return { error: 'locked', status: a.status };
    if (a) Object.assign(a, patch, { updatedAt: now });
    else { a = { id: newId('an'), type: 'normal', recipients: [], reminders: [], createdBy: user.name, createdById: user.id, createdAt: now, updatedAt: now, ...patch }; list.unshift(a); }
    return { list, a };
  }

  function saveAnnouncementDraft(user, input, id = null) {
    if (!canAnnounce(user)) return settle({ ok: false, reason: 'forbidden' });
    const { v, aud, errors } = annValues(user, input);
    if (errors.attachments) return settle({ ok: false, reason: 'invalid', errors });
    const r = upsertAnnouncement(user, id, { ...v, audience: aud.label, status: 'draft', scheduledAt: null });
    if (r.error) return settle({ ok: false, reason: r.error, status: r.status });
    if (!saveAnnList(r.list)) return settle({ ok: false, reason: 'storage' });
    return settle({ ok: true, announcement: r.a });
  }
  function scheduleAnnouncement(user, input, id = null) {
    if (!canAnnounce(user)) return settle({ ok: false, reason: 'forbidden' });
    const { v, aud, errors } = annValues(user, input, { forSend: true });
    const at = new Date(input.scheduledAt || '');
    if (Number.isNaN(at.getTime())) errors.scheduledAt = 'Choose a date and time.';
    else if (at.getTime() <= Date.now() + 60000) errors.scheduledAt = 'Choose a time at least a minute from now.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const r = upsertAnnouncement(user, id, { ...v, audience: aud.label, status: 'scheduled', scheduledAt: at.toISOString() });
    if (r.error) return settle({ ok: false, reason: r.error, status: r.status });
    if (!saveAnnList(r.list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'schedule:announcement', r.a.id, r.a.title);
    return settle({ ok: true, announcement: r.a });
  }

  // Delivers to the audience as it is now (re-resolved), recording each recipient's result.
  function deliverAnnouncement(sender, a) {
    const aud = resolveAudience(sender, a.audienceSpec);
    if (!aud.count) return { error: 'no-recipients' };
    const app = getParentApp();
    const now = new Date().toISOString();
    a.recipients = aud.recipients.map(r => ({ ...r, delivery: { app: appDelivery(r, app) }, readAt: null, ackAt: null, reminders: [] }));
    Object.assign(a, { audience: aud.label, status: 'sent', sentAt: now, updatedAt: now });
    return { staffIds: aud.recipients.filter(r => r.kind === 'staff').map(r => r.userId) };
  }
  function notifyAnnouncement(sender, a, staffIds) {
    const classUsers = a.audienceSpec.mode === 'classes' ? educators.filter(e => e.userId && e.userId !== sender.id && a.audienceSpec.classIds.some(id => classById(id)?.staffIds.includes(e.id))).map(e => e.userId) : [];
    const ids = [...new Set([...staffIds, ...classUsers])].filter(id => id !== sender.id);
    if (ids.length) notifyUsers({ module: 'communication', kind: a.type === 'emergency' ? 'broadcast' : 'announcement', title: `${a.type === 'emergency' ? 'Emergency' : 'Announcement'}: ${a.title}`, body: `${a.audience} · from ${sender.name}`, recordType: 'announcement', recordId: a.id, severity: a.type === 'emergency' ? 'critical' : 'normal', dedupeKey: `announcement:${a.id}`, actorId: sender.id }, { toUserIds: ids });
  }
  function sendAnnouncement(user, input, id = null) {
    if (!canAnnounce(user)) return settle({ ok: false, reason: 'forbidden' });
    if (id) { const ex = annList().find(x => x.id === id); if (ex?.status === 'sent') return settle({ ok: true, announcement: ex, repeated: true }); }
    const { v, aud, errors } = annValues(user, input, { forSend: true });
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const r = upsertAnnouncement(user, id, { ...v, audience: aud.label, status: 'sending', scheduledAt: null });
    if (r.error) return settle({ ok: false, reason: r.error, status: r.status });
    const d = deliverAnnouncement(user, r.a);
    if (d.error) { Object.assign(r.a, { status: 'failed', failReason: 'No recipients' }); saveAnnList(r.list); return settle({ ok: false, reason: 'invalid', errors: { audience: 'No one is in this audience any more.' } }); }
    if (!saveAnnList(r.list)) return settle({ ok: false, reason: 'storage' });
    notifyAnnouncement(user, r.a, d.staffIds);
    logAudit(user, 'send:announcement', r.a.id, `${r.a.title} → ${r.a.audience}`);
    return settle({ ok: true, announcement: r.a });
  }
  function sendScheduledNow(user, id) {
    const list = annList();
    const a = list.find(x => x.id === id);
    if (!a) return settle({ ok: false, reason: 'missing' });
    if (!canManageAnn(user, a)) return settle({ ok: false, reason: 'forbidden' });
    if (a.status === 'sent') return settle({ ok: true, announcement: a, repeated: true });
    if (a.status !== 'scheduled') return settle({ ok: false, reason: 'locked', status: a.status });
    const d = deliverAnnouncement(user, a);
    if (d.error) { Object.assign(a, { status: 'failed', failReason: 'No recipients' }); saveAnnList(list); return settle({ ok: false, reason: 'no-recipients' }); }
    if (!saveAnnList(list)) return settle({ ok: false, reason: 'storage' });
    notifyAnnouncement(user, a, d.staffIds);
    logAudit(user, 'send:announcement', a.id, `${a.title} (sent before its scheduled time)`);
    return settle({ ok: true, announcement: a });
  }
  function cancelAnnouncement(user, id) {
    const list = annList();
    const a = list.find(x => x.id === id);
    if (!a) return settle({ ok: false, reason: 'missing' });
    if (!canManageAnn(user, a)) return settle({ ok: false, reason: 'forbidden' });
    if (a.status !== 'scheduled') return settle({ ok: false, reason: 'locked', status: a.status });
    Object.assign(a, { status: 'cancelled', cancelledAt: new Date().toISOString(), cancelledBy: user.name });
    if (!saveAnnList(list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'cancel:announcement', a.id, a.title);
    return settle({ ok: true });
  }
  function deleteAnnouncementDraft(user, id) {
    const list = annList();
    const a = list.find(x => x.id === id);
    if (!a) return settle({ ok: false, reason: 'missing' });
    if (!canManageAnn(user, a)) return settle({ ok: false, reason: 'forbidden' });
    if (a.status !== 'draft') return settle({ ok: false, reason: 'locked', status: a.status });
    return settle(saveAnnList(list.filter(x => x.id !== id)) ? { ok: true } : { ok: false, reason: 'storage' });
  }
  function duplicateAnnouncement(user, id) {
    const a = annList().find(x => x.id === id);
    if (!a) return settle({ ok: false, reason: 'missing' });
    if (!canAnnounce(user)) return settle({ ok: false, reason: 'forbidden' });
    return saveAnnouncementDraft(user, { title: `${a.title} (copy)`, body: a.body, category: a.category, audienceSpec: a.audienceSpec, channels: a.channels, requireAck: a.requireAck, attachments: [] });
  }
  // Runs on every page (shell ticker): sends scheduled announcements that are due, on behalf of their author.
  function processAnnouncements() {
    const list = annList();
    const due = list.filter(a => a.status === 'scheduled' && new Date(a.scheduledAt).getTime() <= Date.now());
    if (!due.length) return [];
    const done = [];
    due.forEach(a => {
      const author = staffUser(a.createdById);
      if (!author || !canAnnounce(author)) { Object.assign(a, { status: 'failed', failReason: 'The author can no longer send announcements' }); return; }
      const d = deliverAnnouncement(author, a);
      if (d.error) { Object.assign(a, { status: 'failed', failReason: 'No recipients' }); return; }
      done.push([author, a, d.staffIds]);
    });
    if (!saveAnnList(list)) return [];
    done.forEach(([u, a, ids]) => notifyAnnouncement(u, a, ids));
    return done.map(x => x[1]);
  }

  function markAnnouncementRead(user, id) {
    const list = annList();
    const a = list.find(x => x.id === id);
    const r = a?.recipients?.find(x => x.id === `staff:${user.id}`);
    if (!r || r.readAt) return false;
    r.readAt = new Date().toISOString();
    return saveAnnList(list);
  }
  // Acknowledging is separate from reading (an acknowledgement also counts as a read).
  function acknowledgeAnnouncement(user, id) {
    const list = annList();
    const a = list.find(x => x.id === id);
    const r = a?.recipients?.find(x => x.id === `staff:${user.id}`);
    if (!r) return settle({ ok: false, reason: 'forbidden' });
    if (!a.requireAck) return settle({ ok: false, reason: 'invalid' });
    const now = new Date().toISOString();
    if (!r.readAt) r.readAt = now;
    if (!r.ackAt) r.ackAt = now;
    return settle(saveAnnList(list) ? { ok: true } : { ok: false, reason: 'storage' });
  }
  // DEMO ONLY: families can't open announcements yet, so leaders can simulate family reads / acknowledgements.
  function simulateAnnouncementActivity(user, id, kind = 'read', share = 0.5) {
    if (!LEADERS.includes(user.role) || !messagingDemo()) return settle({ ok: false, reason: 'forbidden' });
    const list = annList();
    const a = list.find(x => x.id === id);
    if (!a || a.status !== 'sent') return settle({ ok: false, reason: 'missing' });
    if (kind === 'ack' && !a.requireAck) return settle({ ok: false, reason: 'invalid' });
    const now = new Date().toISOString();
    const pool = a.recipients.filter(r => r.kind === 'family' && (kind === 'read' ? !r.readAt : r.readAt && !r.ackAt));
    const picked = pool.slice(0, Math.max(1, Math.round(pool.length * share)));
    if (!pool.length) return settle({ ok: false, reason: 'none' });
    picked.forEach(r => { if (kind === 'read') Object.assign(r, { readAt: now, readDemo: true }); else Object.assign(r, { ackAt: now, ackDemo: true }); });
    return settle(saveAnnList(list) ? { ok: true, changed: picked.length } : { ok: false, reason: 'storage' });
  }
  let reminding = false;
  function remindUnread(user, id) {
    if (reminding) return settle({ ok: false, reason: 'busy' });
    const list = annList();
    const a = list.find(x => x.id === id);
    if (!a) return settle({ ok: false, reason: 'missing' });
    if (!canManageAnn(user, a)) return settle({ ok: false, reason: 'forbidden' });
    if (a.status !== 'sent') return settle({ ok: false, reason: 'locked' });
    const unread = a.recipients.filter(r => !r.readAt);
    if (!unread.length) return settle({ ok: false, reason: 'none' });
    reminding = true;
    const app = getParentApp();
    const now = new Date().toISOString();
    const since = Date.now() - 10 * 60000;
    let queued = 0;
    let skipped = 0;
    const staffIds = [];
    unread.forEach(r => {
      const recent = (r.reminders || []).some(x => new Date(x.at).getTime() >= since && !/^skipped/.test(x.result));
      const result = recent ? 'skipped: reminded in the last 10 minutes' : appDelivery(r, app);
      r.reminders = [...(r.reminders || []), { at: now, by: user.name, result }];
      if (/^skipped/.test(result)) skipped += 1; else { queued += 1; if (r.kind === 'staff') staffIds.push(r.userId); }
    });
    a.reminders = [...(a.reminders || []), { at: now, by: user.name, targeted: unread.length, queued, skipped }];
    const ok = saveAnnList(list);
    reminding = false;
    if (!ok) return settle({ ok: false, reason: 'storage' });
    if (staffIds.length) notifyUsers({ module: 'communication', kind: 'announcement', title: `Reminder: ${a.title}`, body: `From ${user.name}`, recordType: 'announcement', recordId: a.id, dedupeKey: `ann-remind:${a.id}:${now}`, actorId: user.id }, { toUserIds: staffIds });
    logAudit(user, 'remind:announcement', a.id, `${unread.length} unread · ${queued} reminded · ${skipped} skipped`);
    return settle({ ok: true, targeted: unread.length, queued, skipped });
  }

  // Emergency: leaders only, always immediate; the typed phrase is checked here too. Staff also get the S32 banner.
  let emergencySending = false;
  function sendEmergency(user, input, typed) {
    if (!canEmergency(user)) return settle({ ok: false, reason: 'forbidden' });
    if (typed !== EMERGENCY_PHRASE) return settle({ ok: false, reason: 'invalid', errors: { confirm: `Type ${EMERGENCY_PHRASE} exactly to send.` } });
    if (emergencySending) return settle({ ok: false, reason: 'busy' });
    const { v, aud, errors } = annValues(user, { ...input, requireAck: true }, { forSend: true, emergency: true });
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const list = annList();
    // A repeated submit (same sender, title and message within 30 s) returns the first broadcast instead of a second one.
    const dup = list.find(x => x.type === 'emergency' && x.createdById === user.id && x.title === v.title && x.body === v.body && Date.now() - new Date(x.createdAt).getTime() < 30000);
    if (dup) return settle({ ok: true, announcement: dup, repeated: true });
    emergencySending = true;
    const now = new Date().toISOString();
    const a = { id: newId('an'), ...v, type: 'emergency', category: 'safety', audience: aud.label, status: 'sending', scheduledAt: null, recipients: [], reminders: [], createdBy: user.name, createdById: user.id, createdAt: now, updatedAt: now };
    list.unshift(a);
    const d = deliverAnnouncement(user, a);
    const b = { id: newId('bc'), message: `${v.title}: ${v.body}`.slice(0, 280), createdAt: now, createdBy: user.id, createdByName: user.name, active: true, ackBy: [user.id], announcementId: a.id };
    const ok = !d.error && commit([{ key: announcementsKey(school.id), value: list }, { key: broadcastsKey(school.id), value: [b, ...getBroadcasts()] }]);
    emergencySending = false;
    if (!ok) return settle({ ok: false, reason: d.error ? 'invalid' : 'storage', errors: d.error ? { audience: 'No one is in this audience.' } : undefined });
    events.broadcast(user, b);
    notifyAnnouncement(user, a, d.staffIds);
    logAudit(user, 'send:emergency', a.id, `${EMERGENCY_TYPES[v.emergencyType]}: ${v.title} → ${a.audience}`);
    return settle({ ok: true, announcement: a });
  }

  // The dashboard quick-action form: posts straight to one audience name.
  function postAnnouncement(user, data) {
    if (!canAnnounce(user)) return settle({ ok: false, reason: 'forbidden' });
    const name = data.audience;
    if (!clean(data.title) || !clean(data.body) || !audiences().includes(name)) return settle({ ok: false, reason: 'invalid' });
    const cls = activeClasses().find(c => c.name === name);
    const lead = LEADERS.includes(user.role);
    const spec = name === 'All families' ? (lead ? { mode: 'all' } : { mode: 'classes', classIds: activeClasses().filter(c => classScope(user).includes(c.name)).map(c => c.id) })
      : name === 'All staff' ? { mode: 'staff', staffIds: users.filter(u => u.schoolId === school.id && u.id !== user.id).map(u => u.id) }
      : { mode: 'classes', classIds: [cls.id] };
    return sendAnnouncement(user, { title: data.title, body: data.body, category: 'general', audienceSpec: spec, channels: ['app'], requireAck: false });
  }

  /* Forms, permissions & acknowledgements (forms.js at ?page=forms)
     `nexora-forms:<school>` { id, title, description, intro, type: survey|permission|acknowledgement, questions: [Question],
       status: draft|open|closed, version, audienceSpec: { mode: all|classes|families, classIds, familyIds }, respondent: any|primary,
       requireSignature, dueAt, recipients: [{ id: 'fam:<familyId>', familyId, name, children, classes, guardianIds, delivery,
       reminders, removed }], reminders, createdBy, createdById, createdAt, updatedAt, publishedAt, closedAt, reopenedAt, demo }
     Question { id, type, label, help, required, options: [{ id, label }], scale: { low, high }, accept: ['image'|'pdf'], maxKB,
       statement, logic: { join: 'all'|'any', rules: [{ q, op, value }] } } — a rule may only use an earlier question, so
       there can be no self-reference or cycle.
     Questions are frozen when a form is published (version 1); duplicate a published form to change it.
     `nexora-form-responses:<school>` { id, formId, version, familyId, guardianId, guardianName, children, answers: { qid: value },
       signatures: { qid: { fileId, name, at } }, submittedAt, demo } — one per family. Answers to questions hidden by
       conditional logic are dropped on submit: only what the family was shown is kept.
     `nexora-form-files:<school>` uploads and signature images (device-local, ≤ 1 MB), readable only by people who can see
       the form's results. Families have no app: responses are entered in the labelled demo parent view, publishing and
       reminders are recorded as queued (demo) or skipped, never as delivered. */
  const formsKey = id => `nexora-forms:${id}`;
  const formResponsesKey = id => `nexora-form-responses:${id}`;
  const formFilesKey = id => `nexora-form-files:${id}`;
  const FORM_TYPES = { survey: 'Survey', permission: 'Permission', acknowledgement: 'Acknowledgement' };
  const FORM_STATUSES = { draft: 'Draft', open: 'Open', closed: 'Closed' };
  const FORM_QTYPES = { short: 'Short text', long: 'Long text', single: 'Single choice', multi: 'Multiple choice', rating: 'Rating 1–5', date: 'Date', yesno: 'Yes/No', file: 'File upload', signature: 'Electronic signature' };
  const FORM_OPS = { eq: 'is', neq: 'is not', includes: 'includes', excludes: 'doesn’t include', gte: 'is at least', lte: 'is at most', answered: 'is answered', empty: 'is not answered' };
  const FORM_OPS_FOR = { yesno: ['eq', 'neq'], single: ['eq', 'neq'], multi: ['includes', 'excludes'], rating: ['eq', 'gte', 'lte'], short: ['answered', 'empty'], long: ['answered', 'empty'], date: ['answered', 'empty'], file: ['answered', 'empty'], signature: ['answered', 'empty'] };
  const FORM_FILE_TYPES = { image: ['image/jpeg', 'image/png', 'image/webp'], pdf: ['application/pdf'] };
  const SIGN_STATEMENT = { permission: 'I give permission for my child to take part, as described above.', acknowledgement: 'I confirm I have read and understood this information.', survey: 'I confirm these answers are correct.' };
  const canManageForms = user => can(user, 'forms');
  const canManageForm = (user, f) => LEADERS.includes(user.role) || f.createdById === user.id;
  const formChoice = t => t === 'single' || t === 'multi';

  function newFormQuestion(type, formType = 'survey') {
    const q = { id: newId('q'), type, label: '', help: '', required: false, logic: { join: 'all', rules: [] } };
    if (formChoice(type)) q.options = [{ id: newId('o'), label: 'Option 1' }, { id: newId('o'), label: 'Option 2' }];
    if (type === 'rating') q.scale = { low: 'Poor', high: 'Excellent' };
    if (type === 'file') Object.assign(q, { accept: ['image', 'pdf'], maxKB: 1024 });
    if (type === 'signature') Object.assign(q, { label: 'Guardian signature', required: true, statement: SIGN_STATEMENT[formType] || SIGN_STATEMENT.survey });
    return q;
  }
  const formAnswered = (q, v) => (q.type === 'multi' || q.type === 'file' ? Array.isArray(v) && v.length > 0 : q.type === 'signature' ? Boolean(v && v.fileId) : q.type === 'rating' ? Number(v) >= 1 : String(v ?? '').trim() !== '');
  function formRuleTrue(r, src, v) {
    const has = formAnswered(src, v);
    switch (r.op) {
      case 'answered': return has;
      case 'empty': return !has;
      case 'eq': return has && (src.type === 'rating' ? Number(v) === Number(r.value) : v === r.value);
      case 'neq': return has && (src.type === 'rating' ? Number(v) !== Number(r.value) : v !== r.value);
      case 'includes': return has && v.includes(r.value);
      case 'excludes': return has && !v.includes(r.value);
      case 'gte': return has && Number(v) >= Number(r.value);
      case 'lte': return has && Number(v) <= Number(r.value);
      default: return false;
    }
  }
  // Evaluated in order: a rule whose source question is itself hidden is false.
  function visibleFormQuestions(questions, answers = {}) {
    const shown = new Set();
    questions.forEach((q, i) => {
      const rules = (q.logic?.rules || []).filter(r => r.q);
      if (!rules.length) { shown.add(q.id); return; }
      const res = rules.map(r => { const src = questions.slice(0, i).find(x => x.id === r.q); return Boolean(src && shown.has(src.id) && formRuleTrue(r, src, answers[src.id])); });
      if (q.logic.join === 'any' ? res.some(Boolean) : res.every(Boolean)) shown.add(q.id);
    });
    return shown;
  }
  // Problems that stop a form being published, per question.
  function formIssues(f) {
    const issues = [];
    const errors = {};
    if (!clean(f.title)) errors.title = 'Give the form a title.';
    if (!f.questions.length) errors.questions = 'Add at least one question.';
    f.questions.forEach((q, i) => {
      const add = msg => issues.push({ qid: q.id, n: i + 1, msg });
      if (!clean(q.label)) add('Write the question.');
      if (formChoice(q.type)) {
        const labels = q.options.map(o => clean(o.label).toLowerCase());
        if (labels.filter(Boolean).length < 2) add('Give at least two options.');
        else if (labels.some(l => !l)) add('An option is empty.');
        else if (new Set(labels).size !== labels.length) add('Two options have the same text.');
      }
      (q.logic?.rules || []).forEach(r => {
        const src = f.questions.slice(0, i).find(x => x.id === r.q);
        if (!r.q) add('A “Show if” rule has no question chosen.');
        else if (!src) add('A “Show if” rule uses a question that isn’t above this one.');
        else if (!FORM_OPS_FOR[src.type].includes(r.op)) add('A “Show if” rule has an invalid comparison.');
        else if (!['answered', 'empty'].includes(r.op) && (r.value === '' || r.value == null || (formChoice(src.type) && !src.options.some(o => o.id === r.value)))) add('A “Show if” rule has no answer chosen.');
      });
    });
    if (issues.length) errors.questions = errors.questions || `${issues.length} question ${issues.length === 1 ? 'needs' : 'need'} attention.`;
    return { errors, issues };
  }
  function formValues(input) {
    const type = FORM_TYPES[input.type] ? input.type : 'survey';
    const questions = (Array.isArray(input.questions) ? input.questions : []).slice(0, 60).filter(q => FORM_QTYPES[q?.type]).map(q => {
      const out = { id: clean(q.id) || newId('q'), type: q.type, label: String(q.label || '').slice(0, 300), help: String(q.help || '').slice(0, 500), required: Boolean(q.required) };
      if (formChoice(q.type)) out.options = (q.options || []).slice(0, 20).map(o => ({ id: clean(o.id) || newId('o'), label: String(o.label || '').slice(0, 120) }));
      if (q.type === 'rating') out.scale = { low: String(q.scale?.low || '').slice(0, 40), high: String(q.scale?.high || '').slice(0, 40) };
      if (q.type === 'file') { out.accept = ['image', 'pdf'].filter(k => (q.accept || []).includes(k)); if (!out.accept.length) out.accept = ['image', 'pdf']; out.maxKB = Math.min(1024, Math.max(100, Number(q.maxKB) || 1024)); }
      if (q.type === 'signature') out.statement = String(q.statement || '').slice(0, 600);
      const rules = (q.logic?.rules || []).slice(0, 5).map(r => ({ q: clean(r.q), op: FORM_OPS[r.op] ? r.op : 'eq', value: r.value == null ? '' : String(r.value) }));
      out.logic = { join: q.logic?.join === 'any' ? 'any' : 'all', rules };
      return out;
    });
    return { title: String(input.title || '').trim().slice(0, 120), description: String(input.description || '').slice(0, 2000), intro: String(input.intro || '').slice(0, 1000), type, questions };
  }

  // Families this user may address. Teachers: only families with a child in their classes.
  function formTargets(user) {
    const lead = LEADERS.includes(user.role);
    const scope = classScope(user);
    const fams = listFamilies().map(f => ({ ...f, active: f.children.filter(c => c.status === 'active') })).filter(f => f.active.length && (lead || f.active.some(c => scope.includes(c.cls))));
    return {
      classes: activeClasses().filter(c => lead || scope.includes(c.name)).map(c => ({ id: c.id, name: c.name, families: fams.filter(f => f.active.some(k => k.cls === c.name)).length })),
      families: fams.map(f => ({ id: f.id, name: f.name, children: f.active.map(c => c.name), classes: [...new Set(f.active.map(c => c.cls))], guardians: f.guardians.length, primary: f.primary?.name || '' })),
      canAll: lead
    };
  }
  function resolveFormAudience(user, spec = {}, respondent = 'any') {
    const t = formTargets(user);
    const fams = listFamilies();
    let ids = [];
    let classNames = [];
    if (spec.mode === 'all' && t.canAll) ids = t.families.map(f => f.id);
    else if (spec.mode === 'classes') { classNames = (spec.classIds || []).map(id => t.classes.find(c => c.id === id)?.name).filter(Boolean); ids = t.families.filter(f => f.classes.some(c => classNames.includes(c))).map(f => f.id); }
    else if (spec.mode === 'families') ids = (spec.familyIds || []).filter(id => t.families.some(f => f.id === id));
    ids = [...new Set(ids)];
    const noGuardian = [];
    const recipients = [];
    ids.forEach(id => {
      const f = fams.find(x => x.id === id);
      const kids = f.children.filter(c => c.status === 'active' && (spec.mode !== 'classes' || classNames.includes(c.cls)));
      const guardianIds = respondent === 'primary' ? (f.primary ? [f.primary.id] : []) : f.guardians.map(g => g.id);
      if (!guardianIds.length) { noGuardian.push(f.name); return; }
      recipients.push({ id: `fam:${f.id}`, familyId: f.id, name: f.name, children: kids.map(c => c.name), classes: [...new Set(kids.map(c => c.cls))], guardianIds });
    });
    const n = recipients.length;
    const unit = `${n} ${n === 1 ? 'family' : 'families'}`;
    const label = spec.mode === 'all' ? `All families · ${unit}` : spec.mode === 'classes' ? `${classNames.join(' + ') || 'No classes'} · ${unit}` : spec.mode === 'families' ? `Selected families · ${unit}` : 'No audience';
    let why = '';
    if (!n) why = spec.mode === 'classes' && !classNames.length ? 'Choose at least one class.' : spec.mode === 'families' && !ids.length ? 'Choose at least one family.' : spec.mode === 'all' && !t.canAll ? 'Only leaders can send to all families.' : noGuardian.length ? 'None of these families has a guardian on record who can respond.' : 'No enrolled families are in this selection.';
    return { recipients, count: n, label, classNames, noGuardian, why };
  }

  function seedForms() {
    const fams = listFamilies().filter(f => f.children.some(c => c.status === 'active') && f.guardians.length);
    const cls = activeClasses();
    const inCls = names => fams.filter(f => f.children.some(c => c.status === 'active' && names.includes(c.cls)));
    const rec = (f, names) => { const kids = f.children.filter(c => c.status === 'active' && (!names || names.includes(c.cls))); return { id: `fam:${f.id}`, familyId: f.id, name: f.name, children: kids.map(c => c.name), classes: [...new Set(kids.map(c => c.cls))], guardianIds: f.guardians.map(g => g.id), delivery: 'queued (demo — not delivered)', reminders: [], removed: false }; };
    const by = { createdBy: 'Mrs. Rao', createdById: (users.find(u => u.schoolId === school.id && u.role === 'Director') || users[0]).id, demo: true };
    const twoCls = cls.slice(0, 2).map(c => c.name);
    const walkQ = [
      { id: 'qw1', type: 'yesno', label: 'Will your child join the nature walk?', help: '', required: true, logic: { join: 'all', rules: [] } },
      { id: 'qw2', type: 'yesno', label: 'Does your child have any allergies we should know about for the day?', help: 'Pollen, insect stings, foods.', required: true, logic: { join: 'all', rules: [{ q: 'qw1', op: 'eq', value: 'yes' }] } },
      { id: 'qw3', type: 'long', label: 'Please describe the allergy and what we should do.', help: '', required: true, logic: { join: 'all', rules: [{ q: 'qw2', op: 'eq', value: 'yes' }] } },
      { id: 'qw4', type: 'signature', label: 'Guardian signature', help: '', required: true, statement: SIGN_STATEMENT.permission, logic: { join: 'all', rules: [{ q: 'qw1', op: 'eq', value: 'yes' }] } }
    ];
    const fbQ = [
      { id: 'qf1', type: 'rating', label: 'How settled is your child at school this term?', help: '', required: true, scale: { low: 'Not settled', high: 'Very settled' }, logic: { join: 'all', rules: [] } },
      { id: 'qf2', type: 'single', label: 'How do you prefer to hear from us?', help: '', required: true, options: [{ id: 'of1', label: 'Parent app' }, { id: 'of2', label: 'Email' }, { id: 'of3', label: 'Phone call' }], logic: { join: 'all', rules: [] } },
      { id: 'qf3', type: 'multi', label: 'Which workshops would you attend?', help: 'Choose any.', required: false, options: [{ id: 'om1', label: 'Montessori at home' }, { id: 'om2', label: 'Early reading' }, { id: 'om3', label: 'Healthy lunches' }], logic: { join: 'all', rules: [] } },
      { id: 'qf4', type: 'long', label: 'Anything else you’d like to tell us?', help: '', required: false, logic: { join: 'all', rules: [] } }
    ];
    const walkRecs = inCls(twoCls).map(f => rec(f, twoCls));
    const fbRecs = fams.map(f => rec(f));
    const forms = [
      { id: 'fm-walk', title: 'Nature walk to Cubbon Park', description: 'We’ll walk to the park with the children on Friday morning, returning before lunch. Teachers and two volunteer parents will accompany them.', intro: 'Please reply for each family by the due date.', type: 'permission', questions: walkQ, status: 'open', version: 1, audience: `${twoCls.join(' + ')} · ${walkRecs.length} families`, audienceSpec: { mode: 'classes', classIds: cls.slice(0, 2).map(c => c.id), familyIds: [] }, respondent: 'any', requireSignature: true, dueAt: atToday(17, 0, 5), recipients: walkRecs, reminders: [], createdAt: atToday(9, 0, -2), updatedAt: atToday(9, 30, -2), publishedAt: atToday(9, 30, -2), closedAt: null, ...by },
      { id: 'fm-feedback', title: 'Term 1 parent feedback', description: 'Ten quiet minutes to tell us how the term went.', intro: '', type: 'survey', questions: fbQ, status: 'closed', version: 1, audience: `All families · ${fbRecs.length} families`, audienceSpec: { mode: 'all', classIds: [], familyIds: [] }, respondent: 'any', requireSignature: false, dueAt: atToday(17, 0, -3), recipients: fbRecs, reminders: [], createdAt: atToday(9, 0, -20), updatedAt: atToday(17, 0, -3), publishedAt: atToday(10, 0, -20), closedAt: atToday(17, 5, -3), ...by },
      { id: 'fm-policy', title: 'Updated sick-child policy', description: 'Children with a fever must stay home for 24 hours after it passes.', intro: '', type: 'acknowledgement', questions: [{ id: 'qp1', type: 'signature', label: 'Guardian signature', help: '', required: true, statement: SIGN_STATEMENT.acknowledgement, logic: { join: 'all', rules: [] } }], status: 'draft', version: 0, audienceSpec: { mode: 'all', classIds: [], familyIds: [] }, respondent: 'any', requireSignature: true, dueAt: null, recipients: [], reminders: [], createdAt: atToday(15, 0, -1), updatedAt: atToday(15, 0, -1), publishedAt: null, closedAt: null, ...by }
    ];
    const sig = name => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120"><path d="M20 80 C 60 20, 90 110, 130 60 S 200 30, 230 75 S 300 90, 340 50" fill="none" stroke="#1d2b25" stroke-width="3" stroke-linecap="round"/><text x="20" y="112" font-family="sans-serif" font-size="12" fill="#66736b">${name.replace(/[<&>]/g, '')} (demo)</text></svg>`)}`;
    const files = [];
    const responses = [];
    walkRecs.slice(0, Math.ceil(walkRecs.length * 0.4)).forEach((r, i) => {
      const f = fams.find(x => x.id === r.familyId);
      const g = f.primary || f.guardians[0];
      const at = atToday(10 + (i % 6), 5 * i % 60, -1);
      const joins = i % 5 !== 3;
      const allergy = joins && i % 4 === 1;
      const answers = { qw1: joins ? 'yes' : 'no' };
      const signatures = {};
      if (joins) {
        answers.qw2 = allergy ? 'yes' : 'no';
        if (allergy) answers.qw3 = 'Mild pollen allergy — antihistamine is in the class bag.';
        const fid = `ff-seed-${i}`;
        files.push({ id: fid, formId: 'fm-walk', qid: 'qw4', kind: 'signature', name: 'signature.svg', mime: 'image/svg+xml', size: 600, data: sig(g.name), at, responseId: `fr-seed-w${i}`, demo: true });
        answers.qw4 = { fileId: fid };
        signatures.qw4 = { fileId: fid, name: g.name, at };
      }
      responses.push({ id: `fr-seed-w${i}`, formId: 'fm-walk', version: 1, familyId: f.id, guardianId: g.id, guardianName: g.name, children: r.children, answers, signatures, submittedAt: at, demo: true });
    });
    const comments = ['Lovely first term — thank you!', '', 'More photos in the diary would be great.', '', 'Could pickup be a little later on Fridays?'];
    fbRecs.slice(0, Math.ceil(fbRecs.length * 0.62)).forEach((r, i) => {
      const f = fams.find(x => x.id === r.familyId);
      const g = f.primary || f.guardians[0];
      const answers = { qf1: [5, 4, 4, 3, 5, 4, 2][i % 7], qf2: ['of1', 'of1', 'of2', 'of3', 'of1'][i % 5], qf3: [['om1'], ['om1', 'om2'], [], ['om3'], ['om2', 'om3']][i % 5] };
      if (comments[i % 5]) answers.qf4 = comments[i % 5];
      if (!answers.qf3.length) delete answers.qf3;
      responses.push({ id: `fr-seed-f${i}`, formId: 'fm-feedback', version: 1, familyId: f.id, guardianId: g.id, guardianName: g.name, children: r.children, answers, signatures: {}, submittedAt: atToday(9 + (i % 8), (7 * i) % 60, -18 + (i % 14)), demo: true });
    });
    return { forms, responses, files };
  }
  function getForms() {
    const saved = read(formsKey(school.id), null);
    if (saved) return saved;
    const s = seedForms();
    try {
      localStorage.setItem(formsKey(school.id), JSON.stringify(s.forms));
      localStorage.setItem(formResponsesKey(school.id), JSON.stringify(s.responses));
      localStorage.setItem(formFilesKey(school.id), JSON.stringify(s.files));
    } catch { /* storage blocked: in memory */ }
    return s.forms;
  }
  const getFormResponses = () => { getForms(); return read(formResponsesKey(school.id), []); };
  const getFormFiles = () => read(formFilesKey(school.id), []);
  const saveForms = list => write(formsKey(school.id), list);
  // Overdue: still open but past its due date, so no new responses are accepted.
  const formOverdue = f => f.status === 'open' && f.dueAt && new Date(f.dueAt).getTime() < Date.now();
  const formAccepting = f => f.status === 'open' && !formOverdue(f);

  // What this user may see of a form: leaders and the creator see everything; other class staff see the families in
  // their classes only (read-only).
  function formAccess(user, f) {
    if (!f || !canAccess(user, 'forms')) return null;
    const manage = canManageForm(user, f);
    if (manage) return { manage, all: true };
    if (f.status === 'draft') return null;
    const scope = classScope(user);
    return (f.recipients || []).some(r => r.classes.some(c => scope.includes(c))) ? { manage: false, all: false, scope } : null;
  }
  const listForms = user => getForms().filter(f => formAccess(user, f));
  function formView(user, id) {
    const f = getForms().find(x => x.id === id);
    const acc = formAccess(user, f);
    if (!acc) return { error: f ? 'forbidden' : 'missing' };
    const inScope = r => acc.all || r.classes.some(c => acc.scope.includes(c));
    const recipients = (f.recipients || []).filter(inScope);
    const ids = new Set(recipients.map(r => r.familyId));
    const responses = getFormResponses().filter(r => r.formId === f.id && ids.has(r.familyId));
    return { form: f, manage: acc.manage, scoped: !acc.all, recipients, responses, stats: formStats(f, recipients, responses) };
  }
  function formStats(f, recipients = f.recipients || [], responses = null) {
    const rs = responses || getFormResponses().filter(r => r.formId === f.id);
    const live = recipients.filter(r => !r.removed);
    const liveIds = new Set(live.map(r => r.familyId));
    const done = new Set(rs.filter(r => liveIds.has(r.familyId)).map(r => r.familyId));
    const eligible = live.length;
    const received = done.size;
    const hasSig = f.questions.some(q => q.type === 'signature');
    const signed = new Set(rs.filter(r => liveIds.has(r.familyId) && Object.keys(r.signatures || {}).length).map(r => r.familyId)).size;
    return { eligible, received, pending: eligible - received, pct: eligible ? Math.round((received / eligible) * 100) : 0, hasSig, signed, sigPct: eligible ? Math.round((signed / eligible) * 100) : 0 };
  }

  function saveFormDraft(user, input, id = null) {
    if (!canManageForms(user)) return settle({ ok: false, reason: 'forbidden' });
    const v = formValues(input);
    const list = getForms();
    const now = new Date().toISOString();
    let f = id ? list.find(x => x.id === id) : null;
    if (id && !f) return settle({ ok: false, reason: 'missing' });
    if (f && !canManageForm(user, f)) return settle({ ok: false, reason: 'forbidden' });
    if (f && f.status !== 'draft') return settle({ ok: false, reason: 'locked' });
    if (f) Object.assign(f, v, { updatedAt: now });
    else { f = { id: newId('fm'), ...v, status: 'draft', version: 0, audienceSpec: { mode: LEADERS.includes(user.role) ? 'all' : 'classes', classIds: [], familyIds: [] }, respondent: 'any', requireSignature: v.type !== 'survey', dueAt: null, recipients: [], reminders: [], createdBy: user.name, createdById: user.id, createdAt: now, updatedAt: now, publishedAt: null, closedAt: null }; list.unshift(f); }
    if (!saveForms(list)) return settle({ ok: false, reason: 'storage' });
    return settle({ ok: true, form: f });
  }
  function deleteForm(user, id) {
    const list = getForms();
    const f = list.find(x => x.id === id);
    if (!f) return settle({ ok: false, reason: 'missing' });
    if (!canManageForm(user, f)) return settle({ ok: false, reason: 'forbidden' });
    if (f.status !== 'draft') return settle({ ok: false, reason: 'locked' });
    if (!saveForms(list.filter(x => x.id !== id))) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'delete:form', id, f.title);
    return settle({ ok: true });
  }
  function duplicateForm(user, id) {
    const f = getForms().find(x => x.id === id);
    if (!f || !formAccess(user, f)) return settle({ ok: false, reason: 'missing' });
    const map = {};
    const questions = f.questions.map(q => { map[q.id] = newId('q'); return q; }).map(q => ({ ...JSON.parse(JSON.stringify(q)), id: map[q.id], logic: { join: q.logic?.join || 'all', rules: (q.logic?.rules || []).map(r => ({ ...r, q: map[r.q] || '' })) } }));
    return saveFormDraft(user, { title: `${f.title} (copy)`.slice(0, 120), description: f.description, intro: f.intro, type: f.type, questions });
  }

  function publishForm(user, id, opts = {}) {
    const list = getForms();
    const f = list.find(x => x.id === id);
    if (!f) return settle({ ok: false, reason: 'missing' });
    if (!canManageForm(user, f)) return settle({ ok: false, reason: 'forbidden' });
    if (f.status !== 'draft') return settle({ ok: false, reason: 'locked' });
    const { errors, issues } = formIssues(f);
    const respondent = opts.respondent === 'primary' ? 'primary' : 'any';
    const spec = { mode: clean(opts.audienceSpec?.mode), classIds: [...new Set(opts.audienceSpec?.classIds || [])], familyIds: [...new Set(opts.audienceSpec?.familyIds || [])] };
    const aud = resolveFormAudience(user, spec, respondent);
    if (!aud.count) errors.audience = aud.why;
    const due = new Date(opts.dueAt || '');
    if (Number.isNaN(due.getTime())) errors.dueAt = 'Choose a due date and time.';
    else if (due.getTime() <= Date.now() + 60 * 60000) errors.dueAt = 'The due date must be at least an hour from now.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors, issues });
    const requireSignature = Boolean(opts.requireSignature);
    if (requireSignature && !f.questions.some(q => q.type === 'signature')) f.questions.push(newFormQuestion('signature', f.type));
    const app = getParentApp();
    const now = new Date().toISOString();
    f.recipients = aud.recipients.map(r => ({ ...r, delivery: appDelivery({ ...r, kind: 'family' }, app), reminders: [], removed: false }));
    Object.assign(f, { status: 'open', version: 1, audienceSpec: spec, audience: aud.label, respondent, requireSignature, dueAt: due.toISOString(), publishedAt: now, updatedAt: now, closedAt: null });
    if (!saveForms(list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'publish:form', f.id, `${f.title} → ${aud.label}`);
    const queued = f.recipients.filter(r => /^queued/.test(r.delivery)).length;
    return settle({ ok: true, form: f, queued, skipped: f.recipients.length - queued });
  }
  function closeForm(user, id) {
    const list = getForms();
    const f = list.find(x => x.id === id);
    if (!f) return settle({ ok: false, reason: 'missing' });
    if (!canManageForm(user, f)) return settle({ ok: false, reason: 'forbidden' });
    if (f.status !== 'open') return settle({ ok: false, reason: 'locked' });
    Object.assign(f, { status: 'closed', closedAt: new Date().toISOString(), closedBy: user.name, updatedAt: new Date().toISOString() });
    if (!saveForms(list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'close:form', f.id, f.title);
    return settle({ ok: true });
  }
  // Reopens a closed (or past-due) form with a new due date. The audience is checked again: families no longer
  // eligible are marked removed (their responses are kept but no longer counted); newly eligible families are added.
  function reopenForm(user, id, dueAt) {
    const list = getForms();
    const f = list.find(x => x.id === id);
    if (!f) return settle({ ok: false, reason: 'missing' });
    if (!canManageForm(user, f)) return settle({ ok: false, reason: 'forbidden' });
    if (!(f.status === 'closed' || formOverdue(f))) return settle({ ok: false, reason: 'locked' });
    const due = new Date(dueAt || '');
    if (Number.isNaN(due.getTime()) || due.getTime() <= Date.now() + 60 * 60000) return settle({ ok: false, reason: 'invalid', errors: { dueAt: 'Choose a new due date at least an hour from now.' } });
    const aud = resolveFormAudience(user, f.audienceSpec, f.respondent);
    const app = getParentApp();
    const now_ = aud.recipients.map(r => { const old = f.recipients.find(x => x.familyId === r.familyId); return { ...r, delivery: old?.delivery || appDelivery({ ...r, kind: 'family' }, app), reminders: old?.reminders || [], removed: false }; });
    const oldIds = new Set(f.recipients.map(r => r.familyId));
    const gone = f.recipients.filter(r => !aud.recipients.some(x => x.familyId === r.familyId)).map(r => ({ ...r, removed: true }));
    const now = new Date().toISOString();
    Object.assign(f, { recipients: [...now_, ...gone], status: 'open', dueAt: due.toISOString(), closedAt: null, reopenedAt: now, updatedAt: now, audience: aud.label });
    if (!saveForms(list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'reopen:form', f.id, `${f.title} until ${f.dueAt}`);
    return settle({ ok: true, form: f, added: now_.filter(r => !oldIds.has(r.familyId)).length, removed: gone.length });
  }
  function remindFormNonResponders(user, id) {
    const list = getForms();
    const f = list.find(x => x.id === id);
    if (!f) return settle({ ok: false, reason: 'missing' });
    if (!canManageForm(user, f)) return settle({ ok: false, reason: 'forbidden' });
    if (!formAccepting(f)) return settle({ ok: false, reason: 'closed' });
    const done = new Set(getFormResponses().filter(r => r.formId === f.id).map(r => r.familyId));
    const pending = f.recipients.filter(r => !r.removed && !done.has(r.familyId));
    if (!pending.length) return settle({ ok: false, reason: 'none' });
    const app = getParentApp();
    const now = new Date().toISOString();
    const since = Date.now() - 10 * 60000;
    let queued = 0;
    let skipped = 0;
    pending.forEach(r => {
      const recent = (r.reminders || []).some(x => new Date(x.at).getTime() >= since && !/^skipped/.test(x.result));
      const result = recent ? 'skipped: reminded in the last 10 minutes' : appDelivery({ ...r, kind: 'family' }, app);
      r.reminders = [...(r.reminders || []), { at: now, by: user.name, result }];
      if (/^skipped/.test(result)) skipped += 1; else queued += 1;
    });
    f.reminders = [...(f.reminders || []), { at: now, by: user.name, targeted: pending.length, queued, skipped }];
    if (!saveForms(list)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'remind:form', f.id, `${pending.length} pending · ${queued} reminded · ${skipped} skipped`);
    return settle({ ok: true, targeted: pending.length, queued, skipped });
  }

  // Files for one question of an open form: type and size are checked against the question and the file's content.
  function uploadFormFile(user, formId, qid, { name, mime, size, data }) {
    if (!canAccess(user, 'forms')) return settle({ ok: false, reason: 'forbidden' });
    const f = getForms().find(x => x.id === formId);
    const q = f?.questions.find(x => x.id === qid);
    if (!q || !['file', 'signature'].includes(q.type)) return settle({ ok: false, reason: 'missing' });
    if (!formAccepting(f)) return settle({ ok: false, reason: 'closed', errors: { file: 'This form isn’t accepting responses.' } });
    const allowed = q.type === 'signature' ? ['image/png'] : q.accept.flatMap(k => FORM_FILE_TYPES[k]);
    const sig = CHAT_FILE_SIGNATURES[mime];
    const body = String(data || '').split(',')[1] || '';
    const label = q.accept?.length === 1 ? (q.accept[0] === 'pdf' ? 'a PDF' : 'an image (JPEG, PNG, WebP)') : 'an image (JPEG, PNG, WebP) or a PDF';
    if (!allowed.includes(mime) || !sig || !String(data).startsWith(`data:${mime};base64,`) || !body.startsWith(sig)) return settle({ ok: false, reason: 'invalid', errors: { file: q.type === 'signature' ? 'The signature couldn’t be read. Clear it and sign again.' : `Attach ${label}.` } });
    const max = q.type === 'signature' ? 300 * 1024 : q.maxKB * 1024;
    if (!(Number(size) > 0) || Number(size) > max || body.length > max * 1.4) return settle({ ok: false, reason: 'invalid', errors: { file: `Files must be ${Math.round(max / 1024)} KB or less.` } });
    const file = { id: newId('ff'), formId, qid, kind: q.type, name: clean(name).slice(0, 120) || 'File', mime, size: Number(size), data, at: new Date().toISOString(), responseId: null, uploadedBy: user.id };
    if (!write(formFilesKey(school.id), [...getFormFiles(), file])) return settle({ ok: false, reason: 'storage', errors: { file: 'There isn’t room on this device for this file.' } });
    return settle({ ok: true, file: { id: file.id, name: file.name, mime, size: file.size } });
  }
  function formFile(user, fileId) {
    const file = getFormFiles().find(x => x.id === fileId);
    if (!file) return null;
    if (!file.responseId) return file.uploadedBy === user.id ? file : null;
    const v = formView(user, file.formId);
    return !v.error && v.responses.some(r => r.id === file.responseId) ? file : null;
  }

  function formAnswerError(q, v) {
    if (q.type === 'short' && String(v).length > 300) return 'Keep this under 300 characters.';
    if (q.type === 'long' && String(v).length > 4000) return 'Keep this under 4,000 characters.';
    if (q.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(new Date(`${v}T12:00:00`).getTime()))) return 'Enter a valid date.';
    if (q.type === 'rating' && !(Number.isInteger(Number(v)) && v >= 1 && v <= 5)) return 'Choose a rating from 1 to 5.';
    if (q.type === 'yesno' && !['yes', 'no'].includes(v)) return 'Choose Yes or No.';
    if (q.type === 'single' && !q.options.some(o => o.id === v)) return 'Choose one of the options.';
    if (q.type === 'multi' && (!Array.isArray(v) || v.some(x => !q.options.some(o => o.id === x)))) return 'Choose from the options.';
    return '';
  }
  // A family's submission (entered in the demo parent view). Validates only what's visible; drops hidden answers.
  function submitFormResponse(user, formId, { familyId, guardianId, answers = {} } = {}) {
    if (!canAccess(user, 'forms')) return settle({ ok: false, reason: 'forbidden' });
    const list = getForms();
    const f = list.find(x => x.id === formId);
    if (!f) return settle({ ok: false, reason: 'missing' });
    if (f.status === 'closed') return settle({ ok: false, reason: 'closed' });
    if (f.status !== 'open') return settle({ ok: false, reason: 'missing' });
    if (formOverdue(f)) return settle({ ok: false, reason: 'overdue' });
    const r = f.recipients.find(x => x.familyId === familyId && !x.removed);
    if (!r) return settle({ ok: false, reason: 'ineligible' });
    if (!r.guardianIds.includes(guardianId)) return settle({ ok: false, reason: 'invalid', errors: { guardian: 'Choose a guardian who can respond for this family.' } });
    const responses = getFormResponses();
    const existing = responses.find(x => x.formId === formId && x.familyId === familyId);
    if (existing) return settle({ ok: false, reason: 'duplicate', response: existing });
    const files = getFormFiles();
    const shown = visibleFormQuestions(f.questions, answers);
    const errors = {};
    const kept = {};
    const signatures = {};
    const g = guardianById(guardianId);
    const now = new Date().toISOString();
    f.questions.filter(q => shown.has(q.id)).forEach(q => {
      const v = answers[q.id];
      if (!formAnswered(q, v)) { if (q.required) errors[q.id] = q.type === 'signature' ? 'Please sign here.' : q.type === 'file' ? 'Please attach a file.' : 'Please answer this question.'; return; }
      if (q.type === 'file') {
        if (v.some(id => !files.some(x => x.id === id && x.formId === formId && x.qid === q.id && !x.responseId))) { errors[q.id] = 'An attachment is missing. Remove it and attach it again.'; return; }
        kept[q.id] = [...new Set(v)];
        return;
      }
      if (q.type === 'signature') {
        if (!files.some(x => x.id === v.fileId && x.formId === formId && x.qid === q.id && x.kind === 'signature' && !x.responseId)) { errors[q.id] = 'The signature wasn’t saved. Clear it and sign again.'; return; }
        kept[q.id] = { fileId: v.fileId };
        signatures[q.id] = { fileId: v.fileId, name: g?.name || 'Guardian', at: now };
        return;
      }
      const err = formAnswerError(q, typeof v === 'string' ? v.trim() : v);
      if (err) { errors[q.id] = err; return; }
      kept[q.id] = q.type === 'rating' ? Number(v) : q.type === 'multi' ? [...new Set(v)] : String(v).trim();
    });
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const resp = { id: newId('fr'), formId, version: f.version, familyId, guardianId, guardianName: g?.name || 'Guardian', children: r.children, answers: kept, signatures, submittedAt: now, demo: true, enteredBy: user.id };
    const used = new Set([...Object.values(kept).flatMap(v => (Array.isArray(v) ? v : v?.fileId ? [v.fileId] : []))]);
    files.forEach(x => { if (used.has(x.id)) x.responseId = resp.id; });
    if (!commit([{ key: formResponsesKey(school.id), value: [...responses, resp] }, { key: formFilesKey(school.id), value: files }])) return settle({ ok: false, reason: 'storage' });
    notifyUsers({ module: 'forms', kind: 'form', title: `New response: ${f.title}`, body: `${r.name} · ${formStats(f).received} of ${formStats(f).eligible} responded`, recordType: 'form', recordId: f.id, dedupeKey: `form-response:${resp.id}`, actorId: user.id }, { toUserIds: [f.createdById].filter(x => x !== user.id) });
    return settle({ ok: true, response: resp });
  }

  // Per-question summaries, from stored responses only.
  function formQuestionSummary(f, responses) {
    return f.questions.map(q => {
      const rows = responses.filter(r => formAnswered(q, r.answers[q.id]));
      const n = rows.length;
      const base = { q, n };
      if (q.type === 'yesno') return { ...base, options: [['yes', 'Yes'], ['no', 'No']].map(([k, l]) => { const c = rows.filter(r => r.answers[q.id] === k).length; return { label: l, count: c, pct: n ? Math.round((c / n) * 100) : 0 }; }) };
      if (q.type === 'single' || q.type === 'multi') return { ...base, options: q.options.map(o => { const c = rows.filter(r => (q.type === 'multi' ? r.answers[q.id].includes(o.id) : r.answers[q.id] === o.id)).length; return { label: o.label, count: c, pct: n ? Math.round((c / n) * 100) : 0 }; }) };
      if (q.type === 'rating') { const vals = rows.map(r => Number(r.answers[q.id])); return { ...base, avg: n ? Math.round((vals.reduce((a, b) => a + b, 0) / n) * 10) / 10 : null, options: [1, 2, 3, 4, 5].map(k => { const c = vals.filter(v => v === k).length; return { label: String(k), count: c, pct: n ? Math.round((c / n) * 100) : 0 }; }) }; }
      if (q.type === 'signature') return { ...base, items: rows.map(r => ({ responseId: r.id, ...(r.signatures?.[q.id] || { fileId: r.answers[q.id].fileId, name: r.guardianName, at: r.submittedAt }), family: r.familyId })) };
      if (q.type === 'file') return { ...base, items: rows.flatMap(r => r.answers[q.id].map(fileId => ({ fileId, responseId: r.id, family: r.familyId }))) };
      return { ...base, items: rows.map(r => ({ value: r.answers[q.id], responseId: r.id, family: r.familyId })) };
    });
  }
  // Text shown for an answer in tables, drawers and CSV.
  function formAnswerText(q, v, r = null) {
    if (!formAnswered(q, v)) return '';
    if (q.type === 'yesno') return v === 'yes' ? 'Yes' : 'No';
    if (q.type === 'single') return q.options.find(o => o.id === v)?.label || '';
    if (q.type === 'multi') return v.map(id => q.options.find(o => o.id === id)?.label).filter(Boolean).join('; ');
    if (q.type === 'rating') return `${v} / 5`;
    if (q.type === 'file') { const files = getFormFiles(); return v.map(id => files.find(x => x.id === id)?.name || 'file').join('; '); }
    if (q.type === 'signature') { const s = r?.signatures?.[q.id]; return s ? `Signed by ${s.name} at ${new Date(s.at).toLocaleString('en-GB')}` : 'Signed'; }
    return String(v);
  }
  // One row per submitted response the user may see. Cells are quoted and formula-like text is neutralised.
  function formResponsesCsv(user, id) {
    const v = formView(user, id);
    if (v.error) return { error: v.error };
    const f = v.form;
    const cell = x => { let s = String(x ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const sigQs = f.questions.filter(q => q.type === 'signature');
    const fams = Object.fromEntries(listFamilies({ includeMerged: true }).map(x => [x.id, x.name]));
    const header = ['Form', 'Version', 'Family', 'Guardian', 'Children', 'Submitted at', ...f.questions.map((q, i) => `Q${i + 1}. ${q.label}`), ...(sigQs.length ? ['Signature status', 'Signed at'] : [])];
    const rows = v.responses.slice().sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)).map(r => {
      const sig = Object.values(r.signatures || {})[0];
      return [f.title, f.version, fams[r.familyId] || r.familyId, r.guardianName, r.children.join('; '), new Date(r.submittedAt).toLocaleString('en-GB'),
        ...f.questions.map(q => (q.type === 'signature' ? (r.signatures?.[q.id] ? 'Signed' : '') : formAnswerText(q, r.answers[q.id], r))),
        ...(sigQs.length ? [sig ? `Signed by ${sig.name}` : 'Not signed', sig ? new Date(sig.at).toLocaleString('en-GB') : ''] : [])];
    });
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { csv: `﻿${[header, ...rows].map(r => r.map(cell).join(',')).join('\r\n')}`, rows: rows.length, filename: `${f.type}-form-responses-${stamp}.csv` };
  }

  /* Parent–teacher meetings & conference records (meetings.js at ?page=meetings)
     Slots `nexora-ptm-slots:<school>` { id, teacherId (educator), date, start, end, mode: both|in_person|video,
       status: active|removed, createdBy, createdAt, demo }. Booked/open/past is never stored on the slot: it comes from
       the bookings, so a booked slot can't be shown as open and a cancelled booking frees its slot automatically.
     Bookings `nexora-ptm-bookings:<school>` { id, slotId, teacherId, date, start, end, familyId, childId, mode, topic,
       internalNote, location, videoLink, status: upcoming|completed|cancelled|no_show, clientId, notifications[],
       createdBy, createdAt, cancelledAt, cancelledBy, reopened, demo } — at most one non-cancelled booking per slot.
     Records `nexora-ptm-records:<school>` { id, bookingId, childId, familyId, teacherId, date, topic, notes, strengths,
       concerns, familySummary, shareStrengths, followUpDate, actions: [{ id, text, owner: { kind: staff|family, id },
       due, done, doneAt, learningRef, share }], shared, sharedAt, sharedBy, shareHistory[], createdBy, createdAt,
       updatedAt } — one per booking. Families only ever see familyConferenceView(): the family summary, strengths if
       chosen, and actions marked to share. Notes and concerns are never included.
     Prototype: bookings are checked and written in one synchronous store operation, which stops double booking inside
     this browser; real multi-user safety needs a server-side atomic write. Families have no app, so notices are
     recorded as queued (demo) or skipped, never as delivered. */
  const ptmSlotsKey = id => `nexora-ptm-slots:${id}`;
  const ptmBookingsKey = id => `nexora-ptm-bookings:${id}`;
  const ptmRecordsKey = id => `nexora-ptm-records:${id}`;
  const MEETING_MODES = { in_person: 'In person', video: 'Video' };
  const SLOT_MODES = { both: 'In person or video', in_person: 'In person only', video: 'Video only' };
  const BOOKING_STATUSES = { upcoming: 'Upcoming', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' };
  const SLOT_LENGTHS = [10, 15, 20];
  const canUseMeetings = user => can(user, 'meetings');
  const educatorOf = user => educators.find(e => e.userId === user.id) || null;
  const meetingTeachers = user => (LEADERS.includes(user.role) ? educators.slice() : [educatorOf(user)].filter(Boolean));
  const canTeachFor = (user, teacherId) => LEADERS.includes(user.role) || educatorOf(user)?.id === teacherId;
  const teacherName = id => educators.find(e => e.id === id)?.name || 'Teacher';
  const teacherLocation = id => { const c = activeClasses().find(x => x.staffIds.includes(id)); return c?.room ? `${c.room}` : 'School office'; };
  const slotStart = s => new Date(`${s.date}T${s.start}:00`);
  const ptmTime = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDaysIso = (s, n) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return isoDay(d); };
  const familyDelivery = familyId => { const f = listFamilies().find(x => x.id === familyId); const app = getParentApp(); return f && f.guardians.some(g => accountOf(app, g.id).status === 'active') ? 'queued (demo — not delivered)' : 'skipped: no parent-app account'; };

  function seedMeetings() {
    const day = n => addDaysIso(today(), n);
    let d1 = 1; while (!schoolDay(day(d1)).open) d1 += 1;
    let d2 = d1 + 1; while (!schoolDay(day(d2)).open) d2 += 1;
    const past = day(-3);
    const at = atToday(9, 0, -5);
    const slots = [];
    const mkSlots = (teacherId, date, from, n, mode = 'both') => { for (let k = 0; k < n; k += 1) { const s = toMinutes(from) + k * 15; slots.push({ id: `ps-${teacherId.slice(3)}-${date}-${k}`, teacherId, date, start: ptmTime(s), end: ptmTime(s + 15), mode, status: 'active', createdBy: 'Mrs. Rao', createdAt: at, demo: true }); } };
    mkSlots('ed-lakshmi', day(d1), '13:30', 7);
    mkSlots('ed-arjun', day(d1), '13:30', 6);
    mkSlots('ed-lakshmi', day(d2), '14:00', 6, 'video');
    mkSlots('ed-lakshmi', past, '13:30', 4);
    const fams = listFamilies();
    const famWith = (cls, skip = 0) => fams.filter(f => f.children.some(c => c.status === 'active' && c.cls === cls))[skip];
    const kidIn = (f, cls) => f.children.find(c => c.status === 'active' && c.cls === cls);
    const book = (id, slot, f, cls, extra) => { const k = kidIn(f, cls); return { id, slotId: slot.id, teacherId: slot.teacherId, date: slot.date, start: slot.start, end: slot.end, familyId: f.id, childId: k.id, mode: 'in_person', topic: '', internalNote: '', location: teacherLocation(slot.teacherId), videoLink: '', status: 'upcoming', clientId: id, notifications: [{ kind: 'booked', at, result: familyDelivery(f.id) }], createdBy: 'Mrs. Rao', createdAt: at, demo: true, ...extra }; };
    const A = 'Montessori A';
    const U = 'UKG A';
    const fa0 = famWith(A, 0); const fa1 = famWith(A, 1); const fa2 = famWith(A, 2); const fu0 = famWith(U, 0);
    const bookings = [];
    if (fa0) bookings.push(book('pb-demo-1', slots[0], fa0, A, { topic: 'Settling in and friendships' }));
    if (fa1) bookings.push(book('pb-demo-2', slots[2], fa1, A, { topic: 'Practical life progress', mode: 'in_person' }));
    if (fu0) bookings.push(book('pb-demo-3', slots.find(s => s.teacherId === 'ed-arjun'), fu0, U, { topic: 'Early reading' }));
    const pastSlots = slots.filter(s => s.date === past);
    if (fa2) bookings.push(book('pb-demo-4', pastSlots[0], fa2, A, { topic: 'Term review', status: 'completed', completedAt: atToday(14, 0, -3) }));
    if (fa1) bookings.push(book('pb-demo-5', pastSlots[1], fa1, A, { topic: 'Term review', status: 'cancelled', cancelledAt: atToday(10, 0, -4), cancelledBy: 'Mrs. Rao', reopened: false, notifications: [{ kind: 'booked', at, result: familyDelivery(fa1.id) }, { kind: 'cancelled', at: atToday(10, 0, -4), result: familyDelivery(fa1.id) }] }));
    const records = [];
    const done = bookings.find(b => b.id === 'pb-demo-4');
    if (done) {
      const f = fams.find(x => x.id === done.familyId);
      const g = f.primary || f.guardians[0];
      records.push({ id: 'pr-demo-1', bookingId: done.id, childId: done.childId, familyId: done.familyId, teacherId: done.teacherId, date: done.date, topic: 'Term review',
        notes: 'Parents mentioned a new baby sibling at home; some tiredness in the mornings. Keep an eye on rest time.', strengths: 'Concentrates for long periods with the pink tower and knobbed cylinders. Kind to younger children.',
        concerns: 'Reluctant to join group circle time.', familySummary: 'A lovely term — your child is focused and caring, and is growing in confidence. We agreed a few small steps to help with group time.', shareStrengths: true, followUpDate: day(14),
        actions: [
          { id: 'pa-1', text: 'Invite to help set up circle time twice a week', owner: { kind: 'staff', id: done.teacherId }, due: day(-1), done: false, doneAt: null, learningRef: '', share: true },
          { id: 'pa-2', text: 'Read a picture book about new siblings at home', owner: { kind: 'family', id: g?.id || '' }, due: day(7), done: false, doneAt: null, learningRef: '', share: true },
          { id: 'pa-3', text: 'Share rest-time notes in the daily diary for two weeks', owner: { kind: 'staff', id: done.teacherId }, due: day(-2), done: true, doneAt: atToday(15, 0, -2), learningRef: '', share: false }
        ], shared: false, sharedAt: null, sharedBy: null, shareHistory: [], createdBy: 'Ms. Lakshmi', createdAt: atToday(15, 0, -3), updatedAt: atToday(15, 0, -2), demo: true });
    }
    return { slots, bookings, records };
  }
  function ptmData() {
    const saved = read(ptmSlotsKey(school.id), null);
    if (saved) return { slots: saved, bookings: read(ptmBookingsKey(school.id), []), records: read(ptmRecordsKey(school.id), []) };
    const s = seedMeetings();
    try {
      localStorage.setItem(ptmSlotsKey(school.id), JSON.stringify(s.slots));
      localStorage.setItem(ptmBookingsKey(school.id), JSON.stringify(s.bookings));
      localStorage.setItem(ptmRecordsKey(school.id), JSON.stringify(s.records));
    } catch { /* in memory */ }
    return s;
  }
  const activeBookingFor = (slotId, bookings) => bookings.find(b => b.slotId === slotId && b.status !== 'cancelled') || null;
  function slotState(s, bookings, now = Date.now()) {
    if (s.status === 'removed') return 'unavailable';
    if (activeBookingFor(s.id, bookings)) return 'booked';
    if (slotStart(s).getTime() <= now) return 'past';
    return 'open';
  }
  const canSeeBooking = (user, b) => LEADERS.includes(user.role) || educatorOf(user)?.id === b.teacherId || classScope(user).includes(childById(b.childId)?.cls);

  // Slots between two dates with their state; booking details only for people allowed to see them.
  function meetingSlots(user, { from, to, teacherIds = null } = {}) {
    if (!canUseMeetings(user)) return [];
    const { slots, bookings } = ptmData();
    const now = Date.now();
    return slots.filter(s => s.date >= from && s.date <= to && (!teacherIds || teacherIds.includes(s.teacherId))).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).map(s => {
      const b = activeBookingFor(s.id, bookings);
      const cancelled = bookings.filter(x => x.slotId === s.id && x.status === 'cancelled');
      return { ...s, state: slotState(s, bookings, now), booking: b && canSeeBooking(user, b) ? b : null, bookedHidden: Boolean(b && !canSeeBooking(user, b)), cancelledCount: cancelled.length };
    });
  }
  const openSlotsFor = (user, teacherId, mode = '') => meetingSlots(user, { from: today(), to: '9999-12-31', teacherIds: [teacherId] }).filter(s => s.state === 'open' && (!mode || s.mode === 'both' || s.mode === mode));

  // One algorithm for the preview and for creating, so the preview always matches what's saved.
  function planSlots(user, input = {}) {
    const errors = {};
    const allowed = meetingTeachers(user).map(e => e.id);
    const teacherIds = [...new Set(input.teacherIds || [])].filter(id => allowed.includes(id));
    const from = clean(input.from);
    const to = clean(input.to);
    const len = Number(input.length);
    const gap = Number(input.gap);
    const days = (input.weekdays || ['mon', 'tue', 'wed', 'thu', 'fri']).filter(d => WEEKDAYS.includes(d));
    const mode = SLOT_MODES[input.mode] ? input.mode : 'both';
    const hoursOnly = input.hoursOnly !== false;
    if (!teacherIds.length) errors.teachers = 'Choose at least one teacher.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) errors.from = 'Choose a start date.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) errors.to = 'Choose an end date.';
    if (!errors.from && !errors.to && from > to) errors.to = 'The end date must be on or after the start date.';
    if (!errors.from && !errors.to && from <= to && (new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 864e5 > 30) errors.to = 'Choose a range of 31 days or fewer.';
    if (!errors.to && to && to < today()) errors.to = 'The date range is in the past.';
    if (!/^\d{2}:\d{2}$/.test(input.start || '')) errors.start = 'Choose a start time.';
    if (!/^\d{2}:\d{2}$/.test(input.end || '')) errors.end = 'Choose an end time.';
    if (!errors.start && !errors.end && toMinutes(input.start) >= toMinutes(input.end)) errors.end = 'The end time must be after the start time.';
    if (!SLOT_LENGTHS.includes(len)) errors.length = 'Choose 10, 15 or 20 minutes.';
    if (!Number.isInteger(gap) || gap < 0) errors.gap = 'The break can’t be negative.';
    else if (gap > 60) errors.gap = 'Keep breaks to 60 minutes or less.';
    if (!days.length) errors.weekdays = 'Choose at least one weekday.';
    const empty = { slots: [], teachers: teacherIds.length, days: 0, skipped: { exists: 0, hours: 0, past: 0 }, closedDays: [], samples: {}, errors };
    if (Object.keys(errors).length) return empty;
    const { slots: existing } = ptmData();
    const now = Date.now();
    const out = [];
    const skipped = { exists: 0, hours: 0, past: 0 };
    const closed = new Set();
    const usedDays = new Set();
    const samples = {};
    for (let d = from; d <= to; d = addDaysIso(d, 1)) {
      if (!days.includes(weekdayOf(d))) continue;
      const sd = schoolDay(d);
      if (!sd.open) { closed.add(`${d} (${sd.name})`); continue; }
      teacherIds.forEach(tid => {
        const shift = shiftOf(tid, d);
        for (let t = toMinutes(input.start); t + len <= toMinutes(input.end); t += len + gap) {
          const s = { teacherId: tid, date: d, start: ptmTime(t), end: ptmTime(t + len) };
          if (slotStart(s).getTime() <= now) { skipped.past += 1; continue; }
          if (hoursOnly && (!shift || t < toMinutes(shift.start) || t + len > toMinutes(shift.end))) { skipped.hours += 1; continue; }
          if (existing.some(x => x.status !== 'removed' && x.teacherId === tid && x.date === d && overlaps(x, s)) || out.some(x => x.teacherId === tid && x.date === d && overlaps(x, s))) { skipped.exists += 1; continue; }
          out.push({ ...s, mode });
          usedDays.add(d);
          (samples[tid] = samples[tid] || []).push(`${d} ${s.start}–${s.end}`);
        }
      });
    }
    return { slots: out, teachers: teacherIds.length, days: usedDays.size, skipped, closedDays: [...closed], samples, errors, hoursOnly };
  }
  function createSlots(user, input) {
    if (!canUseMeetings(user)) return settle({ ok: false, reason: 'forbidden' });
    const plan = planSlots(user, input);
    if (Object.keys(plan.errors).length) return settle({ ok: false, reason: 'invalid', errors: plan.errors });
    if (!plan.slots.length) return settle({ ok: false, reason: 'invalid', errors: { form: 'No new slots can be created with these settings — they already exist, are in the past, or fall outside working hours.' } });
    const { slots } = ptmData();
    const now = new Date().toISOString();
    const made = plan.slots.map(s => ({ id: newId('ps'), ...s, status: 'active', createdBy: user.name, createdAt: now }));
    if (!write(ptmSlotsKey(school.id), [...slots, ...made])) return settle({ ok: false, reason: 'storage' });
    logAudit(user, 'create:ptm-slots', '', `${made.length} slots for ${plan.teachers} teacher(s)`);
    const sk = plan.skipped;
    return settle({ ok: true, created: made.length, skipped: sk.exists + sk.hours + sk.past, detail: sk });
  }
  function removeSlot(user, slotId) {
    const { slots, bookings } = ptmData();
    const s = slots.find(x => x.id === slotId);
    if (!s) return settle({ ok: false, reason: 'missing' });
    if (!canTeachFor(user, s.teacherId)) return settle({ ok: false, reason: 'forbidden' });
    if (activeBookingFor(slotId, bookings)) return settle({ ok: false, reason: 'booked' });
    s.status = 'removed';
    return settle(write(ptmSlotsKey(school.id), slots) ? { ok: true } : { ok: false, reason: 'storage' });
  }

  // Checks and writes in one step against the latest stored data, so two forms (or a double click) can't both book
  // the same slot here. A repeated clientId returns the first booking instead of creating another.
  function bookMeeting(user, input = {}) {
    if (!canUseMeetings(user)) return settle({ ok: false, reason: 'forbidden' });
    const { slots, bookings } = ptmData();
    if (input.clientId) { const again = bookings.find(b => b.clientId === input.clientId); if (again) return settle({ ok: true, booking: again, repeated: true }); }
    const errors = {};
    const s = slots.find(x => x.id === input.slotId);
    if (!s) errors.slotId = 'Choose a time.';
    else if (!canTeachFor(user, s.teacherId)) return settle({ ok: false, reason: 'forbidden' });
    const fam = listFamilies().find(f => f.id === input.familyId);
    if (!fam) errors.familyId = 'Choose a family.';
    const child = fam?.children.find(c => c.id === input.childId && c.status === 'active');
    if (fam && !child) errors.childId = 'Choose a child in this family.';
    else if (child && !LEADERS.includes(user.role) && !classScope(user).includes(child.cls)) errors.childId = 'You can only book for children in your classes.';
    const mode = MEETING_MODES[input.mode] ? input.mode : '';
    if (!mode) errors.mode = 'Choose in person or video.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    if (s.status === 'removed') return settle({ ok: false, reason: 'conflict', errors: { slotId: 'This time is no longer available. Please choose another time.' } });
    if (activeBookingFor(s.id, bookings)) return settle({ ok: false, reason: 'conflict', errors: { slotId: 'This slot has just been booked. Please choose another time.' } });
    if (slotStart(s).getTime() <= Date.now()) return settle({ ok: false, reason: 'conflict', errors: { slotId: 'This time has passed. Please choose another time.' } });
    if (s.mode !== 'both' && s.mode !== mode) return settle({ ok: false, reason: 'invalid', errors: { mode: `This slot is ${SLOT_MODES[s.mode].toLowerCase()}.` } });
    const dup = bookings.find(b => b.status === 'upcoming' && b.childId === child.id && b.teacherId === s.teacherId && b.date === s.date);
    if (dup) return settle({ ok: false, reason: 'invalid', errors: { childId: `${child.firstName || child.name} already has a meeting with ${teacherName(s.teacherId)} that day at ${dup.start}.` } });
    const videoLink = clean(input.videoLink);
    if (videoLink && !/^https:\/\/[^\s]+\.[^\s]+$/.test(videoLink)) return settle({ ok: false, reason: 'invalid', errors: { videoLink: 'Enter a full https:// link, or leave it empty.' } });
    const now = new Date().toISOString();
    const b = { id: newId('pb'), slotId: s.id, teacherId: s.teacherId, date: s.date, start: s.start, end: s.end, familyId: fam.id, childId: child.id, mode, topic: clean(input.topic).slice(0, 200), internalNote: String(input.internalNote || '').trim().slice(0, 1000),
      location: mode === 'in_person' ? teacherLocation(s.teacherId) : '', videoLink: mode === 'video' ? videoLink : '', status: 'upcoming', clientId: clean(input.clientId) || newId('cl'), notifications: [{ kind: 'booked', at: now, result: familyDelivery(fam.id) }], createdBy: user.name, createdById: user.id, createdAt: now };
    if (!write(ptmBookingsKey(school.id), [...bookings, b])) return settle({ ok: false, reason: 'storage' });
    const tUser = educators.find(e => e.id === s.teacherId)?.userId;
    if (tUser && tUser !== user.id) notifyUsers({ module: 'meetings', kind: 'meeting', title: `Meeting booked: ${child.name}`, body: `${s.date} ${s.start} · ${MEETING_MODES[mode]} · booked by ${user.name}`, recordType: 'meeting', recordId: b.id, dedupeKey: `ptm-booked:${b.id}`, actorId: user.id }, { toUserIds: [tUser] });
    logAudit(user, 'book:ptm', child.id, `${teacherName(s.teacherId)} ${s.date} ${s.start}`);
    return settle({ ok: true, booking: b });
  }
  function cancelMeeting(user, id, { keepOpen = true, reason = '' } = {}) {
    const { slots, bookings } = ptmData();
    const b = bookings.find(x => x.id === id);
    if (!b) return settle({ ok: false, reason: 'missing' });
    if (!canTeachFor(user, b.teacherId) && !LEADERS.includes(user.role)) return settle({ ok: false, reason: 'forbidden' });
    if (b.status === 'cancelled') return settle({ ok: false, reason: 'already' });
    if (b.status !== 'upcoming') return settle({ ok: false, reason: 'locked' });
    const s = slots.find(x => x.id === b.slotId);
    const future = s && slotStart(s).getTime() > Date.now();
    const now = new Date().toISOString();
    const reopened = Boolean(keepOpen && future && s.status !== 'removed');
    if (s && !reopened && future) s.status = 'removed';
    Object.assign(b, { status: 'cancelled', cancelledAt: now, cancelledBy: user.name, cancelReason: clean(reason).slice(0, 200), reopened });
    const result = familyDelivery(b.familyId);
    b.notifications = [...(b.notifications || []), { kind: 'cancelled', at: now, result }];
    if (!commit([{ key: ptmBookingsKey(school.id), value: bookings }, { key: ptmSlotsKey(school.id), value: slots }])) return settle({ ok: false, reason: 'storage' });
    const tUser = educators.find(e => e.id === b.teacherId)?.userId;
    if (tUser && tUser !== user.id) notifyUsers({ module: 'meetings', kind: 'meeting', title: `Meeting cancelled: ${childById(b.childId)?.firstName || 'a child'}`, body: `${b.date} ${b.start} · cancelled by ${user.name}`, recordType: 'meeting', recordId: b.id, dedupeKey: `ptm-cancel:${b.id}`, actorId: user.id }, { toUserIds: [tUser] });
    logAudit(user, 'cancel:ptm', b.childId, `${b.date} ${b.start}${reopened ? ' (slot reopened)' : ''}`);
    return settle({ ok: true, booking: b, reopened, notification: result, past: !future });
  }
  function setMeetingOutcome(user, id, status) {
    const { bookings } = ptmData();
    const b = bookings.find(x => x.id === id);
    if (!b) return settle({ ok: false, reason: 'missing' });
    if (!canTeachFor(user, b.teacherId)) return settle({ ok: false, reason: 'forbidden' });
    if (!['completed', 'no_show', 'upcoming'].includes(status)) return settle({ ok: false, reason: 'invalid' });
    if (b.status === 'cancelled') return settle({ ok: false, reason: 'locked' });
    if (status !== 'upcoming' && slotStart(b).getTime() > Date.now()) return settle({ ok: false, reason: 'early' });
    Object.assign(b, { status, completedAt: status === 'completed' ? new Date().toISOString() : null, outcomeBy: user.name });
    return settle(write(ptmBookingsKey(school.id), bookings) ? { ok: true, booking: b } : { ok: false, reason: 'storage' });
  }
  function setMeetingVideoLink(user, id, url) {
    const { bookings } = ptmData();
    const b = bookings.find(x => x.id === id);
    if (!b) return settle({ ok: false, reason: 'missing' });
    if (!canTeachFor(user, b.teacherId)) return settle({ ok: false, reason: 'forbidden' });
    const v = clean(url);
    if (v && !/^https:\/\/[^\s]+\.[^\s]+$/.test(v)) return settle({ ok: false, reason: 'invalid', errors: { videoLink: 'Enter a full https:// link, or leave it empty.' } });
    b.videoLink = v.slice(0, 300);
    return settle(write(ptmBookingsKey(school.id), bookings) ? { ok: true } : { ok: false, reason: 'storage' });
  }
  function meetingBookings(user) {
    if (!canUseMeetings(user)) return [];
    return ptmData().bookings.filter(b => canSeeBooking(user, b)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  }

  const conferenceActionStatus = a => (a.done ? 'completed' : a.due && a.due < today() ? 'overdue' : 'pending');
  const canSeeRecord = (user, r) => canUseMeetings(user) && (LEADERS.includes(user.role) || educatorOf(user)?.id === r.teacherId || classScope(user).includes(childById(r.childId)?.cls));
  const canEditRecord = (user, r) => canUseMeetings(user) && (LEADERS.includes(user.role) || educatorOf(user)?.id === r.teacherId);
  const conferenceRecords = user => ptmData().records.filter(r => canSeeRecord(user, r)).sort((a, b) => b.date.localeCompare(a.date));
  const conferenceRecordsForChild = (user, childId) => (canView(user, 'conferences') ? conferenceRecords(user).filter(r => r.childId === childId) : []);
  function actionOwners(familyId, teacherId) {
    const fam = listFamilies().find(f => f.id === familyId);
    return [...educators.filter(e => !e.relief || e.id === teacherId).map(e => ({ kind: 'staff', id: e.id, name: e.name, label: `${e.name} (staff)` })), ...(fam?.guardians || []).map(g => ({ kind: 'family', id: g.id, name: g.name, label: `${g.name} (family)` }))];
  }
  const ownerName = o => (o?.kind === 'family' ? guardianById(o.id)?.name || 'Family' : teacherName(o?.id));

  function recordValues(input, base) {
    const errors = {};
    const owners = actionOwners(base.familyId, base.teacherId);
    const learning = getLearning(base.childId);
    const actions = (input.actions || []).slice(0, 30).map((a, i) => {
      const text = clean(a.text).slice(0, 300);
      const due = clean(a.due);
      const owner = owners.find(o => o.kind === a.owner?.kind && o.id === a.owner?.id);
      if (!text) errors[`action-${i}`] = 'Describe the action.';
      else if (!owner) errors[`action-${i}`] = 'Choose who will do this.';
      else if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) errors[`action-${i}`] = 'Enter a valid due date.';
      return { id: clean(a.id) || newId('pa'), text, owner: owner ? { kind: owner.kind, id: owner.id } : null, due, done: Boolean(a.done), doneAt: a.done ? a.doneAt || new Date().toISOString() : null, learningRef: learning.some(l => l.id === a.learningRef) ? a.learningRef : '', share: Boolean(a.share) };
    });
    const followUpDate = clean(input.followUpDate);
    if (followUpDate && !/^\d{4}-\d{2}-\d{2}$/.test(followUpDate)) errors.followUpDate = 'Enter a valid date.';
    const v = { topic: clean(input.topic).slice(0, 200), notes: String(input.notes || '').trim().slice(0, 4000), strengths: String(input.strengths || '').trim().slice(0, 2000), concerns: String(input.concerns || '').trim().slice(0, 2000), familySummary: String(input.familySummary || '').trim().slice(0, 2000), shareStrengths: Boolean(input.shareStrengths), followUpDate, actions };
    if (!v.notes && !v.strengths && !v.concerns && !v.familySummary && !actions.length) errors.notes = 'Add at least a note, a summary or an action.';
    return { v, errors };
  }
  // Create (from a meeting that has started) or update a record. One record per meeting.
  function saveConferenceRecord(user, input = {}, id = null) {
    if (!canUseMeetings(user)) return settle({ ok: false, reason: 'forbidden' });
    const data = ptmData();
    let r = id ? data.records.find(x => x.id === id) : data.records.find(x => x.bookingId === input.bookingId);
    let b = null;
    if (r) { if (!canEditRecord(user, r)) return settle({ ok: false, reason: 'forbidden' }); }
    else {
      b = data.bookings.find(x => x.id === input.bookingId);
      if (!b) return settle({ ok: false, reason: 'missing' });
      if (!canTeachFor(user, b.teacherId)) return settle({ ok: false, reason: 'forbidden' });
      if (b.status === 'cancelled') return settle({ ok: false, reason: 'locked' });
      if (slotStart(b).getTime() > Date.now()) return settle({ ok: false, reason: 'early' });
    }
    const base = r || { familyId: b.familyId, teacherId: b.teacherId, childId: b.childId };
    const { v, errors } = recordValues(input, base);
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const now = new Date().toISOString();
    if (r) Object.assign(r, v, { updatedAt: now, updatedBy: user.name });
    else {
      r = { id: newId('pr'), bookingId: b.id, childId: b.childId, familyId: b.familyId, teacherId: b.teacherId, date: b.date, ...v, topic: v.topic || b.topic, shared: false, sharedAt: null, sharedBy: null, shareHistory: [], createdBy: user.name, createdAt: now, updatedAt: now };
      data.records.push(r);
      if (b.status === 'upcoming') Object.assign(b, { status: 'completed', completedAt: now, outcomeBy: user.name });
    }
    if (!commit([{ key: ptmRecordsKey(school.id), value: data.records }, { key: ptmBookingsKey(school.id), value: data.bookings }])) return settle({ ok: false, reason: 'storage' });
    logAudit(user, id ? 'edit:conference' : 'create:conference', r.childId, r.topic || 'Conference record');
    return settle({ ok: true, record: r });
  }
  function setConferenceAction(user, recordId, actionId, patch = {}) {
    const data = ptmData();
    const r = data.records.find(x => x.id === recordId);
    if (!r) return settle({ ok: false, reason: 'missing' });
    if (!canEditRecord(user, r)) return settle({ ok: false, reason: 'forbidden' });
    const i = r.actions.findIndex(a => a.id === actionId);
    if (i < 0) return settle({ ok: false, reason: 'missing' });
    if (patch.remove) r.actions.splice(i, 1);
    else if ('done' in patch) Object.assign(r.actions[i], { done: Boolean(patch.done), doneAt: patch.done ? new Date().toISOString() : null });
    r.updatedAt = new Date().toISOString();
    return settle(write(ptmRecordsKey(school.id), data.records) ? { ok: true, record: r } : { ok: false, reason: 'storage' });
  }
  // Exactly what the family would see. Internal notes and concerns are never part of it.
  function familyConferenceView(record) {
    if (!record) return null;
    const child = childById(record.childId);
    return {
      date: record.date, teacher: teacherName(record.teacherId), child: child ? childName(child) : '', topic: record.topic,
      summary: record.familySummary, strengths: record.shareStrengths ? record.strengths : '',
      actions: record.actions.filter(a => a.share).map(a => ({ text: a.text, owner: a.owner?.kind === 'family' ? ownerName(a.owner) : `${ownerName(a.owner)} (school)`, due: a.due, status: conferenceActionStatus(a) }))
    };
  }
  function shareConferenceRecord(user, id, on) {
    const data = ptmData();
    const r = data.records.find(x => x.id === id);
    if (!r) return settle({ ok: false, reason: 'missing' });
    if (!canEditRecord(user, r)) return settle({ ok: false, reason: 'forbidden' });
    if (Boolean(r.shared) === Boolean(on)) return settle({ ok: true, record: r, repeated: true });
    const fv = familyConferenceView(r);
    if (on && !fv.summary && !fv.strengths && !fv.actions.length) return settle({ ok: false, reason: 'invalid', errors: { share: 'Nothing is marked to share yet. Write a family summary or mark actions to share.' } });
    const now = new Date().toISOString();
    const result = on ? familyDelivery(r.familyId) : '';
    Object.assign(r, { shared: Boolean(on), sharedAt: on ? now : r.sharedAt, sharedBy: on ? user.name : r.sharedBy, unsharedAt: on ? null : now });
    r.shareHistory = [...(r.shareHistory || []), { at: now, by: user.name, shared: Boolean(on), result }];
    if (!write(ptmRecordsKey(school.id), data.records)) return settle({ ok: false, reason: 'storage' });
    logAudit(user, on ? 'share:conference' : 'unshare:conference', r.childId, r.topic || '');
    return settle({ ok: true, record: r, notification: result });
  }
  function meetingSummary(user) {
    const now = Date.now();
    const slots = meetingSlots(user, { from: today(), to: '9999-12-31' });
    const bookings = meetingBookings(user);
    const soon = addDaysIso(today(), 7);
    const acts = conferenceRecords(user).flatMap(r => r.actions.filter(a => !a.done && a.due && a.due <= soon));
    return { open: slots.filter(s => s.state === 'open').length, upcoming: bookings.filter(b => b.status === 'upcoming' && slotStart(b).getTime() > now).length, awaiting: bookings.filter(b => b.status === 'upcoming' && slotStart(b).getTime() <= now).length, completed: bookings.filter(b => b.status === 'completed').length, due: acts.length, overdue: acts.filter(a => a.due < today()).length };
  }
  // Ticker: one reminder per overdue staff-owned action (and due date), to that teacher.
  function processMeetings() {
    const raw = read(ptmRecordsKey(school.id), null);
    if (!raw) return 0;
    let n = 0;
    raw.forEach(r => r.actions.forEach(a => {
      if (a.done || !a.due || a.due >= today() || a.owner?.kind !== 'staff') return;
      const uid = educators.find(e => e.id === a.owner.id)?.userId;
      if (uid) n += notifyUsers({ module: 'meetings', kind: 'conference', title: 'Follow-up action overdue', body: `${a.text} · due ${a.due}`, recordType: 'conference', recordId: r.id, dedupeKey: `ptm-action:${a.id}:${a.due}` }, { toUserIds: [uid] });
    }));
    return n;
  }

  /* S32 Emergency broadcasts: shown to every role until each user acknowledges it. */
  const broadcastsKey = id => `nexora-broadcasts:${id}`;
  const getBroadcasts = (schoolId = school.id) => read(broadcastsKey(schoolId), []);
  const activeBroadcasts = () => getBroadcasts().filter(b => b.active);
  const unacknowledgedFor = user => activeBroadcasts().filter(b => !b.ackBy.includes(user.id));
  const canBroadcast = user => can(user, 'communication') && MANAGE_PLAN_ROLES.includes(user.role);
  function sendBroadcast(user, message) {
    const text = String(message || '').trim().slice(0, 280);
    if (!canBroadcast(user)) return settle({ ok: false, reason: 'forbidden' });
    if (!text) return settle({ ok: false, reason: 'invalid' });
    // The sender has read it, so it starts acknowledged for them.
    const b = { id: newId('bc'), message: text, createdAt: new Date().toISOString(), createdBy: user.id, createdByName: user.name, active: true, ackBy: [user.id] };
    if (!write(broadcastsKey(school.id), [b, ...getBroadcasts()])) return settle({ ok: false, reason: 'storage' });
    events.broadcast(user, b);
    return settle({ ok: true, broadcast: b });
  }
  function endBroadcast(user, id) {
    if (!canBroadcast(user)) return settle({ ok: false, reason: 'forbidden' });
    const list = getBroadcasts().map(b => (b.id === id ? { ...b, active: false, endedAt: new Date().toISOString() } : b));
    return settle(write(broadcastsKey(school.id), list) ? { ok: true } : { ok: false, reason: 'storage' });
  }
  // Acknowledgement is per user: everyone else keeps seeing the banner.
  function acknowledgeBroadcast(user, id) {
    const list = getBroadcasts().map(b => (b.id === id && !b.ackBy.includes(user.id) ? { ...b, ackBy: [...b.ackBy, user.id] } : b));
    return write(broadcastsKey(school.id), list);
  }

  /* Dashboard preferences, per user: { hidden: [widgetId] } — hidden rather than shown, so new
     widgets appear by default. Kept in localStorage until a preferences API exists. */
  const dashPrefsKey = userId => `nexora-dashboard:${userId}`;
  const getDashboardPrefs = user => ({ hidden: [], ...read(dashPrefsKey(user.id), {}) });
  const saveDashboardPrefs = (user, prefs) => write(dashPrefsKey(user.id), { hidden: [...new Set(prefs.hidden || [])], updatedAt: new Date().toISOString() });

  /* ---------------------------------------------------------------- Notifications (S62 centre, S63 settings, bell)
     One list in 'nexora-notifications'. Each record belongs to one recipient user:
     { id, toUserId, toRole, module, kind, title, body, createdAt, read, readAt, deletedAt,
       mentions: [userId], recordType, recordId, severity: 'normal'|'critical', dedupeKey, actorId }
     Older records addressed only to a role (toRole) are copied once to each user with that role.
     A user sees a notification only while their role can open its module and the plan includes it;
     module 'system' (access requests, upgrades, emergency broadcasts) is always visible.
     Deleting hides the notification (deletedAt); the enquiry, payment or incident is never touched. */

  const NOTIF_SEEDED_KEY = 'nexora-notifications-seeded';
  const notifSettingsKey = userId => `nexora-notification-settings:${userId}`;
  const NOTIFY_MODULES = ['attendance', 'admissions', 'fees', 'safeguarding', 'communication', 'classroom-tracker', 'observations', 'gallery', 'reports', 'payroll'];
  const MODULE_LABEL = key => (key === 'system' ? 'System' : pages[key]?.name || 'Other');

  const getNotificationSettings = user => ({ muted: [], ...read(notifSettingsKey(user.id), {}) });
  const saveNotificationSettings = (user, settings) => settle(write(notifSettingsKey(user.id), { muted: (settings.muted || []).filter(m => NOTIFY_MODULES.includes(m)), updatedAt: new Date().toISOString() }) ? { ok: true } : { ok: false });

  // Who may receive a notification about `module`: same role + plan rule as the page guard.
  const canSeeModule = (user, module) => module === 'system' || (canAccess(user, module) && isEntitled(module));

  function buildNotifications(list, n, { toRoles, toUserIds = [], exclude = [], createdAt } = {}) {
    const recipients = users.filter(u => u.schoolId === school.id && (toRoles?.includes(u.role) || toUserIds.includes(u.id)) && !exclude.includes(u.id));
    const at = createdAt || new Date().toISOString();
    const made = [];
    recipients.forEach(u => {
      // Role decides who receives it; the plan is checked again whenever it is shown.
      if (n.module !== 'system' && !canAccess(u, n.module)) return;
      if (n.severity !== 'critical' && getNotificationSettings(u).muted.includes(n.module)) return;
      // The same business event never notifies the same person twice (retries, double saves).
      if (n.dedupeKey && list.some(x => x.toUserId === u.id && x.dedupeKey === n.dedupeKey)) return;
      made.push({
        id: newId('n'), toUserId: u.id, toRole: u.role, read: false, readAt: null, deletedAt: null,
        mentions: [], recordType: null, recordId: null, severity: 'normal', createdAt: at, ...n
      });
    });
    return made;
  }
  // Adds notifications for each matching recipient. Returns how many were created.
  function notifyUsers(n, opts) {
    const list = allNotifications();
    const made = buildNotifications(list, n, opts);
    if (made.length) write(NOTIFICATIONS_KEY, [...made, ...list]);
    return made.length;
  }
  const rolesFor = module => (module === 'system' ? roles.slice() : pages[module]?.roles || []);

  // Kept for access requests and upgrade requests: one notification for each user with the role.
  function notify(toRole, notification) {
    const before = allNotifications();
    const made = buildNotifications(before, { module: 'system', ...notification }, { toRoles: [toRole] });
    if (!made.length) return true;
    return write(NOTIFICATIONS_KEY, [...made, ...before]);
  }

  function allNotifications() {
    let list = read(NOTIFICATIONS_KEY, []);
    // One-time move from role-addressed records to per-user records.
    if (list.some(n => !n.toUserId)) {
      list = list.flatMap(n => (n.toUserId ? [n] : users.filter(u => u.role === n.toRole).map(u => ({ module: 'system', mentions: [], severity: 'normal', deletedAt: null, ...n, id: `${n.id}-${u.id}`, toUserId: u.id }))));
      try { localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list)); } catch { /* keep in memory */ }
    }
    if (!read(NOTIF_SEEDED_KEY, false)) {
      try { localStorage.setItem(NOTIF_SEEDED_KEY, 'true'); } catch { /* seed again next time */ }
      list = [...seedNotifications(list), ...list];
      try { localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list)); } catch { /* keep in memory */ }
    }
    return list;
  }

  // Demo history built from the seeded records, so every notification points at a real record.
  function seedNotifications(existing) {
    const out = [];
    const add = (n, opts) => out.push(...buildNotifications([...existing, ...out], n, { exclude: [], ...opts }));
    const name = id => studentById(id)?.name || 'A child';
    const byName = n => users.find(u => u.name === n)?.id;
    getAdmissionEnquiries().filter(e => ['ae1', 'ae4', 'ae3'].includes(e.id)).forEach(e => add(
      { module: 'admissions', kind: 'enquiry', title: `New enquiry: ${e.child}`, body: `${e.parent} asked about ${e.programme}.`, recordType: 'enquiry', recordId: e.id, dedupeKey: `enquiry:${e.id}`, actorId: byName(e.createdBy) },
      { toRoles: rolesFor('admissions'), exclude: [byName(e.createdBy)], createdAt: e.createdAt }));
    add({ module: 'admissions', kind: 'mention', title: 'Mrs. Rao assigned you a follow-up', body: 'Call Sonal Kapoor back about transport for Rehan (LKG).', recordType: 'enquiry', recordId: 'ae2', mentions: ['u-admin'], dedupeKey: 'assign:ae2', actorId: 'u-director' },
      { toUserIds: ['u-admin'], createdAt: atToday(11, 40, -4) });
    add({ module: 'admissions', kind: 'mention', title: 'Ms. Fernandes mentioned you', body: '“@Mrs. Rao can you meet the Thomas family at their visit?”', recordType: 'enquiry', recordId: 'ae3', mentions: ['u-director'], dedupeKey: 'mention:ae3', actorId: 'u-admin' },
      { toUserIds: ['u-director'], createdAt: atToday(15, 20, -6) });
    getIncidents().forEach(i => add(
      { module: 'safeguarding', kind: 'incident', title: `${i.severity === 'High' ? 'High-severity incident' : 'Incident logged'}: ${name(i.studentId)}`, body: `${i.type} · ${i.description}`, recordType: 'incident', recordId: i.id, severity: i.severity === 'High' ? 'critical' : 'normal', dedupeKey: `incident:${i.id}`, actorId: byName(i.createdBy) },
      { toRoles: rolesFor('safeguarding'), createdAt: i.createdAt }));
    getPayments().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4).forEach(p => add(
      { module: 'fees', kind: 'payment', title: `Payment received: ₹${p.amount.toLocaleString('en-IN')}`, body: `${name(p.studentId)} · ${p.method} · recorded by ${p.recordedBy}`, recordType: 'invoice', recordId: p.invoiceId, dedupeKey: `payment:${p.id}`, actorId: 'u-accountant' },
      { toRoles: rolesFor('fees'), exclude: ['u-accountant'], createdAt: p.createdAt }));
    getAnnouncements().forEach(a => add(
      { module: 'communication', kind: 'announcement', title: `Announcement: ${a.title}`, body: `${a.audience} · from ${a.createdBy}`, recordType: 'announcement', recordId: a.id, dedupeKey: `announcement:${a.id}`, actorId: byName(a.createdBy) },
      { toRoles: rolesFor('communication'), exclude: [byName(a.createdBy)], createdAt: a.createdAt }));
    const nursery = classRatio('Nursery');
    if (nursery.status === 'breach') add(
      { module: 'attendance', kind: 'ratio', title: 'Nursery is over its ratio', body: `${nursery.children} children with ${nursery.educators} educator on duty (limit ${nursery.limit}).`, recordType: 'class', recordId: 'Nursery', severity: 'critical', dedupeKey: `ratio:Nursery:${today()}` },
      { toRoles: STAFF_RATIO_ROLES, toUserIds: staffOf('Nursery').filter(e => e.userId).map(e => e.userId), createdAt: atToday(9, 2) });
    add({ module: 'attendance', kind: 'mention', title: 'Ms. Deepa updated your register', body: 'Montessori A: Ananya Iyer marked absent.', recordType: 'class', recordId: 'Montessori A', mentions: ['u-teacher'], dedupeKey: `register-edit:Montessori A:${daysFromToday(-1)}` },
      { toUserIds: ['u-teacher'], createdAt: atToday(9, 15, -1) });
    return out;
  }
  const STAFF_RATIO_ROLES = MANAGE_PLAN_ROLES;

  /* Reading */
  const isVisibleTo = (user, n) => n.toUserId === user.id && !n.deletedAt && canSeeModule(user, n.module || 'system');
  const isMention = (user, n) => Array.isArray(n.mentions) && n.mentions.includes(user.id);
  // filters: { tab: 'all'|'unread'|'mentions', modules: [key], from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }. Newest first.
  function listNotifications(user, { tab = 'all', modules = [], from = '', to = '' } = {}) {
    const start = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity;
    const end = to ? new Date(`${to}T00:00:00`).getTime() + 86400000 : Infinity; // whole end day
    return allNotifications()
      .filter(n => isVisibleTo(user, n))
      .filter(n => tab !== 'unread' || !n.read)
      .filter(n => tab !== 'mentions' || isMention(user, n))
      .filter(n => !modules.length || modules.includes(n.module || 'system'))
      .filter(n => { const t = new Date(n.createdAt).getTime(); return t >= start && t < end; })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const unreadCount = user => allNotifications().filter(n => isVisibleTo(user, n) && !n.read).length;
  // Backward compatible: accepts a user or a role name (one demo user per role).
  const notificationsFor = who => listNotifications(typeof who === 'string' ? (users.find(u => u.role === who) || { id: null }) : who);
  const notificationModules = user => ['system', ...NOTIFY_MODULES].filter(m => canSeeModule(user, m)).map(m => ({ key: m, name: MODULE_LABEL(m) }));

  /* Writing. Each resolves { ok, updated: [ids], failed: [ids] } and touches only the user's own records. */
  function updateNotifications(user, ids, change) {
    const wanted = new Set(ids);
    const list = allNotifications();
    const updated = [];
    const next = list.map(n => {
      if (!wanted.has(n.id) || !isVisibleTo(user, n)) return n;
      updated.push(n.id);
      return { ...n, ...change(n) };
    });
    const failed = ids.filter(id => !updated.includes(id));
    if (!updated.length) return settle({ ok: !ids.length, updated, failed });
    return settle(write(NOTIFICATIONS_KEY, next) ? { ok: true, updated, failed } : { ok: false, updated: [], failed: ids });
  }
  const setNotificationsRead = (user, ids, isRead = true) => updateNotifications(user, ids, () => ({ read: isRead, readAt: isRead ? new Date().toISOString() : null }));
  const deleteNotifications = (user, ids) => updateNotifications(user, ids, () => ({ deletedAt: new Date().toISOString() }));
  function markAllRead(who) {
    const user = typeof who === 'string' ? users.find(u => u.role === who) : who;
    if (!user) return settle({ ok: false, updated: [], failed: [] });
    return setNotificationsRead(user, listNotifications(user, { tab: 'unread' }).map(n => n.id), true);
  }

  // Where a notification leads. { href } for an accessible record, or { error } with a reason.
  function notificationTarget(user, n) {
    const go = (key, params) => {
      if (!canAccess(user, key) || !isEntitled(key)) return { error: 'You no longer have access to this record.' };
      const q = new URLSearchParams(params).toString();
      return { href: `${routes.page(key)}${q ? `&${q}` : ''}` };
    };
    const missing = { error: 'This record has been removed or is no longer available.' };
    switch (n.recordType) {
      case 'enquiry': return getAdmissionEnquiries().some(e => e.id === n.recordId) ? go('admissions', { applicant: n.recordId }) : missing;
      case 'invoice': return getInvoices().some(i => i.id === n.recordId) ? go('fees', { status: 'all', focus: n.recordId }) : missing;
      case 'incident': return getIncidents().some(i => i.id === n.recordId) ? go('safeguarding', { status: 'all', focus: n.recordId }) : missing;
      case 'meeting': return ptmData().bookings.some(b => b.id === n.recordId) ? go('meetings', { tab: 'bookings', booking: n.recordId }) : missing;
      case 'conference': return ptmData().records.some(r => r.id === n.recordId) ? go('meetings', { tab: 'records', record: n.recordId }) : missing;
      case 'form': return getForms().some(f => f.id === n.recordId) ? go('forms', { results: n.recordId }) : missing;
      case 'announcement': return getAnnouncements().some(a => a.id === n.recordId) ? go('communication', { focus: n.recordId }) : missing;
      case 'class': return classByName(n.recordId) ? go('attendance', { cls: n.recordId, view: n.kind === 'ratio' ? 'ratio' : '' }) : missing;
      case 'child': { const c = childById(n.recordId); return c && canAccess(user, 'children') && classScope(user).includes(c.cls) ? { href: routes.record(c.id) } : missing; }
      case 'broadcast': return { href: routes.dashboard };
      case 'conversation': return getConversations().some(c => c.id === n.recordId && isMember(user, c)) ? go('messages', { c: n.recordId }) : { error: 'This conversation isn’t available to you.' };
      case 'repair': return getRepairs().some(r => r.id === n.recordId) ? go('resources', { tab: 'materials', repairs: '1' }) : missing;
      case 'stock': return getInventory().some(i => i.id === n.recordId) ? go('resources', { tab: 'inventory', focus: n.recordId }) : missing;
      case 'plan': { const p = getPlans().find(x => x.id === n.recordId); const c = p && classById(p.classId); return c ? go('lessons', { cls: c.name, week: p.weekStart }) : missing; }
      default:
        if (n.kind === 'upgrade-request') return { href: routes.plans({ plan: n.requiredPlan, module: n.page }) };
        if (n.kind === 'access-request') return { href: routes.page('notifications') };
        return { href: null };
    }
  }

  // Events from the daily workflows. Called only after the business record was saved.
  const events = {
    enquiry(user, e, assignee) {
      notifyUsers({ module: 'admissions', kind: 'enquiry', title: `New enquiry: ${e.child}`, body: `${e.parent} asked about ${e.programme}.`, recordType: 'enquiry', recordId: e.id, dedupeKey: `enquiry:${e.id}`, actorId: user.id },
        { toRoles: rolesFor('admissions'), exclude: [user.id, assignee].filter(Boolean) });
      if (assignee && assignee !== user.id) notifyUsers({ module: 'admissions', kind: 'mention', title: `${user.name} assigned you a follow-up`, body: `${e.child} (${e.programme}) · call ${e.parent}${e.followUp ? ` by ${e.followUp}` : ''}.`, recordType: 'enquiry', recordId: e.id, mentions: [assignee], dedupeKey: `assign:${e.id}`, actorId: user.id }, { toUserIds: [assignee] });
    },
    payment(user, p) {
      notifyUsers({ module: 'fees', kind: 'payment', title: `Payment received: ₹${p.amount.toLocaleString('en-IN')}`, body: `${studentById(p.studentId)?.name} · ${p.method} · recorded by ${user.name}`, recordType: 'invoice', recordId: p.invoiceId, dedupeKey: `payment:${p.id}`, actorId: user.id },
        { toRoles: rolesFor('fees'), exclude: [user.id] });
    },
    incident(user, i) {
      const s = studentById(i.studentId);
      notifyUsers({ module: 'safeguarding', kind: 'incident', title: `${i.severity === 'High' ? 'High-severity incident' : 'Incident logged'}: ${s?.name}`, body: `${i.type} · ${i.description}`, recordType: 'incident', recordId: i.id, severity: i.severity === 'High' ? 'critical' : 'normal', dedupeKey: `incident:${i.id}`, actorId: user.id },
        { toRoles: rolesFor('safeguarding'), exclude: [user.id] });
    },
    announcement(user, a) {
      const classUsers = staffOf(a.audience).filter(e => e.userId && e.userId !== user.id).map(e => e.userId);
      notifyUsers({ module: 'communication', kind: 'announcement', title: `Announcement: ${a.title}`, body: `${a.audience} · from ${user.name}`, recordType: 'announcement', recordId: a.id, dedupeKey: `announcement:${a.id}`, actorId: user.id },
        { toRoles: rolesFor('communication'), exclude: [user.id, ...classUsers] });
      // The class's own educators are mentioned, so it shows in their Mentions tab.
      if (classUsers.length) notifyUsers({ module: 'communication', kind: 'mention', title: `${user.name} posted to your class`, body: `${a.title} · ${a.audience}`, recordType: 'announcement', recordId: a.id, mentions: classUsers, dedupeKey: `announcement:${a.id}`, actorId: user.id }, { toUserIds: classUsers });
    },
    broadcast(user, b) {
      notifyUsers({ module: 'system', kind: 'broadcast', title: 'Emergency broadcast', body: b.message, recordType: 'broadcast', recordId: b.id, severity: 'critical', dedupeKey: `broadcast:${b.id}`, actorId: user.id },
        { toRoles: roles.slice(), exclude: [user.id] });
    },
    register(user, cls) {
      const owners = staffOf(cls).filter(e => e.userId && e.userId !== user.id).map(e => e.userId);
      if (owners.length) notifyUsers({ module: 'attendance', kind: 'mention', title: `${user.name} updated your register`, body: `${cls} register saved at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`, recordType: 'class', recordId: cls, mentions: owners, dedupeKey: `register:${cls}:${Date.now()}`, actorId: user.id }, { toUserIds: owners });
      events.ratio(cls);
    },
    // A class going over its ratio alerts staffing managers and the class's educators once per day.
    ratio(cls) {
      const r = classRatio(cls);
      if (r.status !== 'breach') return;
      notifyUsers({ module: 'attendance', kind: 'ratio', title: `${cls} is over its ratio`, body: `${r.children} children with ${r.educators} educator${r.educators === 1 ? '' : 's'} on duty (limit ${r.limit}).`, recordType: 'class', recordId: cls, severity: 'critical', dedupeKey: `ratio:${cls}:${today()}` },
        { toRoles: STAFF_RATIO_ROLES, toUserIds: staffOf(cls).filter(e => e.userId).map(e => e.userId) });
    }
  };

  window.NexoraStore = {
    students,
    lessons,
    records,
    routes,
    session,
    search,
    byId: id => records.find(r => r.id === id) || null,
    roles,
    pages,
    pageByKey,
    currentUser,
    setRole,
    canAccess,
    findRequest,
    requestAccess,
    notificationsFor,
    markAllRead,
    school,
    schools,
    WEEKDAYS,
    CLASS_LEVELS,
    STAFF_ROLES,
    getSettings,
    saveSettings,
    getClasses,
    saveClasses,
    classStudentCount,
    getStaffDrafts,
    saveStaffDrafts,
    getSetup,
    saveSetup,
    schoolById,
    isFirstLogin,
    completeFirstLogin,
    plans,
    planById,
    moduleKeys,
    currentPlan,
    requiredPlanFor,
    isEntitled,
    modulesInPlan,
    canManagePlan,
    setSchoolPlan,
    findUpgradeRequest,
    requestUpgrade,
    submitEnquiry,
    subscribe,
    today,
    get roster() { return activeRoster(); },
    CHILD_STATUSES,
    ALERT_TYPES,
    canManageChildren,
    getChildren,
    childById,
    childName,
    ageParts,
    GENDERS,
    LANGUAGES,
    COUNTRIES,
    DIETARY_OPTIONS,
    SESSIONS,
    DECLARATIONS,
    PICKUP_STATUS,
    RESTRICTION_STATUS,
    MED_CONSENT,
    schoolDays,
    classInfo,
    classesInfo,
    getHouseholds,
    families,
    findDuplicates,
    getWaitlist,
    addToWaitlist,
    getDrafts,
    saveDraft,
    deleteDraft,
    validateEnrolment,
    enrolChild,
    APP_STATUS,
    canManageFamilies,
    getParentApp,
    listFamilies,
    familyById,
    saveFamily,
    invitePreview,
    inviteFamilies,
    mergeFamilies,
    GUARDIAN_LANGUAGES,
    CHANNELS,
    schoolLanguage,
    canSeeLegal,
    guardianLanguage,
    guardianChannels,
    channelState,
    saveFamilyGuardian,
    setFamilyPrimary,
    saveFamilyHousehold,
    setHouseholdChildren,
    unlinkHouseholdGuardian,
    getLegalNotes,
    saveLegalNote,
    TEMPLATES,
    renderTemplate,
    familyThreads,
    familyAccount,
    moveChildren,
    withdrawChild,
    getChildPrefs,
    saveChildPrefs,
    getFamilyMessages,
    saveFamilyMessage,
    PROFILE_ACCESS,
    canView,
    canEditSection,
    sectionModule,
    childProfile,
    getGuardians,
    updateChildSection,
    saveGuardianLink,
    unlinkGuardian,
    revealPasscode,
    getAudit,
    LEARNING_STAGES,
    LEARNING_AREAS,
    getDiary,
    getLearning,
    saveDiaryEntry: (user, childId, input, id) => saveEntry('diary', user, childId, input, id),
    saveLearningEntry: (user, childId, input, id) => saveEntry('learning', user, childId, input, id),
    DOC_TYPES,
    DOC_CATEGORIES,
    DOC_MAX,
    getDocuments,
    addDocument,
    verifyDocument,
    CONSENT_TYPES,
    CONSENT_STATUSES,
    getConsents,
    saveConsent,
    attendanceFor,
    get rosterClasses() { return activeClasses(); },
    getClassRegistry,
    activeClasses,
    classById,
    classByName,
    guardianById,
    daysFromToday,
    staffOf,
    classesOfStaff,
    CLASS_COLOURS,
    canManageClasses,
    classCards,
    capacityState,
    enrolledIn,
    saveClass,
    archiveClass,
    staffRoleIn,
    shiftOf,
    getSubstitutes,
    substitutesOn,
    substituteOptions,
    assignSubstitute,
    cancelSubstitute,
    classRoutine,
    seatsLeft,
    transferChild,
    studentById,
    educators,
    classScope,
    getRatioRules,
    getRegister,
    saveRegister,
    ABSENCE_REASONS,
    schoolDay,
    getHolidays,
    attendanceView,
    attendanceSummary,
    getAttendanceEvents,
    pickupOptions,
    familyContacts,
    checkIn,
    bulkCheckIn,
    undoBulk,
    checkOut,
    refuseRelease,
    markAbsent,
    remindersFor,
    processDueReminders,
    DIARY_TYPES,
    DIARY_STATUS,
    MEAL_TYPES,
    MEAL_AMOUNTS,
    TOILET_TYPES,
    MOODS,
    ALLERGENS,
    menuFor,
    mealCheck,
    diaryDay,
    diaryEntry,
    saveDiaryEntries,
    startNaps,
    stopNaps,
    updateDiaryEntry,
    publishDiaryEntries,
    addDiaryPhoto,
    diaryPhoto,
    familyDiary,
    EVENT_TYPES,
    EVENT_REPEATS,
    canManageEvents,
    getEvents,
    eventsBetween,
    findOccurrence,
    eventImpact,
    createEvent,
    updateEvent,
    deleteEvent,
    moveEvent,
    eventResponses,
    setEventRsvp,
    setEventConsent,
    sendEventNotice,
    addEventFile,
    eventFileMeta,
    eventFile,
    getCalendarPrefs,
    saveCalendarPrefs,
    childEvents,
    PLAN_STATUS,
    DAY_NAMES,
    getActivities,
    activityById,
    saveActivity,
    frameworkOutcomes,
    canPlan,
    routineBlocks,
    canEditTimetable,
    saveRoutineBlock,
    deleteRoutineBlock,
    weekOf,
    planDays,
    weeklyPlan,
    getPlanSettings,
    planReviewer,
    setPlanReviewer,
    savePlanEntries,
    copyLastWeek,
    startRevision,
    submitPlan,
    reviewPlan,
    planHistory,
    themesFor,
    saveTheme,
    deleteTheme,
    todayPlan,
    ROOM_TYPES,
    CONDITIONS,
    REPAIR_STATUS,
    STOCK_REASONS,
    STOCK_UNITS,
    LOAN_MAX_DAYS,
    canManageResources,
    canEditMaterial,
    getRooms,
    roomById,
    roomHours,
    getBookings,
    bookingsOn,
    bookingGroup,
    saveRoom,
    saveBooking,
    cancelBooking,
    getMaterials,
    getRepairs,
    saveMaterial,
    setRepairStatus,
    getBooks,
    getLoans,
    bookStatus,
    borrowerName,
    borrowersFor,
    saveBook,
    lendBook,
    returnBook,
    getInventory,
    getMovements,
    stockStatus,
    saveInventoryItem,
    adjustStock,
    CONV_TYPES,
    messagingDemo,
    setMessagingDemo,
    getQuickReplies,
    saveQuickReplies,
    listConversations,
    conversationView,
    messageTargets,
    startConversation,
    uploadChatFile,
    chatFile,
    sendChatMessage,
    cancelScheduled,
    markConversationRead,
    processMessaging,
    translateMessage,
    conversationContext,
    totalChatUnread,
    users,
    getStaffAttendance,
    setStaffAttendance,
    canManageStaff,
    classRatio,
    ratioStatus,
    ENQUIRY_STATUSES,
    getAdmissionEnquiries,
    ENQUIRY_STAGES,
    ENQUIRY_SOURCES,
    LOST_REASONS,
    admissionsOwners,
    ageAt,
    daysInStage,
    enquiryDuplicates,
    createEnquiry,
    updateEnquiry,
    setEnquiryFollowUp,
    moveEnquiry,
    startEnquiryEnrolment,
    enquiryPrefill,
    completeEnquiryEnrolment,
    admissionsKpis,
    APPLICANT_DOCS,
    APPLICANT_DOC_TYPES,
    CALL_OUTCOMES,
    CONTACT_METHODS,
    OFFER_TEMPLATE,
    taskOverdue,
    nextFollowUp,
    logEnquiryNote,
    logEnquiryCall,
    logEnquiryEmail,
    addEnquiryTask,
    updateEnquiryTask,
    processAdmissions,
    uploadApplicantDocument,
    removeApplicantDocument,
    applicantFile,
    enquirySiblings,
    linkSibling,
    unlinkSibling,
    offerValues,
    renderOffer,
    canOffer,
    saveOfferDraft,
    sendOffer,
    TOUR_DURATIONS,
    TOUR_STATUSES,
    tourGuides,
    canManageTours,
    tourSlots,
    tourBookings,
    previewTourPattern,
    saveTourPattern,
    tourPatternImpact,
    removeTourPattern,
    bookTour,
    markTourAttended,
    markTourNoShow,
    rescheduleTour,
    cancelTour,
    getTourPatterns: () => toursData().patterns,
    isOpenEnquiry,
    followUpDue,
    addAdmissionEnquiry,
    TERM,
    PAYMENT_METHODS,
    feeLedger,
    getPayments,
    recordPayment,
    INCIDENT_TYPES,
    SEVERITIES,
    getIncidents,
    logIncident,
    resolveIncident,
    get AUDIENCES() { return audiences(); },
    getAnnouncements,
    ANN_CATEGORIES,
    EMERGENCY_TYPES,
    ANN_CHANNELS,
    EMERGENCY_PHRASE,
    canAnnounce,
    canEmergency,
    announcementTargets,
    resolveAudience,
    sentAnnouncements,
    announcementReachesClass,
    announcementStats,
    canManageAnn,
    saveAnnouncementDraft,
    scheduleAnnouncement,
    sendAnnouncement,
    sendScheduledNow,
    cancelAnnouncement,
    deleteAnnouncementDraft,
    duplicateAnnouncement,
    processAnnouncements,
    markAnnouncementRead,
    acknowledgeAnnouncement,
    simulateAnnouncementActivity,
    remindUnread,
    sendEmergency,
    FORM_TYPES,
    FORM_STATUSES,
    FORM_QTYPES,
    FORM_OPS,
    FORM_OPS_FOR,
    canManageForms,
    canManageForm,
    newFormQuestion,
    formAnswered,
    visibleFormQuestions,
    formIssues,
    formTargets,
    resolveFormAudience,
    getForms,
    listForms,
    formView,
    formStats,
    formOverdue,
    formAccepting,
    saveFormDraft,
    deleteForm,
    duplicateForm,
    publishForm,
    closeForm,
    reopenForm,
    remindFormNonResponders,
    uploadFormFile,
    formFile,
    submitFormResponse,
    formQuestionSummary,
    formAnswerText,
    formResponsesCsv,
    MEETING_MODES,
    SLOT_MODES,
    BOOKING_STATUSES,
    SLOT_LENGTHS,
    canUseMeetings,
    educatorOf,
    meetingTeachers,
    teacherName,
    teacherLocation,
    meetingSlots,
    openSlotsFor,
    planSlots,
    createSlots,
    removeSlot,
    bookMeeting,
    cancelMeeting,
    setMeetingOutcome,
    setMeetingVideoLink,
    meetingBookings,
    conferenceActionStatus,
    conferenceRecords,
    conferenceRecordsForChild,
    canEditRecord,
    actionOwners,
    ownerName,
    saveConferenceRecord,
    setConferenceAction,
    familyConferenceView,
    shareConferenceRecord,
    meetingSummary,
    processMeetings,
    postAnnouncement,
    getBroadcasts,
    activeBroadcasts,
    unacknowledgedFor,
    canBroadcast,
    sendBroadcast,
    endBroadcast,
    acknowledgeBroadcast,
    getDashboardPrefs,
    saveDashboardPrefs,
    listNotifications,
    unreadCount,
    isMention,
    notificationModules,
    moduleLabel: MODULE_LABEL,
    setNotificationsRead,
    deleteNotifications,
    notificationTarget,
    getNotificationSettings,
    saveNotificationSettings,
    NOTIFY_MODULES
  };
})();
