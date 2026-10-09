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
    dashboard: 'design-system.html',
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
    landing: 'design-system.html', // S04 — the normal landing page after sign-in
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
    { id: 'sch-northvale', name: 'Northvale Academy', logo: 'assets/logos/northvale-crest.png', status: 'active', enterprise: false, ssoEnabled: false },
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
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  };

  function currentUser() {
    let role = null;
    try { role = localStorage.getItem(ROLE_KEY); } catch { /* storage blocked */ }
    return users.find(u => u.role === role) || users[0];
  }
  function setRole(role) {
    if (!roles.includes(role)) return;
    try { localStorage.setItem(ROLE_KEY, role); } catch { /* storage blocked */ }
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
    submitEnquiry
  };
})();
