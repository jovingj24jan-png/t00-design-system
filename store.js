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
    denied: key => `access-denied.html?page=${encodeURIComponent(key)}`
  };

  // Prototype only: there is no real sign-in. A localStorage flag stands in for a session.
  const SESSION_KEY = 'nexora-session';
  const session = {
    isSignedIn() {
      try { return localStorage.getItem(SESSION_KEY) === 'signed-in'; } catch { return false; }
    },
    set(signedIn) {
      try { signedIn ? localStorage.setItem(SESSION_KEY, 'signed-in') : localStorage.removeItem(SESSION_KEY); } catch { /* storage blocked: stay signed out */ }
    }
  };

  /* ---------------------------------------------------------------- Roles, pages, permissions */

  // Prototype only: one demo user per role. The signed-in role is chosen in the sidebar.
  const roles = ['Teacher', 'Director', 'Accountant', 'Admin', 'Super Admin'];
  const users = [
    { id: 'u-teacher', name: 'Ms. Lakshmi', role: 'Teacher' },
    { id: 'u-director', name: 'Mrs. Rao', role: 'Director' },
    { id: 'u-accountant', name: 'Mr. Iyer', role: 'Accountant' },
    { id: 'u-admin', name: 'Ms. Fernandes', role: 'Admin' },
    { id: 'u-super', name: 'Joving', role: 'Super Admin' }
  ];

  // Single source of truth for which roles may open each app page.
  const pages = {
    'classroom-tracker': { name: 'Classroom Tracker', roles: ['Teacher', 'Director', 'Admin', 'Super Admin'], summary: 'Daily work cycles, presentations and observations for each classroom.' },
    reports: { name: 'Reports', roles: ['Director', 'Admin', 'Super Admin'], summary: 'Term reports, attendance trends and enrolment numbers.' },
    payroll: { name: 'Payroll', roles: ['Director', 'Accountant', 'Super Admin'], summary: 'Staff salaries, deductions and monthly payslips.' },
    safeguarding: { name: 'Safeguarding', roles: ['Director', 'Super Admin'], summary: 'Confidential concerns, referrals and follow-up actions.' },
    fees: { name: 'Fees', roles: ['Director', 'Accountant', 'Admin', 'Super Admin'], summary: 'Fee schedules, payments received and reminders.' },
    notifications: { name: 'Notifications', roles: roles.slice(), summary: 'Updates and requests sent to you.' }
  };

  const ROLE_KEY = 'nexora-demo-role';
  const REQUESTS_KEY = 'nexora-access-requests';
  const NOTIFICATIONS_KEY = 'nexora-notifications';

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
  const pageByKey = key => (Object.prototype.hasOwnProperty.call(pages, key) ? { key, ...pages[key] } : null);
  const canAccess = (user, key) => { const p = pageByKey(key); return Boolean(p && p.roles.includes(user.role)); };

  /* ---------------------------------------------------------------- Access requests + notifications */

  const requests = () => read(REQUESTS_KEY, []);
  const findRequest = (user, key) => requests().find(r => r.userId === user.id && r.page === key) || null;

  function notify(toRole, notification) {
    const list = read(NOTIFICATIONS_KEY, []);
    list.unshift({ id: `n-${Date.now().toString(36)}`, toRole, read: false, createdAt: new Date().toISOString(), ...notification });
    write(NOTIFICATIONS_KEY, list);
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
    markAllRead
  };
})();
