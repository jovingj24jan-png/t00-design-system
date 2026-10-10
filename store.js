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

  // S14 enrol (no id) and edit (id). Returns { ok, child } or { ok: false, reason, errors }.
  function saveChild(user, data, id = null) {
    if (!canManageChildren(user)) return settle({ ok: false, reason: 'forbidden' });
    const clean = v => String(v ?? '').trim();
    const d = {
      firstName: clean(data.firstName), lastName: clean(data.lastName), dob: clean(data.dob), cls: clean(data.cls), startDate: clean(data.startDate),
      guardian: { name: clean(data.guardianName), relation: clean(data.guardianRelation) || 'Parent', phone: clean(data.guardianPhone), email: clean(data.guardianEmail) },
      alerts: (data.alerts || []).filter(a => ALERT_TYPES[a.type] && clean(a.detail)).map(a => ({ type: a.type, detail: clean(a.detail) }))
    };
    const errors = {};
    if (!d.firstName) errors.firstName = 'Enter the child’s first name.';
    if (!d.lastName) errors.lastName = 'Enter the child’s last name.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dob) || d.dob >= today()) errors.dob = 'Enter a date of birth in the past.';
    if (!classByName(d.cls)) errors.cls = 'Choose a class.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.startDate)) errors.startDate = 'Enter a start date.';
    if (!d.guardian.name) errors.guardianName = 'Enter the primary guardian’s name.';
    if (d.guardian.phone.replace(/\D/g, '').length < 10) errors.guardianPhone = 'Enter a phone number with at least 10 digits.';
    if (d.guardian.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.guardian.email)) errors.guardianEmail = 'Enter a valid email or leave it blank.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });

    const list = getChildren();
    let child;
    if (id) {
      const i = list.findIndex(c => c.id === id);
      if (i < 0) return settle({ ok: false, reason: 'missing' });
      const before = list[i];
      child = { ...before, ...d, history: [...before.history, stamp(user, 'edited', before.cls !== d.cls ? `Details updated; class ${before.cls} → ${d.cls}` : 'Details updated')] };
      // The S14 guardian fields edit the shared primary guardian record.
      const link = before.guardianLinks?.find(l => l.primary);
      if (link) {
        const guardians = getGuardians();
        const g = guardians.find(x => x.id === link.guardianId);
        if (g) { Object.assign(g, { name: d.guardian.name, phone: d.guardian.phone, email: d.guardian.email }); write(guardiansKey(school.id), guardians); }
        child.guardianLinks = before.guardianLinks.map(l => (l === link ? { ...l, relation: d.guardian.relation } : l));
        list.forEach(x => { if (x.id !== child.id && x.guardianLinks?.some(l => l.guardianId === link.guardianId)) syncPrimary(x, guardians); });
      }
      // A not-yet-started child becomes active once the start date is reached, and back again if it moves later.
      if (['active', 'starting'].includes(before.status)) child.status = d.startDate > today() ? 'starting' : 'active';
      list[i] = child;
    } else {
      const dupe = list.find(c => c.firstName.toLowerCase() === d.firstName.toLowerCase() && c.lastName.toLowerCase() === d.lastName.toLowerCase() && c.dob === d.dob);
      if (dupe) return settle({ ok: false, reason: 'duplicate', child: dupe });
      child = { id: newId('ch'), ...d, status: d.startDate > today() ? 'starting' : 'active', photo: null, withdrawal: null, history: [stamp(user, 'enrolled', `Enrolled in ${d.cls}`)] };
      const guardians = getGuardians();
      const g = { id: newId('g'), name: d.guardian.name, phone: d.guardian.phone, email: d.guardian.email, prefers: 'phone' };
      guardians.push(g);
      if (!write(guardiansKey(school.id), guardians)) return settle({ ok: false, reason: 'storage' });
      Object.assign(child, {
        preferredName: '', keyTeacher: educators.find(e => e.cls === d.cls)?.name || '',
        guardianLinks: [{ guardianId: g.id, relation: d.guardian.relation, primary: true }],
        emergency: [], pickup: { authorised: [{ name: d.guardian.name, relation: d.guardian.relation, phone: d.guardian.phone }], verification: '', passcode: '' },
        medications: [], careNotes: '', emergencyInstructions: '',
        alerts: d.alerts.map(a => (a.type === 'custody' ? { ...a, restrictedPerson: '' } : ['allergy', 'medical'].includes(a.type) ? { ...a, severity: '', instructions: '' } : a))
      });
      list.push(child);
    }
    return saveChildren(list) ? settle({ ok: true, child }) : settle({ ok: false, reason: 'storage' });
  }

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
  function saveFamilyMessage(user, { recipients, subject, body }) {
    if (!can(user, 'communication')) return settle({ ok: false, reason: 'forbidden' });
    const errors = {};
    if (!recipients?.length) errors.recipients = 'Add at least one family.';
    if (!String(subject || '').trim()) errors.subject = 'Give the message a subject.';
    if (!String(body || '').trim()) errors.body = 'Write the message.';
    if (Object.keys(errors).length) return settle({ ok: false, reason: 'invalid', errors });
    const msg = { id: newId('msg'), recipients, subject: subject.trim(), body: body.trim(), status: 'queued', createdAt: new Date().toISOString(), createdBy: user.name };
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
    set('careNotes', '');
    set('emergencyInstructions', '');
    c.alerts.forEach(a => {
      if (a.type === 'custody' && a.restrictedPerson === undefined) { a.restrictedPerson = seed.restrictedPerson || ''; changed = true; }
      if (['allergy', 'medical'].includes(a.type) && a.severity === undefined) { a.severity = a.type === 'allergy' ? (seed.severity || (/severe/i.test(a.detail) ? 'severe' : '')) : ''; changed = true; }
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
    pickup(v) {
      const r = rowsCheck(v.rows, { name: req('a name'), relation: req('the relationship'), phone: phoneRule }, 8);
      r.values = { authorised: r.values, verification: clean(v.verification) };
      return r;
    },
    custody: v => rowsCheck(v.rows, { detail: req('the restriction or court-order note'), restrictedPerson: () => '' }, 4),
    passcode(v) {
      const p = clean(v.passcode);
      return { values: { passcode: p }, errors: /^\d{4,8}$/.test(p) ? {} : { passcode: 'Use 4 to 8 digits.' } };
    },
    allergies: v => rowsCheck(v.rows, { detail: req('the allergy'), severity: s => (SEVERITIES_MED.includes(s) ? '' : 'Choose a severity.'), instructions: () => '' }),
    conditions: v => rowsCheck(v.rows, { detail: req('the condition'), instructions: () => '' }),
    medications: v => rowsCheck(v.rows, { name: req('the medication'), dose: () => '', storedAt: () => '' }),
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
      case 'custody': c.alerts = [...keepAlerts(['custody']), ...values.map(r => ({ type: 'custody', detail: r.detail, restrictedPerson: r.restrictedPerson }))]; break;
      case 'allergies': c.alerts = [...keepAlerts(['allergy']), ...values.map(r => ({ type: 'allergy', ...r }))]; break;
      case 'conditions': c.alerts = [...keepAlerts(['medical']), ...values.map(r => ({ type: 'medical', detail: r.detail, severity: '', instructions: r.instructions }))]; break;
      case 'dietary': c.alerts = [...keepAlerts(['dietary']), ...values.map(r => ({ type: 'dietary', detail: r.detail }))]; break;
      case 'medications': c.medications = values; break;
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
    saveChild,
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
