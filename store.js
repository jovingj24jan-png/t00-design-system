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
    page: key => `app.html?page=${encodeURIComponent(key)}`,
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
    classes: { name: 'Classes', icon: 'grid', roles: ['Teacher', 'Director', 'Admin', 'Super Admin'], summary: 'Every class in your school, with level, section and capacity.' },
    settings: { name: 'Settings', icon: 'grid', roles: ['Director', 'Admin', 'Super Admin'], summary: 'School details, academic year, school hours and preferences.' },
    notifications: { name: 'Notifications', icon: 'bell', roles: roles.slice(), summary: 'Updates and requests sent to you.' }
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

  function notify(toRole, notification) {
    const list = read(NOTIFICATIONS_KEY, []);
    list.unshift({ id: `n-${Date.now().toString(36)}`, toRole, read: false, createdAt: new Date().toISOString(), ...notification });
    return write(NOTIFICATIONS_KEY, list);
  }

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

  const notificationsFor = role => read(NOTIFICATIONS_KEY, []).filter(n => n.toRole === role);
  function markAllRead(role) {
    write(NOTIFICATIONS_KEY, read(NOTIFICATIONS_KEY, []).map(n => (n.toRole === role ? { ...n, read: true } : n)));
  }

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
  // The five design-system students first (same IDs), then the rest of each class.
  const roster = [
    ...students.map(s => ({ id: s.id, name: s.name, cls: s.cls })),
    ...Object.entries(ROSTER_NAMES).flatMap(([cls, names]) => names.map(name => ({ id: `r${++rosterSeq}`, name, cls })))
  ];
  const studentById = id => roster.find(s => s.id === id) || null;
  const classByName = name => rosterClasses.find(c => c.name === name) || null;

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
        roster.filter(s => s.cls === c.name).forEach(s => { marks[s.id] = SEED_MARKS[s.id] || 'present'; });
        reg[c.name] = { takenAt: atToday(8, 40 + i * 6), takenBy: educators.find(e => e.cls === c.name).name, marks };
      });
      return reg;
    });
  }
  function saveRegister(user, cls, marks) {
    const pupils = roster.filter(s => s.cls === cls);
    if (!can(user, 'attendance') || !classScope(user).includes(cls)) return settle({ ok: false, reason: 'forbidden' });
    if (!pupils.length || pupils.some(s => !['present', 'late', 'absent'].includes(marks[s.id]))) return settle({ ok: false, reason: 'incomplete' });
    const reg = getRegister();
    reg[cls] = { takenAt: new Date().toISOString(), takenBy: user.name, marks: Object.fromEntries(pupils.map(s => [s.id, marks[s.id]])) };
    return settle(write(registerKey(school.id, today()), reg) ? { ok: true, cls } : { ok: false, reason: 'storage' });
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
    return settle(write(staffAttKey(school.id, today()), att) ? { ok: true } : { ok: false, reason: 'storage' });
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
      createdAt: new Date().toISOString(), createdBy: user.name
    };
    if (!e.child || !e.parent || e.phone.replace(/\D/g, '').length < 10 || !CLASS_LEVELS.includes(e.programme)) return settle({ ok: false, reason: 'invalid' });
    return settle(write(admissionsKey(school.id), [e, ...getAdmissionEnquiries()]) ? { ok: true, enquiry: e } : { ok: false, reason: 'storage' });
  }

  /* Fees: one term invoice per child, and the payments recorded against it. Amounts in rupees. */
  const TERM = 'Term 2 · 2026–27';
  const FEE_BY_LEVEL = { Nursery: 15000, LKG: 16500, UKG: 18000, Montessori: 21000 };
  const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank transfer', 'Cheque', 'Card'];
  const invoicesKey = id => `nexora-invoices:${id}`;
  const paymentsKey = id => `nexora-payments:${id}`;
  const UNPAID = ['r3', 'r14', 'r22', 'r30', 'r38', 's4'];
  const PART_PAID = ['s3', 'r9', 'r41'];
  const getInvoices = (schoolId = school.id) => seeded(invoicesKey(schoolId), () => roster.map(s => ({
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
    return settle(write(paymentsKey(school.id), [...getPayments(), p]) ? { ok: true, payment: p, balance: line.balance - amount } : { ok: false, reason: 'storage' });
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
    return settle(write(incidentsKey(school.id), [i, ...getIncidents()]) ? { ok: true, incident: i } : { ok: false, reason: 'storage' });
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
    return settle(write(announcementsKey(school.id), [a, ...getAnnouncements()]) ? { ok: true, announcement: a } : { ok: false, reason: 'storage' });
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
    return settle(write(broadcastsKey(school.id), [b, ...getBroadcasts()]) ? { ok: true, broadcast: b } : { ok: false, reason: 'storage' });
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
    roster,
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
    saveDashboardPrefs
  };
})();
