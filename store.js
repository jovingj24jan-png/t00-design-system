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
      name: 'Parent Communication', icon: 'message', requiredPlan: 'starter',
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
    messages: { name: 'Family messages', icon: 'message', roles: ['Teacher', 'Director', 'Admin', 'Super Admin'], summary: 'Messages sent to one family’s guardians.' },
    family: { name: 'Family', icon: 'users', roles: ['Teacher', 'Director', 'Accountant', 'Admin', 'Super Admin'], summary: 'One family: households, guardians, children, parent app and balance.' },
    roster: { name: 'Class rosters', icon: 'grid', roles: ['Teacher', 'Director', 'Admin', 'Super Admin'], summary: 'Who is in each class, with capacity and schedules.' },
    compose: { name: 'Message families', icon: 'message', roles: ['Teacher', 'Director', 'Admin', 'Super Admin'], summary: 'Write to selected families. Prototype: messages are saved, not delivered.' },
    classes: { name: 'Classes', icon: 'grid', roles: ['Teacher', 'Director', 'Admin', 'Super Admin'], summary: 'Every class in your school, with level, section and capacity.' },
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

  // Classes the demo roster belongs to, with the level each ratio rule applies to.
  const rosterClasses = [
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
  const classByName = name => rosterClasses.find(c => c.name === name) || null;

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

  // Moves one or more children together: if any child can't move, nothing is saved.
  function moveChildren(user, ids, cls) {
    if (!canManageChildren(user)) return settle({ ok: false, reason: 'forbidden' });
    if (!classByName(cls)) return settle({ ok: false, reason: 'invalid', errors: { cls: 'Choose a class to move to.' } });
    const list = getChildren();
    const targets = ids.map(id => list.find(c => c.id === id));
    if (!targets.length || targets.some(c => !c)) return settle({ ok: false, reason: 'missing' });
    const closed = targets.filter(c => ['withdrawn', 'graduated'].includes(c.status));
    if (closed.length) return settle({ ok: false, reason: 'closed', children: closed });
    let moved = 0;
    targets.forEach(c => {
      if (c.cls === cls) return;
      c.history = [...c.history, stamp(user, 'moved', `Moved from ${c.cls} to ${cls}`)];
      // A key teacher from the old class hands over to the new class's lead educator.
      if (!c.keyTeacher || educators.some(e => e.name === c.keyTeacher && e.cls === c.cls)) c.keyTeacher = educators.find(e => e.cls === cls)?.name || '';
      c.cls = cls;
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
    set('keyTeacher', educators.find(e => e.cls === c.cls)?.name || '');
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
    if (c.pickup) c.pickup.authorised.forEach(p => { if (p.status === undefined) { p.status = 'authorised'; p.idRef = ''; changed = true; } });
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
      case 'pickup': c.pickup = { ...c.pickup, ...values }; break;
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
    const s17 = getClasses(school.id).find(x => x.name.toLowerCase() === name.toLowerCase());
    const capacity = s17?.capacity ?? getClassConfig()[name] ?? null;
    const occupancy = getChildren().filter(k => k.cls === name && ['active', 'starting'].includes(k.status) && k.id !== excludeId).length;
    return { name, level: c.level, teacher: educators.find(e => e.cls === name)?.name || '', capacity, occupancy, remaining: capacity == null ? null : Math.max(0, capacity - occupancy), full: capacity != null && occupancy >= capacity };
  }
  const classesInfo = (excludeId = null) => rosterClasses.map(c => classInfo(c.name, excludeId));

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
    if (!classByName(v.cls)) errors.cls = 'Choose the class requested.';
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
    const info = classByName(cl.cls) ? classInfo(cl.cls, childId) : null;
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
          { toUserIds: educators.filter(e => e.cls === child.cls && e.userId).map(e => e.userId), exclude: [user.id] });
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

  // Educators assigned to each class. Ms. Lakshmi is the demo Teacher account.
  const educators = [
    { id: 'ed-lakshmi', name: 'Ms. Lakshmi', userId: 'u-teacher', cls: 'Montessori A' },
    { id: 'ed-deepa', name: 'Ms. Deepa', cls: 'Montessori A' },
    { id: 'ed-arjun', name: 'Mr. Arjun', cls: 'UKG A' },
    { id: 'ed-kavitha', name: 'Ms. Kavitha', cls: 'UKG B' },
    { id: 'ed-sunita', name: 'Ms. Sunita', cls: 'LKG A' },
    { id: 'ed-priya', name: 'Ms. Priya', cls: 'Nursery' },
    { id: 'ed-anjali', name: 'Ms. Anjali', cls: 'Nursery' }
  ];

  // Classes a user's data is limited to: a Teacher sees only the classes they're assigned to.
  function classScope(user) {
    if (user.role === 'Teacher') return [...new Set(educators.filter(e => e.userId === user.id).map(e => e.cls))];
    return rosterClasses.map(c => c.name);
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
      rosterClasses.filter(c => c.name !== 'UKG B').forEach((c, i) => {
        const marks = {};
        activeRoster().filter(s => s.cls === c.name).forEach(s => { marks[s.id] = SEED_MARKS[s.id] || 'present'; });
        reg[c.name] = { takenAt: atToday(8, 40 + i * 6), takenBy: educators.find(e => e.cls === c.name).name, marks };
      });
      return reg;
    });
  }
  function saveRegister(user, cls, marks) {
    const pupils = activeRoster().filter(s => s.cls === cls);
    if (!can(user, 'attendance') || !classScope(user).includes(cls)) return settle({ ok: false, reason: 'forbidden' });
    if (!pupils.length || pupils.some(s => !['present', 'late', 'absent'].includes(marks[s.id]))) return settle({ ok: false, reason: 'incomplete' });
    const reg = getRegister();
    reg[cls] = { takenAt: new Date().toISOString(), takenBy: user.name, marks: Object.fromEntries(pupils.map(s => [s.id, marks[s.id]])) };
    if (!write(registerKey(school.id, today()), reg)) return settle({ ok: false, reason: 'storage' });
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
    events.ratio(educators.find(e => e.id === educatorId).cls);
    return settle({ ok: true });
  }

  // Live ratio for one class: children on site (present + late) per educator on duty.
  // status: 'ok' | 'breach' | 'unavailable' (with a reason) — never a guessed ratio.
  function classRatio(cls, { register = getRegister(), staff = getStaffAttendance(), rules = getRatioRules() } = {}) {
    const c = classByName(cls);
    const base = { cls, level: c?.level || '' };
    const limit = c ? Number(rules[c.level]) : NaN;
    if (!c || !Number.isFinite(limit) || limit <= 0) return { ...base, status: 'unavailable', reason: 'No ratio limit set' };
    const entry = register[cls];
    if (!entry) return { ...base, limit, status: 'unavailable', reason: 'Register not taken yet' };
    const assigned = educators.filter(e => e.cls === cls);
    if (!assigned.length) return { ...base, limit, status: 'unavailable', reason: 'No educators assigned' };
    if (assigned.some(e => !staff[e.id])) return { ...base, limit, status: 'unavailable', reason: 'Staff attendance not recorded' };
    const children = Object.values(entry.marks).filter(m => m !== 'absent').length;
    const onDuty = assigned.filter(e => staff[e.id] === 'present').length;
    const breach = children > 0 && children > onDuty * limit;
    return { ...base, limit, children, educators: onDuty, assigned: assigned.length, status: breach ? 'breach' : 'ok' };
  }
  function ratioStatus(user) {
    const ctx = { register: getRegister(), staff: getStaffAttendance(), rules: getRatioRules() };
    return classScope(user).map(cls => classRatio(cls, ctx));
  }

  /* Admission enquiries (Admissions module) */
  const ENQUIRY_STATUSES = { new: 'New', contacted: 'Contacted', visit: 'Visit booked', enrolled: 'Enrolled', closed: 'Closed' };
  const admissionsKey = id => `nexora-admission-enquiries:${id}`;
  const getAdmissionEnquiries = (schoolId = school.id) => seeded(admissionsKey(schoolId), () => [
    { id: 'ae1', child: 'Advika Nair', parent: 'Lakshmi Nair', phone: '+91 98450 10101', email: 'lakshmi.nair@example.com', programme: 'Nursery', status: 'new', followUp: daysFromToday(0), notes: 'Asked about the June start.', createdAt: atToday(9, 5, -1), createdBy: 'Ms. Fernandes' },
    { id: 'ae2', child: 'Rehan Kapoor', parent: 'Sonal Kapoor', phone: '+91 98450 20202', email: 'sonal.k@example.com', programme: 'LKG', status: 'contacted', followUp: daysFromToday(-1), notes: 'Wants a call back about transport.', createdAt: atToday(11, 30, -4), createdBy: 'Mrs. Rao' },
    { id: 'ae3', child: 'Mira Thomas', parent: 'Anil Thomas', phone: '+91 98450 30303', email: '', programme: 'Montessori', status: 'visit', followUp: daysFromToday(2), notes: 'School visit booked.', createdAt: atToday(15, 10, -6), createdBy: 'Ms. Fernandes' },
    { id: 'ae4', child: 'Aditi Rao', parent: 'Kiran Rao', phone: '+91 98450 40404', email: 'kiran.rao@example.com', programme: 'UKG', status: 'new', followUp: daysFromToday(1), notes: '', createdAt: atToday(10, 0, -2), createdBy: 'Ms. Fernandes' },
    { id: 'ae5', child: 'Sameer Khan', parent: 'Farah Khan', phone: '+91 98450 50505', email: '', programme: 'Nursery', status: 'enrolled', followUp: '', notes: 'Starts next term.', createdAt: atToday(12, 0, -20), createdBy: 'Mrs. Rao' },
    { id: 'ae6', child: 'Zoya Ali', parent: 'Imran Ali', phone: '+91 98450 60606', email: '', programme: 'LKG', status: 'closed', followUp: '', notes: 'Moved city.', createdAt: atToday(12, 0, -25), createdBy: 'Mrs. Rao' }
  ]);
  const isOpenEnquiry = e => !['enrolled', 'closed'].includes(e.status);
  const followUpDue = e => isOpenEnquiry(e) && Boolean(e.followUp) && e.followUp <= today();
  function addAdmissionEnquiry(user, data) {
    if (!can(user, 'admissions')) return settle({ ok: false, reason: 'forbidden' });
    const e = {
      id: newId('ae'), child: String(data.child || '').trim(), parent: String(data.parent || '').trim(),
      phone: String(data.phone || '').trim(), email: String(data.email || '').trim(),
      programme: data.programme, status: 'new', followUp: data.followUp || '', notes: String(data.notes || '').trim().slice(0, 500),
      assignedTo: data.assignedTo || '', createdAt: new Date().toISOString(), createdBy: user.name
    };
    const assignee = e.assignedTo ? users.find(u => u.id === e.assignedTo) : null;
    if (!e.child || !e.parent || e.phone.replace(/\D/g, '').length < 10 || !CLASS_LEVELS.includes(e.programme) || (e.assignedTo && !(assignee && canAccess(assignee, 'admissions')))) return settle({ ok: false, reason: 'invalid' });
    if (!write(admissionsKey(school.id), [e, ...getAdmissionEnquiries()])) return settle({ ok: false, reason: 'storage' });
    events.enquiry(user, e, assignee?.id);
    return settle({ ok: true, enquiry: e });
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

  /* Announcements (Parent Communication module) */
  const AUDIENCES = ['All families', 'All staff', ...rosterClasses.map(c => c.name)];
  const announcementsKey = id => `nexora-announcements:${id}`;
  const getAnnouncements = (schoolId = school.id) => seeded(announcementsKey(schoolId), () => [
    { id: 'an1', title: 'Diwali celebration on Friday', body: 'Children may come in traditional clothes. Please send a small diya for the class display.', audience: 'All families', createdBy: 'Mrs. Rao', createdAt: atToday(16, 0, -1) },
    { id: 'an2', title: 'Parent–teacher meetings next week', body: 'Slots open on Monday. Each meeting is 15 minutes.', audience: 'All families', createdBy: 'Ms. Fernandes', createdAt: atToday(11, 0, -3) }
  ]);
  function postAnnouncement(user, data) {
    if (!can(user, 'communication')) return settle({ ok: false, reason: 'forbidden' });
    const a = { id: newId('an'), title: String(data.title || '').trim().slice(0, 120), body: String(data.body || '').trim().slice(0, 1000), audience: data.audience, createdBy: user.name, createdAt: new Date().toISOString() };
    if (!a.title || !a.body || !AUDIENCES.includes(a.audience)) return settle({ ok: false, reason: 'invalid' });
    // Prototype: saved here only. Nothing is sent to families.
    if (!write(announcementsKey(school.id), [a, ...getAnnouncements()])) return settle({ ok: false, reason: 'storage' });
    events.announcement(user, a);
    return settle({ ok: true, announcement: a });
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
      { toRoles: STAFF_RATIO_ROLES, toUserIds: educators.filter(e => e.cls === 'Nursery' && e.userId).map(e => e.userId), createdAt: atToday(9, 2) });
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
      case 'enquiry': return getAdmissionEnquiries().some(e => e.id === n.recordId) ? go('admissions', { status: 'all', focus: n.recordId }) : missing;
      case 'invoice': return getInvoices().some(i => i.id === n.recordId) ? go('fees', { status: 'all', focus: n.recordId }) : missing;
      case 'incident': return getIncidents().some(i => i.id === n.recordId) ? go('safeguarding', { status: 'all', focus: n.recordId }) : missing;
      case 'announcement': return getAnnouncements().some(a => a.id === n.recordId) ? go('communication', { focus: n.recordId }) : missing;
      case 'class': return classByName(n.recordId) ? go('attendance', { cls: n.recordId, view: n.kind === 'ratio' ? 'ratio' : '' }) : missing;
      case 'child': { const c = childById(n.recordId); return c && canAccess(user, 'children') && classScope(user).includes(c.cls) ? { href: routes.record(c.id) } : missing; }
      case 'broadcast': return { href: routes.dashboard };
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
      const classUsers = educators.filter(e => e.cls === a.audience && e.userId && e.userId !== user.id).map(e => e.userId);
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
      const owners = educators.filter(e => e.cls === cls && e.userId && e.userId !== user.id).map(e => e.userId);
      if (owners.length) notifyUsers({ module: 'attendance', kind: 'mention', title: `${user.name} updated your register`, body: `${cls} register saved at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`, recordType: 'class', recordId: cls, mentions: owners, dedupeKey: `register:${cls}:${Date.now()}`, actorId: user.id }, { toUserIds: owners });
      events.ratio(cls);
    },
    // A class going over its ratio alerts staffing managers and the class's educators once per day.
    ratio(cls) {
      const r = classRatio(cls);
      if (r.status !== 'breach') return;
      notifyUsers({ module: 'attendance', kind: 'ratio', title: `${cls} is over its ratio`, body: `${r.children} children with ${r.educators} educator${r.educators === 1 ? '' : 's'} on duty (limit ${r.limit}).`, recordType: 'class', recordId: cls, severity: 'critical', dedupeKey: `ratio:${cls}:${today()}` },
        { toRoles: STAFF_RATIO_ROLES, toUserIds: educators.filter(e => e.cls === cls && e.userId).map(e => e.userId) });
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
    users,
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
    rosterClasses,
    studentById,
    educators,
    classScope,
    getRatioRules,
    getRegister,
    saveRegister,
    getStaffAttendance,
    setStaffAttendance,
    canManageStaff,
    classRatio,
    ratioStatus,
    ENQUIRY_STATUSES,
    getAdmissionEnquiries,
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
    AUDIENCES,
    getAnnouncements,
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
